import { motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { EventDTO } from '@shared/types';
import { api } from '../api/client';
import { Bar, EVENT_ICON, formatWhen, RewardLine, SectionTitle } from '../components/progress/common';
import { StudentChip } from '../components/social/StudentChip';
import { useCelebrate } from '../context/CelebrationContext';
import { usePlayer } from '../context/PlayerContext';

export function EventDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { setPlayer, refresh } = usePlayer();
  const celebrate = useCelebrate();
  const [event, setEvent] = useState<EventDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.event(id).then(setEvent, (e) => setError(e.message));
  }, [id]);

  async function run(fn: () => Promise<EventDTO>) {
    setBusy(true);
    setError(null);
    try {
      setEvent(await fn());
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.checkIn(id, code);
      setEvent(res.data);
      setPlayer(res.player);
      setCode('');
      celebrate(res.progress, res.levelUp, { title: 'Checked in! 🎪' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!event) return <p className="p-10 text-center text-white/50">{error ?? 'Loading event…'}</p>;
  const e = event;
  const ended = e.status === 'ended';
  const needMore = Math.max(0, e.minParticipants - e.checkedIn);

  return (
    <div className="h-full overflow-y-auto">
      <div className="pt-safe mx-auto flex max-w-md flex-col gap-5 px-5 pb-10">
        <button onClick={() => navigate(-1)} className="self-start py-2 text-sm text-white/60">
          ← Back
        </button>

        <header>
          <div className="text-5xl">{EVENT_ICON[e.kind]}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold leading-tight">{e.title}</h1>
            {e.official && <span className="rounded-full bg-accent-2/20 px-2 py-0.5 text-[10px] font-bold text-accent-2">OFFICIAL</span>}
            {e.status === 'live' && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">● LIVE</span>}
          </div>
          <p className="mt-1 text-white/70">
            {formatWhen(e.startsAt)} – {new Date(e.endsAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </p>
          <p className="text-white/70">📍 {e.locationName}</p>
          {(e.hostLabel || e.host) && (
            <p className="mt-1 text-sm text-white/50">{e.hostLabel || `Hosted by ${e.host!.displayName}`}</p>
          )}
        </header>

        {e.description && <p className="leading-relaxed text-white/85">{e.description}</p>}

        {/* How the group reward works */}
        <section className="rounded-2xl bg-panel p-4 ring-1 ring-white/10">
          <SectionTitle>Group goal</SectionTitle>
          <ul className="mt-2 space-y-1 text-sm">
            <li>{e.checkedIn >= e.minParticipants ? '✅' : '⬜'} At least {e.minParticipants} explorers check in</li>
            {e.requiredDiscoveries > 0 && (
              <li>
                {e.me.discoveriesSinceCheckIn >= e.requiredDiscoveries ? '✅' : '⬜'} Each makes {e.requiredDiscoveries}{' '}
                discover{e.requiredDiscoveries > 1 ? 'ies' : 'y'} during the event
              </li>
            )}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <Bar value={e.checkedIn} target={e.minParticipants} className="flex-1" />
            <span className="font-display text-sm font-bold">
              {e.checkedIn}/{e.minParticipants} here
            </span>
          </div>
          {!e.groupUnlocked && !ended && (
            <p className="mt-2 text-xs text-white/55">
              {needMore} more check-in{needMore > 1 ? 's' : ''} to unlock the group reward. Bring a friend!
            </p>
          )}
          {e.groupUnlocked && !ended && <p className="mt-2 text-xs font-bold text-accent">Group unlocked! 🎉</p>}
          <div className="mt-3">
            <RewardLine xp={e.reward.xp} card={e.reward.card} />
          </div>
        </section>

        {/* Host: share the code in person */}
        {e.checkInCode && (
          <section className="rounded-2xl bg-accent-2/10 p-4 text-center ring-1 ring-accent-2/50">
            <SectionTitle>Your check-in code</SectionTitle>
            <div className="mt-2 font-display text-5xl font-bold tracking-[0.3em] text-accent-2">{e.checkInCode}</div>
            <p className="mt-2 text-xs text-white/60">
              Share it out loud at the meeting spot. Check-ins mean people actually showed up.
            </p>
          </section>
        )}

        {/* Me */}
        {e.me.rewarded ? (
          <div className="rounded-2xl bg-accent/15 p-4 text-center font-display font-bold text-accent ring-1 ring-accent/50">
            ✓ You completed this event
          </div>
        ) : e.me.checkedIn ? (
          <div className="rounded-2xl bg-accent/10 p-4 ring-1 ring-accent/40">
            <div className="font-display font-bold text-accent">✓ You're checked in</div>
            {e.requiredDiscoveries > 0 && (
              <>
                <p className="mt-1 text-sm text-white/75">
                  Your discoveries: {e.me.discoveriesSinceCheckIn}/{e.requiredDiscoveries}
                </p>
                <Link to="/" className="mt-3 block rounded-xl bg-accent py-2.5 text-center font-display font-bold text-ink">
                  📷 Go discover together
                </Link>
              </>
            )}
          </div>
        ) : (
          !ended && (
            <section className="flex flex-col gap-3">
              {!e.me.joined && (
                <button
                  onClick={() => run(() => api.joinEvent(id))}
                  disabled={busy}
                  className="rounded-2xl bg-white/10 py-3.5 font-display font-bold ring-1 ring-white/15 active:scale-95"
                >
                  🙋 I'm going
                </button>
              )}
              <form onSubmit={checkIn} className="rounded-2xl bg-panel p-4 ring-1 ring-white/10">
                <SectionTitle>At the event?</SectionTitle>
                <p className="mt-1 text-sm text-white/60">Ask the host for the check-in code.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={code}
                    onChange={(ev) => setCode(ev.target.value.toUpperCase())}
                    placeholder="CODE"
                    maxLength={12}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    className="min-w-0 flex-1 rounded-xl bg-white/8 px-4 py-3 text-center font-display text-xl tracking-[0.3em] outline-none ring-1 ring-white/10 focus:ring-accent/60"
                  />
                  <button
                    disabled={busy || code.trim().length < 3}
                    className="rounded-xl bg-accent px-5 font-display font-bold text-ink active:scale-95 disabled:opacity-40"
                  >
                    Check in
                  </button>
                </div>
              </form>
              {e.me.joined && !e.me.isHost && (
                <button onClick={() => run(() => api.leaveEvent(id))} disabled={busy} className="text-xs text-white/40 underline">
                  Can't make it anymore
                </button>
              )}
            </section>
          )
        )}

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

        <section>
          <SectionTitle>
            Who's coming ({e.going}
            {e.maxParticipants ? `/${e.maxParticipants}` : ''})
          </SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {e.attendees.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}>
                <StudentChip student={s} extra={i < e.checkedIn ? '✓ here' : `Lv ${s.level}`} />
              </motion.div>
            ))}
            {e.attendees.length === 0 && <p className="text-sm text-white/50">Be the first!</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
