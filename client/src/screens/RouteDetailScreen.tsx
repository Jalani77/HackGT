import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RouteDTO } from '@shared/types';
import { api } from '../api/client';
import { CATEGORY_ICON } from '../components/cards/categoryIcons';
import { RewardLine, SectionTitle } from '../components/progress/common';
import { MiniCard } from '../components/social/MiniCard';
import { StudentChip } from '../components/social/StudentChip';
import { usePlayer } from '../context/PlayerContext';

export function RouteDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { refresh } = usePlayer();
  const [route, setRoute] = useState<RouteDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.route(id).then(setRoute, (e) => setError(e.message));
  }, [id]);

  async function act(fn: () => Promise<RouteDTO>) {
    setBusy(true);
    setError(null);
    try {
      setRoute(await fn());
      await refresh(); // HUD objective follows the route
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!route) return <p className="p-10 text-center text-white/50">{error ?? 'Loading route…'}</p>;
  const r = route;
  const active = r.myRun?.status === 'active';
  const done = active ? r.myRun!.done : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="pt-safe mx-auto flex max-w-md flex-col gap-5 px-5 pb-10">
        <button onClick={() => navigate(-1)} className="self-start py-2 text-sm text-white/60">
          ← Back
        </button>

        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold leading-tight">{r.title}</h1>
            {r.official && <span className="rounded-full bg-accent-2/20 px-2 py-0.5 text-[10px] font-bold text-accent-2">OFFICIAL</span>}
          </div>
          <p className="mt-1 text-sm text-white/60">
            {r.checkpoints.length} stops · {r.difficulty}
            {r.estMinutes ? ` · ~${r.estMinutes} min` : ''}
            {r.distanceM ? ` · ${(r.distanceM / 1000).toFixed(1)} km` : ''} · 🏁 {r.stats.completions} finished
          </p>
          {r.creator && (
            <div className="mt-2">
              <StudentChip student={r.creator} extra="creator" />
            </div>
          )}
        </header>

        {r.description && <p className="leading-relaxed text-white/85">{r.description}</p>}
        <RewardLine xp={r.reward.xp} card={r.reward.card} label={r.completedByMe ? 'Earned' : 'Reward'} />

        {/* Timeline */}
        <section>
          <SectionTitle>The route</SectionTitle>
          <ol className="relative mt-3 ml-3 border-l-2 border-white/15 pl-6">
            <li className="mb-5 font-display text-xs font-bold tracking-widest text-white/50">
              <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-white/30" />
              START
            </li>
            {r.checkpoints.map((c, i) => {
              const state = !active ? 'idle' : i < done ? 'done' : i === done ? 'next' : 'later';
              return (
                <motion.li
                  key={c.order}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative mb-5"
                >
                  <span
                    className={`absolute -left-[35px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ${
                      state === 'done'
                        ? 'bg-accent text-ink ring-accent'
                        : state === 'next'
                          ? 'bg-ink text-accent-2 ring-accent-2 shadow-[0_0_12px_var(--color-accent-2)]'
                          : 'bg-ink text-white/60 ring-white/25'
                    }`}
                  >
                    {state === 'done' ? '✓' : i + 1}
                  </span>
                  <div
                    className={`rounded-2xl p-3 ring-1 ${
                      state === 'next' ? 'bg-accent-2/10 ring-accent-2/50' : 'bg-panel ring-white/10'
                    } ${state === 'done' ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {c.card ? (
                        <MiniCard card={c.card} size={42} highlight={state === 'next'} />
                      ) : (
                        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-lg bg-white/8 text-2xl">
                          {c.category ? CATEGORY_ICON[c.category] : '✨'}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{c.label}</div>
                        <div className="text-xs text-white/55">
                          Photograph {c.card ? <b>{c.card.name}</b> : c.category ? `any ${c.category.toLowerCase()}` : 'anything interesting'}
                          {c.area && ` · 📍 ${c.area}`}
                        </div>
                      </div>
                    </div>
                    {c.hint && <p className="mt-2 text-xs italic text-white/60">💡 {c.hint}</p>}
                  </div>
                </motion.li>
              );
            })}
            <li className="font-display text-xs font-bold tracking-widest text-white/50">
              <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-accent-2" />
              FINISH 🏁
            </li>
          </ol>
        </section>

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

        {active ? (
          <div className="flex flex-col gap-2">
            <Link to="/" className="rounded-2xl bg-accent py-3.5 text-center font-display text-lg font-bold text-ink active:scale-95">
              📷 Find stop {done + 1}: {r.checkpoints[done]?.label}
            </Link>
            <button onClick={() => act(() => api.abandonRoute(id))} disabled={busy} className="text-xs text-white/40 underline">
              Stop following this route
            </button>
          </div>
        ) : (
          <button
            onClick={() => act(() => api.startRoute(id))}
            disabled={busy}
            className="rounded-2xl bg-accent py-3.5 font-display text-lg font-bold text-ink active:scale-95 disabled:opacity-40"
          >
            {r.completedByMe ? '🔁 Walk it again' : '🥾 Start this route'}
          </button>
        )}
        {r.completedByMe && !active && (
          <p className="-mt-3 text-center text-xs text-white/45">You've finished this route. Replays are for fun (no second reward).</p>
        )}
        <p className="text-center text-xs text-white/40">Stops count in order. Take photos as you reach each one.</p>
      </div>
    </div>
  );
}
