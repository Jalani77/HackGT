import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { RARITY_DISPLAY, rarityRank } from '@shared/rarity';
import type { CardDTO, DiscoveryResult, GrantedReward, LevelUpDTO, ProgressUpdate } from '@shared/types';
import { ProgressList } from '../progress/ProgressList';
import { CollectibleCard } from './CollectibleCard';
import { RarityBadge } from './RarityBadge';

type Stage = 'intro' | 'charge' | 'revealed';

/** Everything the reveal shows. Built from a photo discovery or from a mission/event/route reward. */
export interface RevealModel {
  card: CardDTO;
  imageUrl: string;
  headline: string;
  /** Where it came from, e.g. the mission title. */
  subtitle?: string;
  xp: { awarded: number; breakdown: { reason: string; amount: number }[] };
  levelUp?: LevelUpDTO | null;
  /** Missions/routes/achievements this advanced (shown under the card). */
  progress?: ProgressUpdate | null;
  isDuplicate?: boolean;
  isFirstOnCampus?: boolean;
  /** Confidence (0–1) when the AI wasn't sure; null otherwise. */
  lowConfidence?: number | null;
  mockAi?: boolean;
  doneLabel: string;
}

export function revealFromDiscovery(r: DiscoveryResult): RevealModel {
  return {
    card: r.card,
    imageUrl: r.copy.imageUrl,
    headline: r.isDuplicate ? 'DUPLICATE DISCOVERY' : 'DISCOVERY FOUND!',
    xp: r.xp,
    levelUp: r.levelUp,
    // Rewards get their own reveal afterwards; only the ticks and badges go under this card.
    progress: { ...r.progress, rewards: [] },
    isDuplicate: r.isDuplicate,
    isFirstOnCampus: r.isFirstOnCampus,
    lowConfidence: r.lowConfidence ? r.confidence : null,
    mockAi: r.aiProvider === 'mock',
    doneLabel: 'Keep exploring',
  };
}

/** Special-card reward reveal (mission/event/route/perk). Null for XP-only rewards. */
export function revealFromGrant(g: GrantedReward): RevealModel | null {
  if (!g.card || !g.copy) return null;
  return {
    card: g.card,
    imageUrl: g.copy.imageUrl,
    headline: g.headline,
    subtitle: g.title,
    xp: { awarded: g.xp, breakdown: g.xp ? [{ reason: g.title, amount: g.xp }] : [] },
    doneLabel: 'Awesome!',
  };
}

interface Props {
  reveal: RevealModel;
  onDone: () => void;
  onViewCard: (cardId: string) => void;
}

/**
 * Rarity-driven reveal: DISCOVERY FOUND! → charged card back → flip + burst → XP & details.
 * Intensity (timing, shake, particles, rays, full-screen) scales with rarity rank, so it
 * works for any card the AI produces. Tap anywhere to skip ahead.
 */
export function CardReveal({ reveal: result, onDone, onViewCard }: Props) {
  const { card } = result;
  const rank = rarityRank(card.rarity);
  const d = RARITY_DISPLAY[card.rarity];
  const mythic = card.rarity === 'MYTHIC';
  const [stage, setStage] = useState<Stage>('intro');

  useEffect(() => {
    if (stage === 'intro') {
      const t = setTimeout(() => setStage('charge'), 1000 + rank * 120);
      return () => clearTimeout(t);
    }
    if (stage === 'charge') {
      const t = setTimeout(() => setStage('revealed'), 700 + rank * 300);
      return () => clearTimeout(t);
    }
  }, [stage, rank]);

  const skip = () => stage !== 'revealed' && setStage('revealed');

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={skip}
      style={{
        background: mythic
          ? `radial-gradient(circle at 50% 38%, ${d.color}66, #1a0616 45%, #05020a 100%)`
          : `radial-gradient(circle at 50% 38%, ${d.glow.replace(/[\d.]+\)$/, '0.28)')}, #07070dee 60%)`,
        backdropFilter: 'blur(14px)',
      }}
    >
      {rank >= 3 && <LightRays color={d.color} intense={rank >= 4} />}

      <div className="relative flex w-full max-w-sm flex-1 flex-col items-center px-6 pt-safe pb-safe">
        {/* Headline */}
        <div className="flex h-24 items-end justify-center">
          <AnimatePresence mode="wait">
            {stage !== 'revealed' ? (
              <motion.h2
                key="found"
                className="text-center font-display text-3xl font-bold tracking-tight"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.15, 1], opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {result.headline}
                {result.subtitle && <div className="mt-1 text-base font-medium text-white/70">{result.subtitle}</div>}
              </motion.h2>
            ) : (
              <motion.div
                key="rarity"
                initial={{ scale: 2.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              >
                <RarityBadge rarity={card.rarity} size="lg" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Card with 3D flip */}
        <div className="relative mt-5 w-[72%] max-w-[270px]" style={{ perspective: 1200 }}>
          {stage === 'revealed' && <ParticleBurst color={d.color} count={[10, 14, 22, 32, 48, 72][rank]} />}
          <motion.div
            className="relative"
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 180, scale: 0.3, y: 80, opacity: 0 }}
            animate={
              stage === 'intro'
                ? { rotateY: 180, scale: 0.85, y: 0, opacity: 1 }
                : stage === 'charge'
                  ? {
                      rotateY: 180,
                      scale: 0.9,
                      opacity: 1,
                      y: 0,
                      x: rank >= 2 ? [0, -3 - rank, 3 + rank, -2 - rank, 2 + rank, 0] : 0,
                    }
                  : { rotateY: 0, scale: 1, y: 0, x: 0, opacity: 1 }
            }
            transition={
              stage === 'charge'
                ? { x: { duration: 0.35, repeat: Infinity }, default: { duration: 0.4 } }
                : { type: 'spring', stiffness: 120, damping: 14 }
            }
          >
            <div style={{ backfaceVisibility: 'hidden' }}>
              <CollectibleCard card={card} imageUrl={result.imageUrl} />
            </div>
            <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <CardBack color={d.color} charging={stage === 'charge'} rank={rank} />
            </div>
          </motion.div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {stage === 'revealed' && (
            <motion.div
              className="mt-6 flex w-full flex-col items-center gap-3 text-center"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              onClick={(e) => e.stopPropagation()}
            >
              {result.xp.awarded > 0 && <XPCounter amount={result.xp.awarded} />}
              <div className="flex flex-wrap justify-center gap-1.5">
                {result.xp.breakdown.map((b) => (
                  <span key={b.reason} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80">
                    {b.reason} +{b.amount}
                  </span>
                ))}
              </div>

              {result.levelUp && (
                <motion.div
                  className="w-full rounded-2xl bg-accent-2/15 px-4 py-3 ring-1 ring-accent-2/50"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: [0.8, 1.06, 1] }}
                  transition={{ delay: 1.2 }}
                >
                  <div className="font-display text-lg font-bold text-accent-2">LEVEL UP! → {result.levelUp.to}</div>
                  <div className="text-sm text-white/80">You're now a {result.levelUp.title}</div>
                  {result.levelUp.unlocks.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-left text-xs text-white/85">
                      {result.levelUp.unlocks.map((u) => (
                        <li key={u}>🔓 {u}</li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}

              {result.progress && <ProgressList progress={result.progress} />}

              {result.isFirstOnCampus && (
                <div className="text-sm font-semibold text-accent">🏆 First student on campus to discover this!</div>
              )}

              {result.isDuplicate && (
                <div className="w-full rounded-2xl bg-white/5 p-3 text-left text-sm ring-1 ring-white/10">
                  <div className="font-display font-bold">You already own this card.</div>
                  <div className="mt-1 text-white/70">
                    Duplicates are real copies you can trade with other students, keep in your collection, or use
                    toward missions.
                  </div>
                </div>
              )}

              {result.lowConfidence != null && (
                <div className="text-xs text-amber-300/90">
                  We aren't very confident about this one ({Math.round(result.lowConfidence * 100)}%). Try getting
                  closer next time.
                </div>
              )}

              <motion.div
                className="font-display text-sm font-bold tracking-widest text-accent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
              >
                ✓ ADDED TO COLLECTION
              </motion.div>

              <div className="w-full rounded-2xl bg-accent/10 p-4 text-left ring-1 ring-accent/30">
                <div className="font-display text-xs font-bold tracking-widest text-accent">FUN FACT</div>
                <p className="mt-1.5 leading-relaxed">{card.funFact}</p>
              </div>

              <div className="mt-1 flex w-full gap-3 pb-4">
                <button
                  onClick={() => onViewCard(card.id)}
                  className="flex-1 rounded-2xl bg-white/10 py-3.5 font-display font-bold ring-1 ring-white/15 active:scale-95"
                >
                  View card
                </button>
                <button
                  onClick={onDone}
                  className="flex-1 rounded-2xl py-3.5 font-display font-bold text-ink active:scale-95"
                  style={{ background: d.color }}
                >
                  {result.doneLabel}
                </button>
              </div>
              {result.mockAi && (
                <p className="pb-4 text-[11px] text-white/40">Dev mode: mock AI (set AI_API_KEY for real identification)</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {stage !== 'revealed' && <p className="mt-auto pb-6 text-xs text-white/40">Tap to reveal</p>}
      </div>
    </motion.div>
  );
}

function CardBack({ color, charging, rank }: { color: string; charging: boolean; rank: number }) {
  return (
    <motion.div
      className="flex aspect-[5/7] w-full items-center justify-center overflow-hidden rounded-[20px]"
      style={{
        background: `repeating-linear-gradient(45deg, #151522 0 12px, #1b1b2c 12px 24px)`,
        boxShadow: `inset 0 0 0 2px ${color}88`,
      }}
      animate={
        charging
          ? { boxShadow: [`inset 0 0 0 2px ${color}88, 0 0 10px ${color}`, `inset 0 0 0 3px ${color}, 0 0 ${30 + rank * 18}px ${color}`] }
          : undefined
      }
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
    >
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full font-display text-5xl font-bold"
        style={{ background: `${color}22`, color, boxShadow: `0 0 0 2px ${color}66` }}
      >
        ?
      </div>
    </motion.div>
  );
}

function ParticleBurst({ color, count }: { color: string; count: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 120 + Math.random() * 160;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 4 + Math.random() * 8,
          delay: Math.random() * 0.15,
          star: Math.random() > 0.6,
        };
      }),
    [count],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10">
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.star ? '#fff' : color,
            boxShadow: `0 0 12px ${color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
          transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

function LightRays({ color, intense }: { color: string; intense: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[38%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2"
      style={{
        background: `repeating-conic-gradient(from 0deg, ${color}${intense ? '30' : '18'} 0deg 8deg, transparent 8deg 22deg)`,
        maskImage: 'radial-gradient(circle, black 0%, transparent 55%)',
        WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 55%)',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: intense ? 18 : 30, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function XPCounter({ amount }: { amount: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setValue(Math.round(amount * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    const delay = setTimeout(() => (raf = requestAnimationFrame(tick)), 500);
    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
  }, [amount]);
  return <div className="font-display text-5xl font-bold text-accent drop-shadow-[0_0_20px_rgba(124,245,200,0.5)]">+{value} XP</div>;
}
