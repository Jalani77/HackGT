import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RARITY_DISPLAY, RARITY_TIERS, rarityRank, type Rarity } from '@shared/rarity';
import type { CollectionResponse } from '@shared/types';
import { api } from '../api/client';
import { CollectibleCard } from '../components/cards/CollectibleCard';
import { usePlayer } from '../context/PlayerContext';

type Sort = 'recent' | 'rarity' | 'category';

export function CollectionScreen() {
  const { player, logout } = usePlayer();
  const [data, setData] = useState<CollectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rarity, setRarity] = useState<Rarity | 'ALL'>('ALL');
  const [sort, setSort] = useState<Sort>('recent');
  const [q, setQ] = useState('');
  const [dupesOnly, setDupesOnly] = useState(false);

  useEffect(() => {
    api.collection().then(setData, (e) => setError(e.message));
  }, []);

  const entries = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const list = data.entries.filter(
      (e) =>
        (rarity === 'ALL' || e.card.rarity === rarity) &&
        (!dupesOnly || e.copies.length > 1) &&
        (!needle || e.card.name.toLowerCase().includes(needle) || e.card.category.toLowerCase().includes(needle)),
    );
    if (sort === 'rarity') return [...list].sort((a, b) => rarityRank(b.card.rarity) - rarityRank(a.card.rarity));
    if (sort === 'category') return [...list].sort((a, b) => a.card.category.localeCompare(b.card.category));
    return list;
  }, [data, rarity, sort, q, dupesOnly]);

  return (
    <div className="h-full overflow-y-auto">
      <header className="pt-safe sticky top-0 z-10 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Collection</h1>
            {data && (
              <p className="text-sm text-white/60">
                {data.totals.uniqueOwned} unique · {data.totals.copies} {data.totals.copies === 1 ? 'card' : 'cards'} ·{' '}
                {data.totals.completion}% of campus
              </p>
            )}
          </div>
          <button onClick={logout} className="text-xs text-white/40 underline">
            Log out {player?.username}
          </button>
        </div>

        {data && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
              initial={{ width: 0 }}
              animate={{ width: `${data.totals.completion}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search cards…"
            className="min-w-0 flex-1 rounded-xl bg-white/8 px-3.5 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-accent/60"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-xl bg-white/8 px-3 text-sm ring-1 ring-white/10"
          >
            <option value="recent">Recent</option>
            <option value="rarity">Rarity</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip active={rarity === 'ALL'} onClick={() => setRarity('ALL')}>
            All
          </Chip>
          {RARITY_TIERS.map((r) => (
            <Chip key={r} active={rarity === r} color={RARITY_DISPLAY[r].color} onClick={() => setRarity(r)}>
              {RARITY_DISPLAY[r].label}
            </Chip>
          ))}
          <Chip active={dupesOnly} onClick={() => setDupesOnly((d) => !d)}>
            Duplicates
          </Chip>
        </div>
      </header>

      {error && <p className="p-6 text-center text-red-300">{error}</p>}
      {!data && !error && <p className="p-10 text-center text-white/50">Loading your deck…</p>}

      {data && data.entries.length === 0 && (
        <div className="flex flex-col items-center gap-4 px-10 py-16 text-center">
          <div className="text-6xl">🧭</div>
          <p className="font-display text-xl font-bold">Your deck is empty</p>
          <p className="text-sm text-white/60">Head outside and photograph something. Every discovery becomes a card.</p>
          <Link to="/" className="rounded-2xl bg-accent px-6 py-3.5 font-display font-bold text-ink">
            Start exploring
          </Link>
        </div>
      )}

      {data && data.entries.length > 0 && entries.length === 0 && (
        <p className="p-10 text-center text-white/50">No cards match these filters.</p>
      )}

      <div className="grid grid-cols-2 gap-3 px-4 pb-8 pt-2 sm:grid-cols-3 md:grid-cols-4">
        {entries.map((e, i) => (
          <motion.div
            key={e.card.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.03 }}
          >
            <Link to={`/card/${e.card.id}`} className="block active:scale-95">
              <CollectibleCard card={e.card} imageUrl={e.copies[0]?.imageUrl} copies={e.copies.length} compact />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ${
        active ? 'bg-white text-ink ring-white' : 'bg-white/5 text-white/70 ring-white/10'
      }`}
      style={active && color ? { background: color, boxShadow: `0 0 16px ${color}88` } : undefined}
    >
      {children}
    </button>
  );
}
