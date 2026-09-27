import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import type { PublicUser } from '@shared/types';

const OBJECTIVE_LINK: Record<NonNullable<PublicUser['objective']>['kind'], (id: string) => string> = {
  event: (id) => `/events/${id}`,
  route: (id) => `/routes/${id}`,
  mission: () => '/quests',
};

/** Floating player HUD over the camera: level ring, XP progress, card count, current objective. */
export function CameraHUD({ player }: { player: PublicUser }) {
  const objective = player.objective;
  const { level, xp, currentLevelXp, nextLevelXp, title } = player.level;
  const progress = nextLevelXp ? (xp - currentLevelXp) / (nextLevelXp - currentLevelXp) : 1;
  const r = 20;
  const c = 2 * Math.PI * r;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 px-3 pt-safe">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 rounded-full bg-black/45 py-1.5 pl-1.5 pr-4 backdrop-blur-md">
          <div className="relative h-12 w-12">
            <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
              <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
              <motion.circle
                cx="24"
                cy="24"
                r={r}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={c}
                initial={false}
                animate={{ strokeDashoffset: c * (1 - progress) }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold">
              {level}
            </span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold">{player.displayName}</div>
            <div className="text-[11px] text-white/70">
              {title} · {nextLevelXp ? `${xp}/${nextLevelXp} XP` : `${xp} XP · MAX`}
            </div>
          </div>
        </div>

        <motion.div
          key={player.stats.cardsOwned}
          initial={{ scale: 1.4 }}
          animate={{ scale: 1 }}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-black/45 px-3.5 py-2.5 backdrop-blur-md"
        >
          <span className="text-base">🃏</span>
          <span className="font-display text-base font-bold">{player.stats.cardsOwned}</span>
        </motion.div>
      </div>

      {objective ? (
        <Link
          to={OBJECTIVE_LINK[objective.kind](objective.id)}
          className="pointer-events-auto max-w-[85%] self-start rounded-2xl bg-black/45 px-3 py-2 text-xs backdrop-blur-md active:scale-95"
        >
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-accent-2">OBJECTIVE</span>
            <span className="truncate text-white/85">
              {objective.icon} {objective.label}
            </span>
            {objective.target > 0 && (
              <span className="shrink-0 font-display font-bold">
                {objective.progress}/{objective.target}
              </span>
            )}
          </div>
          {objective.target > 0 && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-accent-2"
                style={{ width: `${Math.min(100, (objective.progress / objective.target) * 100)}%` }}
              />
            </div>
          )}
        </Link>
      ) : (
        <Link
          to="/quests"
          className="pointer-events-auto self-start rounded-2xl bg-black/45 px-3 py-2 text-xs backdrop-blur-md active:scale-95"
        >
          <span className="font-display font-bold text-accent-2">OBJECTIVE</span>
          <span className="ml-2 text-white/85">
            {player.stats.cardsOwned === 0 ? 'Photograph anything interesting around you' : 'Pick a mission →'}
          </span>
        </Link>
      )}
    </div>
  );
}
