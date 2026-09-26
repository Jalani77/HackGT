import { Types } from 'mongoose';
import type { CardCategory, DiscoveryResult, RecentDiscovery } from '../../../shared/types';
import type { Rarity } from '../../../shared/rarity';
import { discoveryConfig } from '../config/discovery.config';
import { env } from '../config/env';
import { xpConfig } from '../config/xp.config';
import { Discovery } from '../models/Discovery';
import { OwnedCard } from '../models/OwnedCard';
import { User, type UserDoc } from '../models/User';
import { AppError } from '../utils/AppError';
import { seasonOf, timeOfDayOf } from '../utils/gameEnvironment';
import { recognitionService, type ObjectAnalysis } from './ai';
import { CardService } from './CardService';
import { CollectionService, toCopyDTO } from './CollectionService';
import { ImageService } from './ImageService';
import { RarityService } from './RarityService';
import { storageService, type StoredObject } from './storage';
import { UserService } from './UserService';
import { XPService } from './XPService';

const isDuplicateKeyError = (e: unknown) => (e as { code?: number })?.code === 11000;

/**
 * The core pipeline:
 * image → validate/process → AI → gates → storage → card → rarity → copy → XP.
 */
export const DiscoveryService = {
  async analyze(params: { user: UserDoc; image: Buffer; clientCaptureId: string }): Promise<DiscoveryResult> {
    const { user, image, clientCaptureId } = params;

    // Idempotency: a retry after a dropped connection returns the original result.
    const previous = await Discovery.findOne({ userId: user._id, clientCaptureId });
    if (previous) return this.replay(previous._id, user);

    const processed = await ImageService.process(image);

    const now = new Date();
    const season = seasonOf(now);
    const timeOfDay = timeOfDayOf(now);

    const analysis = await this.recognize(processed.analysis, processed.mimeType, season);

    // Only after the photo passes every gate do we persist anything.
    const discoveryId = new Types.ObjectId();
    const copyId = new Types.ObjectId();
    const stored: StoredObject[] = [];
    try {
      const photo = await storageService.put(
        `discoveries/${user._id}/${discoveryId}.jpg`,
        processed.photo,
        processed.mimeType,
      );
      stored.push(photo);
      const art = await storageService.put(`cards/${discoveryId}.jpg`, processed.cardArt, processed.mimeType);
      stored.push(art);

      const initial = RarityService.score({
        commonness: analysis.commonness,
        category: analysis.category,
        priorDiscoveries: 0,
        confidence: analysis.confidence,
        isLandmark: analysis.isLandmark,
        currentSeason: season,
      });
      const { card: found, created } = await CardService.findOrCreate({
        campusId: user.campusId,
        analysis,
        imageUrl: art.url,
        discovererId: user._id,
        initialRarity: initial,
      });

      const [alreadyOwned, discoveredBefore, categorySeenBefore] = await Promise.all([
        CollectionService.ownsCard(user._id, found._id),
        Discovery.exists({ userId: user._id, cardId: found._id }),
        Discovery.exists({ userId: user._id, 'aiAnalysis.category': found.category }),
      ]);

      // Claim the idempotency key before side effects on the user (unique index).
      const xp = this.computeXP({
        rarity: found.rarity as Rarity,
        isDuplicate: alreadyOwned,
        isFirstOnCampus: created,
        isNewCategory: !categorySeenBefore,
      });
      try {
        await Discovery.create({
          _id: discoveryId,
          userId: user._id,
          cardId: found._id,
          copyId,
          clientCaptureId,
          photoUrl: photo.url,
          cardImageUrl: art.url,
          aiAnalysis: {
            provider: recognitionService.provider,
            model: recognitionService.model,
            ...analysis,
            category: found.category,
          },
          environment: { campusId: user.campusId, season, timeOfDay, capturedAt: now },
          xpAwarded: xp.awarded,
          isDuplicate: alreadyOwned,
          isFirstOnCampus: created,
        });
      } catch (e) {
        if (!isDuplicateKeyError(e)) throw e;
        // Concurrent retry won the race — clean up our images and return its result.
        await Promise.all(stored.map((s) => storageService.delete(s.key)));
        const winner = await Discovery.findOne({ userId: user._id, clientCaptureId });
        return this.replay(winner!._id, user);
      }

      const card = await CardService.recordDiscovery(found, {
        newDiscoverer: !discoveredBefore,
        confidence: analysis.confidence,
        season,
      });

      const copy = await CollectionService.addCopy({
        _id: copyId,
        ownerId: user._id,
        cardId: card._id,
        discoveryId,
        imageUrl: art.url,
        acquiredVia: 'discovery',
        xpAwarded: xp.awarded,
        environment: { season, timeOfDay },
      });

      await User.updateOne({ _id: user._id }, { $inc: { 'stats.discoveries': 1 } });
      const { levelUp } = await XPService.award(user._id, xp.awarded);
      const freshUser = (await User.findById(user._id))!;

      const [cardDTO] = await CardService.toDTOs([card]);
      return {
        discoveryId: String(discoveryId),
        card: cardDTO,
        copy: toCopyDTO(copy),
        isDuplicate: alreadyOwned,
        isFirstOnCampus: created,
        lowConfidence: analysis.confidence < discoveryConfig.warnConfidence,
        confidence: analysis.confidence,
        xp,
        levelUp,
        player: await UserService.toPublic(freshUser),
        aiProvider: recognitionService.provider,
      };
    } catch (e) {
      // If we failed before the discovery was recorded, don't leave orphaned images behind.
      if (!(await Discovery.exists({ _id: discoveryId }))) {
        await Promise.allSettled(stored.map((s) => storageService.delete(s.key)));
      }
      throw e;
    }
  },

  /** Run the AI and apply privacy + confidence gates. */
  async recognize(image: Buffer, mimeType: string, season: ReturnType<typeof seasonOf>): Promise<ObjectAnalysis> {
    let analysis: ObjectAnalysis;
    try {
      analysis = await recognitionService.analyzeImage({
        image,
        mimeType,
        context: {
          campusName: env.DEFAULT_CAMPUS_NAME,
          season,
          knownCardNames: await CardService.knownNames(env.DEFAULT_CAMPUS_ID, discoveryConfig.knownNamesForAI),
        },
      });
    } catch (e) {
      console.error('[ai] recognition failed:', e);
      throw new AppError('AI_FAILURE', "We couldn't identify this discovery. Try another photo.");
    }

    if (analysis.containsPersonAsSubject) {
      throw new AppError(
        'PERSON_DETECTED',
        "Looks like a person! We don't collect people — try photographing something around campus instead.",
      );
    }
    if (!analysis.identified || !analysis.name) {
      throw new AppError('NOT_IDENTIFIED', "We couldn't identify this discovery. Try another photo.");
    }
    if (analysis.confidence < discoveryConfig.minConfidence) {
      throw new AppError('LOW_CONFIDENCE', "We aren't very confident about this discovery. Try getting closer.");
    }
    return analysis;
  },

  computeXP(p: { rarity: Rarity; isDuplicate: boolean; isFirstOnCampus: boolean; isNewCategory: boolean }) {
    const breakdown: { reason: string; amount: number }[] = [];
    const base = xpConfig.discoveryByRarity[p.rarity];
    if (p.isDuplicate) {
      breakdown.push({ reason: 'Duplicate discovery', amount: Math.round(base * xpConfig.duplicateMultiplier) });
    } else {
      breakdown.push({ reason: 'New discovery', amount: base });
      if (p.isNewCategory) breakdown.push({ reason: 'New category', amount: xpConfig.newCategoryBonus });
    }
    if (p.isFirstOnCampus) breakdown.push({ reason: 'First on campus!', amount: xpConfig.firstOnCampusBonus });
    return { awarded: breakdown.reduce((s, b) => s + b.amount, 0), breakdown };
  },

  /** Rebuild a DiscoveryResult for an already-processed capture (idempotent retry). */
  async replay(discoveryId: Types.ObjectId, user: UserDoc): Promise<DiscoveryResult> {
    const d = (await Discovery.findById(discoveryId))!;
    const [card, copy, freshUser] = await Promise.all([
      CardService.getById(String(d.cardId)),
      OwnedCard.findById(d.copyId),
      User.findById(user._id),
    ]);
    if (!card || !copy || !freshUser) throw new AppError('NOT_FOUND', 'That discovery no longer exists.');
    const confidence = d.aiAnalysis?.confidence ?? 1;
    return {
      discoveryId: String(d._id),
      card,
      copy: toCopyDTO(copy),
      isDuplicate: d.isDuplicate,
      isFirstOnCampus: d.isFirstOnCampus,
      lowConfidence: confidence < discoveryConfig.warnConfidence,
      confidence,
      xp: { awarded: d.xpAwarded, breakdown: [{ reason: 'Discovery', amount: d.xpAwarded }] },
      levelUp: null,
      player: await UserService.toPublic(freshUser),
      aiProvider: d.aiAnalysis?.provider ?? 'unknown',
    };
  },

  async listMine(userId: Types.ObjectId, limit = 30): Promise<RecentDiscovery[]> {
    const items = await Discovery.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
    return items.map((d) => ({
      id: String(d._id),
      cardId: String(d.cardId),
      name: d.aiAnalysis?.name ?? '',
      category: d.aiAnalysis?.category as CardCategory,
      photoUrl: d.photoUrl,
      xpAwarded: d.xpAwarded,
      isDuplicate: d.isDuplicate,
      createdAt: d.createdAt.toISOString(),
    }));
  },
};
