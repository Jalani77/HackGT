import { motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { EventDTO, MissionDTO, RouteDTO } from '@shared/types';
import { api } from '../api/client';
import { Bar, EVENT_ICON, formatWhen, RewardLine, SectionTitle } from '../components/progress/common';
import { usePlayer } from '../context/PlayerContext';

type Tab = 'missions' | 'events' | 'routes';
const TABS: { id: Tab; label: string }[] = [
  { id: 'missions', label: '🎯 Missions' },
  { id: 'events', label: '🎪 Events' },
  { id: 'routes', label: '🥾 Routes' },
];

export function QuestsScreen() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'missions') as Tab;

  return (
    <div className="h-full overflow-y-auto">
      <header className="pt-safe sticky top-0 z-10 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <h1 className="font-display text-3xl font-bold">Quests</h1>
        <p className="text-sm text-white/60">Reasons to get outside, and people to go with.</p>
        <div className="mt-3 grid grid-cols-3 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setParams(t.id === 'missions' ? {} : { tab: t.id }, { replace: true })}
              className={`rounded-xl py-2 font-display text-sm font-bold transition ${
                tab === t.id ? 'bg-white text-ink' : 'text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>
      {tab === 'missions' && <Missions />}
      {tab === 'events' && <Events />}
      {tab === 'routes' && <Routes />}
    </div>
  );
}

// ─── Missions ─────────────────────────────────────────────

function Missions() {
  const { refresh } = usePlayer();
  const [missions, setMissions] = useState<MissionDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api.missions().then(setMissions, (e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(m: MissionDTO, action: 'join' | 'leave') {
    setBusy(m.id);
    setError(null);
    try {
      await (action === 'join' ? api.joinMission(m.id) : api.leaveMission(m.id));
      await Promise.all([load(), refresh()]); // HUD objective may change
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!missions) return <p className="py-10 text-center text-white/50">{error ?? 'Loading missions…'}</p>;
  const groups: { title: string; items: MissionDTO[] }[] = [
    { title: 'In progress', items: missions.filter((m) => m.status === 'active') },
    { title: 'Available', items: missions.filter((m) => m.status === 'available') },
    { title: 'Locked', items: missions.filter((m) => m.status === 'locked') },
    { title: 'Completed', items: missions.filter((m) => m.status === 'completed') },
  ];

  return (
    <div className="flex flex-col gap-6 px-4 pb-8">
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}
      {missions.length === 0 && <p className="py-8 text-center text-white/50">No missions are running right now.</p>}
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.title}>
            <SectionTitle>{g.title}</SectionTitle>
            <div className="mt-2 flex flex-col gap-3">
              {g.items.map((m, i) => (
                <MissionCard key={m.id} mission={m} index={i} busy={busy === m.id} onAct={act} />
              ))}
            </div>
          </section>
        ))}
      <p className="text-center text-xs text-white/40">
        Missions count what you do after you join them: discoveries, trades, events, and routes.
      </p>
    </div>
  );
}

function MissionCard({
  mission: m,
  index,
  busy,
  onAct,
}: {
  mission: MissionDTO;
  index: number;
  busy: boolean;
  onAct: (m: MissionDTO, a: 'join' | 'leave') => void;
}) {
  const locked = m.status === 'locked';
  const done = m.status === 'completed';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className={`rounded-2xl p-4 ring-1 ${
        m.status === 'active' ? 'bg-accent/8 ring-accent/40' : done ? 'bg-white/5 ring-white/10 opacity-70' : 'bg-panel ring-white/10'
      } ${locked ? 'opacity-55' : ''} ${busy ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{locked ? '🔒' : m.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold leading-tight">{m.title}</div>
          <p className="mt-0.5 text-sm text-white/70">{m.description}</p>
        </div>
        {done && <span className="text-xl text-accent">✓</span>}
      </div>

      {(m.status === 'active' || done) && (
        <div className="mt-3 flex items-center gap-3">
          <Bar value={m.progress} target={m.requirements.count} className="flex-1" />
          <span className="font-display text-sm font-bold">
            {m.progress}/{m.requirements.count}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <RewardLine xp={m.reward.xp} card={m.reward.card} />
        {m.endsAt && !done && <span className="text-[11px] text-amber-300/80">Ends {formatWhen(m.endsAt)}</span>}
      </div>

      {locked && <p className="mt-2 text-xs font-semibold text-white/60">Unlocks at level {m.minLevel}</p>}
      {m.status === 'available' && (
        <button
          onClick={() => onAct(m, 'join')}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 font-display font-bold text-ink active:scale-95"
        >
          Start mission
        </button>
      )}
      {m.status === 'active' && (
        <button onClick={() => onAct(m, 'leave')} disabled={busy} className="mt-2 text-xs text-white/40 underline">
          Drop mission
        </button>
      )}
    </motion.div>
  );
}

// ─── Events ───────────────────────────────────────────────

function Events() {
  const { player } = usePlayer();
  const [events, setEvents] = useState<EventDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.events().then(setEvents, (e) => setError(e.message));
  }, []);

  if (!events) return <p className="py-10 text-center text-white/50">{error ?? 'Loading events…'}</p>;
  const canHost = (player?.level.level ?? 1) >= 2;
  const live = events.filter((e) => e.status === 'live');
  const upcoming = events.filter((e) => e.status === 'upcoming');
  const ended = events.filter((e) => e.status === 'ended');

  return (
    <div className="flex flex-col gap-6 px-4 pb-8">
      {canHost ? (
        <Link to="/events/new" className="rounded-2xl bg-white/8 py-3 text-center font-display font-bold ring-1 ring-white/15 active:scale-95">
          📣 Host a group event
        </Link>
      ) : (
        <p className="rounded-2xl bg-white/5 p-3 text-center text-sm text-white/55">Reach level 2 to host your own events.</p>
      )}
      {events.length === 0 && <p className="py-6 text-center text-white/50">No events scheduled yet. Host one!</p>}
      {[
        { title: '🔴 Happening now', items: live },
        { title: 'Upcoming', items: upcoming },
        { title: 'Recently ended', items: ended },
      ]
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.title}>
            <SectionTitle>{g.title}</SectionTitle>
            <div className="mt-2 flex flex-col gap-3">
              {g.items.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

export function EventCard({ event: e }: { event: EventDTO }) {
  return (
    <Link
      to={`/events/${e.id}`}
      className={`block rounded-2xl p-4 ring-1 active:scale-[0.98] ${
        e.status === 'live' ? 'bg-accent/8 ring-accent/50' : 'bg-panel ring-white/10'
      } ${e.status === 'ended' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{EVENT_ICON[e.kind]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold leading-tight">{e.title}</span>
            {e.official && <span className="rounded-full bg-accent-2/20 px-2 py-0.5 text-[10px] font-bold text-accent-2">OFFICIAL</span>}
          </div>
          <div className="mt-0.5 text-sm text-white/70">
            {formatWhen(e.startsAt)} · 📍 {e.locationName}
          </div>
          <div className="mt-1 text-xs text-white/50">
            {e.hostLabel || (e.host ? `Hosted by ${e.host.displayName}` : '')}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <RewardLine xp={e.reward.xp} card={e.reward.card} />
        <span className="text-xs text-white/60">
          👥 {e.going} going{e.minParticipants > 1 && ` · needs ${e.minParticipants}`}
        </span>
      </div>
      {(e.me.joined || e.me.checkedIn || e.me.rewarded) && (
        <div className="mt-2 text-xs font-bold text-accent">
          {e.me.rewarded ? '✓ Completed' : e.me.checkedIn ? '✓ Checked in' : '✓ You’re going'}
        </div>
      )}
    </Link>
  );
}

// ─── Routes ───────────────────────────────────────────────

const DIFFICULTY_STYLE = { easy: 'text-accent', moderate: 'text-accent-2', hard: 'text-pink-300' } as const;

function Routes() {
  const { player } = usePlayer();
  const [routes, setRoutes] = useState<RouteDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.routes().then(setRoutes, (e) => setError(e.message));
  }, []);

  if (!routes) return <p className="py-10 text-center text-white/50">{error ?? 'Loading routes…'}</p>;
  const canCreate = (player?.level.level ?? 1) >= 2;
  const mine = routes.filter((r) => r.myRun?.status === 'active');
  const rest = routes.filter((r) => r.myRun?.status !== 'active');

  return (
    <div className="flex flex-col gap-6 px-4 pb-8">
      {canCreate ? (
        <Link to="/routes/new" className="rounded-2xl bg-white/8 py-3 text-center font-display font-bold ring-1 ring-white/15 active:scale-95">
          🗺️ Create a route for others
        </Link>
      ) : (
        <p className="rounded-2xl bg-white/5 p-3 text-center text-sm text-white/55">Reach level 2 to publish your own routes.</p>
      )}
      {mine.length > 0 && (
        <section>
          <SectionTitle>You're following</SectionTitle>
          <div className="mt-2 flex flex-col gap-3">
            {mine.map((r) => (
              <RouteCard key={r.id} route={r} />
            ))}
          </div>
        </section>
      )}
      <section>
        <SectionTitle>Explore campus</SectionTitle>
        <div className="mt-2 flex flex-col gap-3">
          {rest.length === 0 && <p className="text-sm text-white/50">No routes yet.</p>}
          {rest.map((r) => (
            <RouteCard key={r.id} route={r} />
          ))}
        </div>
      </section>
    </div>
  );
}

function RouteCard({ route: r }: { route: RouteDTO }) {
  const active = r.myRun?.status === 'active';
  return (
    <Link
      to={`/routes/${r.id}`}
      className={`block rounded-2xl p-4 ring-1 active:scale-[0.98] ${active ? 'bg-accent/8 ring-accent/50' : 'bg-panel ring-white/10'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold leading-tight">{r.title}</span>
            {r.official && <span className="rounded-full bg-accent-2/20 px-2 py-0.5 text-[10px] font-bold text-accent-2">OFFICIAL</span>}
            {r.completedByMe && <span className="text-xs font-bold text-accent">✓ Done</span>}
          </div>
          <div className="mt-0.5 text-xs text-white/55">
            {r.creator ? `by ${r.creator.displayName}` : 'Campus Quest'} · {r.checkpoints.length} stops
            {r.estMinutes ? ` · ~${r.estMinutes} min` : ''}
            {r.distanceM ? ` · ${(r.distanceM / 1000).toFixed(1)} km` : ''}
          </div>
        </div>
        <span className={`shrink-0 text-xs font-bold uppercase ${DIFFICULTY_STYLE[r.difficulty]}`}>{r.difficulty}</span>
      </div>

      {/* START → checkpoints → END, Strava-style */}
      <div className="mt-3 flex items-center gap-1 overflow-hidden">
        {r.checkpoints.map((c, i) => {
          const hit = active && i < (r.myRun?.done ?? 0);
          return (
            <div key={c.order} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ring-2 ${hit ? 'bg-accent ring-accent' : 'bg-transparent ring-white/30'}`}
              />
              {i < r.checkpoints.length - 1 && <span className={`h-0.5 flex-1 ${hit ? 'bg-accent' : 'bg-white/15'}`} />}
            </div>
          );
        })}
      </div>
      {active && (
        <div className="mt-2 text-xs font-bold text-accent">
          {r.myRun!.done}/{r.checkpoints.length} · next: {r.checkpoints[r.myRun!.done]?.label}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <RewardLine xp={r.reward.xp} card={r.reward.card} />
        <span className="text-xs text-white/50">🏁 {r.stats.completions}</span>
      </div>
    </Link>
  );
}
