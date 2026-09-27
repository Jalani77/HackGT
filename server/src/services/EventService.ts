import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import type { CreateEventRequest, EventDTO, EventStatus, GrantedReward } from '../../../shared/types';
import { communityConfig } from '../config/community.config';
import { xpConfig } from '../config/xp.config';
import { Discovery } from '../models/Discovery';
import { CampusEvent, type EventDoc } from '../models/Event';
import { User, type UserDoc } from '../models/User';
import { AppError } from '../utils/AppError';
import { GrantService } from './GrantService';
import type { Activity, ProgressCollector } from './ProgressCollector';
import { cardMinis } from './SocialService';
import { UserService } from './UserService';
import { XPService } from './XPService';

const cfg = communityConfig.events;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion when read aloud

export const newCheckInCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export interface EventReward {
  userId: Types.ObjectId;
  eventId: Types.ObjectId;
  grant: GrantedReward;
}

function statusOf(e: Pick<EventDoc, 'startsAt' | 'endsAt'>, now = new Date()): EventStatus {
  if (now < e.startsAt) return 'upcoming';
  if (now < e.endsAt) return 'live';
  return 'ended';
}

const sameId = (a: unknown, b: unknown) => String(a) === String(b);

export const EventService = {
  /** Upcoming and live events on campus, plus ones that ended in the last day. */
  async list(user: UserDoc): Promise<EventDTO[]> {
    const since = new Date(Date.now() - 24 * 36e5);
    const events = await CampusEvent.find({ campusId: user.campusId, endsAt: { $gt: since } })
      .sort({ startsAt: 1 })
      .limit(50);
    return this.toDTOs(events, user);
  },

  async get(user: UserDoc, id: string): Promise<EventDTO> {
    const event = await this.find(user, id);
    return (await this.toDTOs([event], user))[0];
  },

  async find(user: UserDoc, id: string, withCode = false): Promise<EventDoc> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('NOT_FOUND', 'Event not found.');
    const q = CampusEvent.findOne({ _id: id, campusId: user.campusId });
    const event = await (withCode ? q.select('+checkInCode') : q);
    if (!event) throw new AppError('NOT_FOUND', 'Event not found.');
    return event;
  },

  /** Students host their own events. They earn XP only; special cards come from official events. */
  async create(user: UserDoc, req: CreateEventRequest): Promise<EventDTO> {
    const level = XPService.levelFor(user.xp).level;
    if (level < cfg.hostMinLevel) throw new AppError('FORBIDDEN', `Reach level ${cfg.hostMinLevel} to host events.`);

    const now = Date.now();
    const startsAt = new Date(req.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new AppError('VALIDATION', 'Pick a valid start time.');
    if (startsAt.getTime() < now - 10 * 60_000) throw new AppError('VALIDATION', 'Events must start in the future.');
    if (startsAt.getTime() > now + cfg.maxDaysAhead * 864e5) {
      throw new AppError('VALIDATION', `Events can be scheduled up to ${cfg.maxDaysAhead} days ahead.`);
    }
    const endsAt = new Date(startsAt.getTime() + req.durationMinutes * 60_000);
    if (req.maxParticipants != null && req.maxParticipants < req.minParticipants) {
      throw new AppError('VALIDATION', 'Max participants must be at least the minimum.');
    }

    const hosted = await CampusEvent.countDocuments({ hostId: user._id, endsAt: { $gt: new Date() } });
    if (hosted >= cfg.maxHostedUpcoming) {
      throw new AppError('CONFLICT', `You're already hosting ${hosted} upcoming events.`);
    }

    const event = await CampusEvent.create({
      campusId: user.campusId,
      title: req.title,
      description: req.description ?? '',
      kind: req.kind,
      locationName: req.locationName,
      hostId: user._id,
      hostLabel: req.hostLabel ?? '',
      official: false,
      startsAt,
      endsAt,
      minParticipants: req.minParticipants,
      maxParticipants: req.maxParticipants ?? null,
      requiredDiscoveries: req.requiredDiscoveries ?? 0,
      reward: { xp: xpConfig.hostedEvent, cardId: null },
      checkInCode: newCheckInCode(),
      participants: [{ userId: user._id, joinedAt: new Date() }],
    });
    return this.get(user, String(event._id));
  },

  /** RSVP. Capacity is enforced atomically with a positional-existence guard. */
  async join(user: UserDoc, id: string): Promise<EventDTO> {
    const event = await this.find(user, id);
    if (statusOf(event) === 'ended') throw new AppError('CONFLICT', 'This event has ended.');
    if (XPService.levelFor(user.xp).level < event.minLevel) {
      throw new AppError('FORBIDDEN', `Reach level ${event.minLevel} to join this event.`);
    }
    await this.addParticipant(event, user._id, null);
    return this.get(user, id);
  },

  async leave(user: UserDoc, id: string): Promise<EventDTO> {
    const event = await this.find(user, id);
    if (sameId(event.hostId, user._id)) throw new AppError('CONFLICT', "Hosts can't leave their own event.");
    // Once checked in you're part of the group count, so leaving is only possible before that.
    await CampusEvent.updateOne(
      { _id: event._id },
      { $pull: { participants: { userId: user._id, checkedInAt: null } } },
    );
    return this.get(user, id);
  },

  /**
   * Check in with the code the host shares in person. Returns any rewards this unlocked, for
   * this student *and* everyone else (reaching the group minimum pays out the whole group).
   */
  async checkIn(user: UserDoc, id: string, code: string): Promise<{ event: EventDTO; rewards: EventReward[] }> {
    const event = await this.find(user, id, true);
    const now = new Date();
    if (now.getTime() < event.startsAt.getTime() - cfg.checkInEarlyMinutes * 60_000) {
      throw new AppError('CONFLICT', `Check-in opens ${cfg.checkInEarlyMinutes} minutes before the event starts.`);
    }
    if (now >= event.endsAt) throw new AppError('CONFLICT', 'This event has ended.');
    if (XPService.levelFor(user.xp).level < event.minLevel) {
      throw new AppError('FORBIDDEN', `Reach level ${event.minLevel} to join this event.`);
    }
    if (code.trim().toUpperCase() !== event.checkInCode) {
      throw new AppError('VALIDATION', "That code doesn't match. Ask the host for the check-in code.");
    }

    const me = event.participants.find((p) => sameId(p.userId, user._id));
    if (!me) await this.addParticipant(event, user._id, now);
    else if (!me.checkedInAt) {
      await CampusEvent.updateOne(
        { _id: event._id, participants: { $elemMatch: { userId: user._id, checkedInAt: null } } },
        { $set: { 'participants.$.checkedInAt': now } },
      );
    }

    const rewards = await this.evaluate(event._id);
    return { event: await this.get(user, id), rewards };
  },

  async addParticipant(event: EventDoc, userId: Types.ObjectId, checkedInAt: Date | null) {
    const filter: Record<string, unknown> = { _id: event._id, 'participants.userId': { $ne: userId } };
    if (event.maxParticipants) filter[`participants.${event.maxParticipants - 1}`] = { $exists: false };
    const res = await CampusEvent.updateOne(filter, {
      $push: { participants: { userId, joinedAt: new Date(), checkedInAt } },
    });
    if (res.modifiedCount === 0 && !(await CampusEvent.exists({ _id: event._id, 'participants.userId': userId }))) {
      throw new AppError('CONFLICT', 'This event is full.');
    }
  },

  /**
   * Pay out the group reward to every checked-in participant who qualifies:
   *  - at least `minParticipants` students have checked in, and
   *  - they made `requiredDiscoveries` discoveries between check-in and the event's end.
   * Each payout is claimed with a conditional update, so it happens exactly once.
   */
  async evaluate(eventId: Types.ObjectId, onlyUserId?: Types.ObjectId): Promise<EventReward[]> {
    const event = await CampusEvent.findById(eventId);
    if (!event) return [];
    const checkedIn = event.participants.filter((p) => p.checkedInAt);
    if (checkedIn.length < event.minParticipants) return [];

    const results: EventReward[] = [];
    for (const p of checkedIn) {
      if (p.rewardedAt || (onlyUserId && !sameId(p.userId, onlyUserId))) continue;
      if (event.requiredDiscoveries > 0) {
        const made = await Discovery.countDocuments({
          userId: p.userId,
          createdAt: { $gte: p.checkedInAt, $lte: event.endsAt },
        });
        if (made < event.requiredDiscoveries) continue;
      }
      const claim = await CampusEvent.updateOne(
        { _id: event._id, participants: { $elemMatch: { userId: p.userId, rewardedAt: null } } },
        { $set: { 'participants.$.rewardedAt': new Date() } },
      );
      if (claim.modifiedCount !== 1) continue;

      await User.updateOne({ _id: p.userId }, { $inc: { 'stats.eventsAttended': 1 } });
      const grant = await GrantService.grant(p.userId, {
        source: 'event',
        sourceId: event._id,
        title: event.title,
        headline: 'GROUP EVENT COMPLETE!',
        xp: event.reward?.xp ?? 0,
        cardId: event.reward?.cardId ?? null,
        via: 'event',
      });
      results.push({ userId: p.userId, eventId: event._id, grant });
    }
    return results;
  },

  /** A discovery may satisfy "make N discoveries at the event" for events you're checked in to. */
  async onDiscovery(userId: Types.ObjectId, a: Extract<Activity, { type: 'discovery' }>, out: ProgressCollector) {
    const events = await CampusEvent.find({
      participants: { $elemMatch: { userId, checkedInAt: { $ne: null, $lte: a.at }, rewardedAt: null } },
      endsAt: { $gte: a.at },
    }).select('_id');
    for (const e of events) {
      for (const r of await this.evaluate(e._id, userId)) {
        out.reward(r.grant);
        out.followUp({ type: 'event_attended', key: `event:${r.eventId}`, eventId: r.eventId });
      }
    }
  },

  async toDTOs(events: EventDoc[], viewer: UserDoc): Promise<EventDTO[]> {
    if (!events.length) return [];
    const attendeeIds = [...new Set(events.flatMap((e) => [...e.participants.map((p) => String(p.userId)), e.hostId && String(e.hostId)]))]
      .filter(Boolean) as string[];
    const [users, minis, withCodes] = await Promise.all([
      User.find({ _id: { $in: attendeeIds } }).select('username displayName xp'),
      cardMinis(events.map((e) => e.reward?.cardId).filter(Boolean) as Types.ObjectId[]),
      // Codes only for events the viewer hosts.
      CampusEvent.find({ _id: { $in: events.filter((e) => sameId(e.hostId, viewer._id)).map((e) => e._id) } }).select(
        '+checkInCode',
      ),
    ]);
    const summaries = new Map(users.map((u) => [String(u._id), UserService.toSummary(u)]));
    const codes = new Map(withCodes.map((e) => [String(e._id), e.checkInCode]));

    const mine = new Map<string, number>();
    await Promise.all(
      events.map(async (e) => {
        const p = e.participants.find((x) => sameId(x.userId, viewer._id));
        if (p?.checkedInAt && !p.rewardedAt) {
          mine.set(
            String(e._id),
            await Discovery.countDocuments({ userId: viewer._id, createdAt: { $gte: p.checkedInAt, $lte: e.endsAt } }),
          );
        }
      }),
    );

    return events.map((e) => {
      const me = e.participants.find((p) => sameId(p.userId, viewer._id));
      const checkedIn = e.participants.filter((p) => p.checkedInAt).length;
      // Checked-in people first: "who's actually here".
      const attendees = [...e.participants]
        .sort((a, b) => Number(!!b.checkedInAt) - Number(!!a.checkedInAt))
        .map((p) => summaries.get(String(p.userId)))
        .filter(Boolean)
        .slice(0, 12) as EventDTO['attendees'];
      return {
        id: String(e._id),
        title: e.title,
        description: e.description,
        kind: e.kind as EventDTO['kind'],
        locationName: e.locationName,
        host: e.hostId ? (summaries.get(String(e.hostId)) ?? null) : null,
        hostLabel: e.hostLabel,
        official: e.official,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        status: statusOf(e),
        minParticipants: e.minParticipants,
        maxParticipants: e.maxParticipants ?? null,
        requiredDiscoveries: e.requiredDiscoveries,
        minLevel: e.minLevel,
        going: e.participants.length,
        checkedIn,
        groupUnlocked: checkedIn >= e.minParticipants,
        attendees,
        reward: { xp: e.reward?.xp ?? 0, card: e.reward?.cardId ? (minis.get(String(e.reward.cardId)) ?? null) : null },
        me: {
          joined: !!me,
          checkedIn: !!me?.checkedInAt,
          rewarded: !!me?.rewardedAt,
          isHost: sameId(e.hostId, viewer._id),
          discoveriesSinceCheckIn: me?.rewardedAt ? e.requiredDiscoveries : (mine.get(String(e._id)) ?? 0),
        },
        checkInCode: codes.get(String(e._id)) ?? null,
      };
    });
  },
};
