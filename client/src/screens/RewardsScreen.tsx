import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RewardDTO } from '@shared/types';
import { api } from '../api/client';
import { SectionTitle } from '../components/progress/common';
import { MiniCard } from '../components/social/MiniCard';
import { XPBar } from '../components/XPBar';
import { useCelebrate } from '../context/CelebrationContext';
import { usePlayer } from '../context/PlayerContext';

export function RewardsScreen() {
  const navigate = useNavigate();
  const { player, setPlayer } = usePlayer();
  const celebrate = useCelebrate();
  const [rewards, setRewards] = useState<RewardDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.rewards().then(setRewards, (e) => setError(e.message));
  }, []);

  async function redeem(r: RewardDTO) {
    setBusy(r.id);
    setError(null);
    try {
      const res = await api.redeem(r.id);
      setRewards((list) => list?.map((x) => (x.id === r.id ? res.data.reward : x)) ?? null);
      setPlayer(res.player);
      celebrate(res.progress, res.levelUp, { title: 'Reward claimed!' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!rewards || !player) return <p className="p-10 text-center text-white/50">{error ?? 'Loading rewards…'}</p>;
  const unlocked = rewards.filter((r) => r.unlocked);
  const locked = rewards.filter((r) => !r.unlocked);

  return (
    <div className="h-full overflow-y-auto">
      <div className="pt-safe mx-auto flex max-w-md flex-col gap-6 px-5 pb-10">
        <button onClick={() => navigate(-1)} className="self-start py-2 text-sm text-white/60">
          ← Back
        </button>
        <header>
          <h1 className="font-display text-3xl font-bold">Student deals</h1>
          <p className="text-sm text-white/60">Level up by exploring to unlock perks from campus partners.</p>
          <div className="mt-3">
            <XPBar level={player.level} />
          </div>
        </header>

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

        {unlocked.length > 0 && (
          <section>
            <SectionTitle>Unlocked</SectionTitle>
            <div className="mt-2 flex flex-col gap-3">
              {unlocked.map((r, i) => (
                <RewardCard key={r.id} reward={r} index={i} busy={busy === r.id} onRedeem={() => redeem(r)} />
              ))}
            </div>
          </section>
        )}
        {locked.length > 0 && (
          <section>
            <SectionTitle>Keep exploring to unlock</SectionTitle>
            <div className="mt-2 flex flex-col gap-3">
              {locked.map((r, i) => (
                <RewardCard key={r.id} reward={r} index={i} currentLevel={player.level.level} />
              ))}
            </div>
          </section>
        )}
        <p className="text-center text-xs text-white/40">Demo deals for the hackathon. Real partner offers plug into the same system.</p>
      </div>
    </div>
  );
}

function RewardCard({
  reward: r,
  index,
  busy,
  onRedeem,
  currentLevel,
}: {
  reward: RewardDTO;
  index: number;
  busy?: boolean;
  onRedeem?: () => void;
  currentLevel?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-2xl p-4 ring-1 ${r.unlocked ? 'bg-panel ring-accent-2/40' : 'bg-white/5 ring-white/10 opacity-60'}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{r.unlocked ? r.icon : '🔒'}</span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg font-bold leading-tight">{r.title}</div>
          <div className="text-xs font-semibold text-accent-2">{r.partner}</div>
          <p className="mt-1 text-sm text-white/70">{r.description}</p>
        </div>
        {r.card && <MiniCard card={r.card} size={44} highlight={r.unlocked} />}
      </div>

      {!r.unlocked && (
        <p className="mt-3 text-xs font-semibold text-white/60">
          Unlocks at level {r.minLevel}
          {currentLevel ? ` (you're level ${currentLevel})` : ''}
        </p>
      )}
      {r.unlocked && r.redemption && (
        <div className="mt-3 rounded-xl bg-accent/10 p-3 text-center ring-1 ring-accent/40">
          {r.type === 'collectible' ? (
            <div className="font-display font-bold text-accent">✓ Added to your collection</div>
          ) : (
            <>
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/50">Show this code</div>
              <div className="mt-1 font-display text-2xl font-bold tracking-wider text-accent">{r.redemption.code}</div>
            </>
          )}
          <div className="mt-1 text-[11px] text-white/45">Claimed {new Date(r.redemption.redeemedAt).toLocaleDateString()}</div>
        </div>
      )}
      {r.unlocked && !r.redemption && onRedeem && (
        <button
          onClick={onRedeem}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-accent-2 py-2.5 font-display font-bold text-ink active:scale-95 disabled:opacity-40"
        >
          {busy ? 'Claiming…' : r.type === 'collectible' ? 'Claim collectible' : 'Redeem'}
        </button>
      )}
      {r.expiresAt && <p className="mt-2 text-[11px] text-amber-300/80">Expires {new Date(r.expiresAt).toLocaleDateString()}</p>}
    </motion.div>
  );
}
