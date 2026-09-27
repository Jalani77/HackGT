import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GrantedReward, LevelUpDTO, ProgressUpdate } from '@shared/types';
import { CardReveal, revealFromGrant, type RevealModel } from '../components/cards/CardReveal';
import { ProgressList } from '../components/progress/ProgressList';

type Moment =
  | { kind: 'card'; reveal: RevealModel }
  | { kind: 'xp'; grant: GrantedReward }
  | { kind: 'summary'; progress: ProgressUpdate; levelUp: LevelUpDTO | null; title: string };

interface CelebrateOptions {
  /** Show a summary sheet for ticks/achievements/level-up (off when the caller already shows them). */
  summary?: boolean;
  title?: string;
}

interface CelebrationValue {
  /** Queue the reward moments from any action: special-card reveals, XP rewards, then a summary. */
  celebrate: (progress: ProgressUpdate | null | undefined, levelUp?: LevelUpDTO | null, opts?: CelebrateOptions) => void;
}

const CelebrationContext = createContext<CelebrationValue | null>(null);

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<Moment[]>([]);

  const celebrate = useCallback<CelebrationValue['celebrate']>((progress, levelUp = null, opts = {}) => {
    if (!progress && !levelUp) return;
    const moments: Moment[] = [];
    for (const g of progress?.rewards ?? []) {
      const reveal = revealFromGrant(g);
      moments.push(reveal ? { kind: 'card', reveal } : { kind: 'xp', grant: g });
    }
    const hasSummary =
      !!levelUp || !!progress?.missions.length || !!progress?.routes.length || !!progress?.achievements.length;
    if ((opts.summary ?? true) && hasSummary && progress) {
      moments.push({ kind: 'summary', progress: { ...progress, rewards: [] }, levelUp, title: opts.title ?? 'Progress!' });
    }
    if (moments.length) setQueue((q) => [...q, ...moments]);
  }, []);

  const next = () => setQueue((q) => q.slice(1));
  const current = queue[0];

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      <AnimatePresence mode="wait">
        {current?.kind === 'card' && (
          <CardReveal
            key={`card-${queue.length}`}
            reveal={current.reveal}
            onDone={next}
            onViewCard={(id) => {
              next();
              navigate(`/card/${id}`);
            }}
          />
        )}
        {current?.kind === 'xp' && <XpMoment key={`xp-${queue.length}`} grant={current.grant} onDone={next} />}
        {current?.kind === 'summary' && (
          <SummarySheet key={`sum-${queue.length}`} moment={current} onDone={next} />
        )}
      </AnimatePresence>
    </CelebrationContext.Provider>
  );
}

export function useCelebrate() {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebrate must be used inside CelebrationProvider');
  return ctx.celebrate;
}

function XpMoment({ grant, onDone }: { grant: GrantedReward; onDone: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/90 px-8 text-center backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
    >
      <motion.div
        className="font-display text-3xl font-bold"
        initial={{ scale: 0.4 }}
        animate={{ scale: [0.4, 1.15, 1] }}
      >
        {grant.headline}
      </motion.div>
      <div className="mt-2 text-white/70">{grant.title}</div>
      <motion.div
        className="mt-6 font-display text-6xl font-bold text-accent drop-shadow-[0_0_24px_rgba(124,245,200,0.5)]"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
      >
        +{grant.xp} XP
      </motion.div>
      <p className="mt-10 text-xs text-white/40">Tap to continue</p>
    </motion.div>
  );
}

function SummarySheet({ moment, onDone }: { moment: Extract<Moment, { kind: 'summary' }>; onDone: () => void }) {
  const { progress, levelUp, title } = moment;
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDone}
    >
      <motion.div
        className="pb-safe mx-auto max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-panel px-5 pt-5"
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        transition={{ type: 'spring', damping: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {levelUp && (
          <div className="mt-3 rounded-2xl bg-accent-2/15 p-4 ring-1 ring-accent-2/50">
            <div className="font-display text-xl font-bold text-accent-2">LEVEL UP! → {levelUp.to}</div>
            <div className="text-sm text-white/80">You're now a {levelUp.title}</div>
            {levelUp.unlocks.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-sm text-white/85">
                {levelUp.unlocks.map((u) => (
                  <li key={u}>🔓 {u}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-3">
          <ProgressList progress={progress} />
        </div>
        <button
          onClick={onDone}
          className="mb-4 mt-4 w-full rounded-2xl bg-accent py-3.5 font-display font-bold text-ink active:scale-95"
        >
          Nice!
        </button>
      </motion.div>
    </motion.div>
  );
}
