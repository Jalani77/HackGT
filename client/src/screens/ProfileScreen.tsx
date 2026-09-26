import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RARITY_DISPLAY } from '@shared/rarity';
import type { ProfileResponse } from '@shared/types';
import { api } from '../api/client';
import { CATEGORY_ICON } from '../components/cards/categoryIcons';
import { CollectibleCard } from '../components/cards/CollectibleCard';
import { XPBar } from '../components/XPBar';
import { usePlayer } from '../context/PlayerContext';

export function ProfileScreen() {
  const { id = 'me' } = useParams();
  const navigate = useNavigate();
  const { logout, setPlayer } = usePlayer();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null);
    api.profile(id).then(
      (p) => {
        setProfile(p);
        if (p.isMe) setPlayer(p.user); // keep HUD in sync with server state
      },
      (e) => setError(e.message),
    );
  }, [id, setPlayer]);

  if (error) return <p className="p-10 text-center text-red-300">{error}</p>;
  if (!profile) return <p className="p-10 text-center text-white/50">Loading profile…</p>;

  const { user, rarestCard, favorites, categories, recentDiscoveries, isMe } = profile;
  const rarest = rarestCard ? RARITY_DISPLAY[rarestCard.card.rarity] : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="pt-safe mx-auto flex max-w-md flex-col gap-6 px-5 pb-10">
        {!isMe && (
          <button onClick={() => navigate(-1)} className="self-start py-2 text-sm text-white/60">
            ← Back
          </button>
        )}

        {/* Header */}
        <section className="flex items-center gap-4 pt-2">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl font-display text-4xl font-bold text-ink"
            style={{ background: `linear-gradient(135deg, var(--color-accent), ${rarest?.color ?? 'var(--color-accent-2)'})` }}
          >
            {user.displayName[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-bold">{user.displayName}</h1>
            <p className="text-sm text-white/60">
              @{user.username} · Level {user.level.level} {user.level.title}
            </p>
          </div>
        </section>

        <XPBar level={user.level} />

        <section className="grid grid-cols-4 gap-2 text-center">
          <Stat value={user.stats.cardsOwned} label="Cards" />
          <Stat value={user.stats.uniqueCards} label="Unique" />
          <Stat value={user.stats.discoveries} label="Found" />
          <Stat value={profile.tradableCount} label="Tradable" />
        </section>

        {/* Rarest card */}
        {rarestCard && rarest && (
          <section>
            <SectionTitle>Rarest card</SectionTitle>
            <Link
              to={`/card/${rarestCard.card.id}`}
              className="mt-2 flex items-center gap-4 rounded-2xl p-3 active:scale-[0.98]"
              style={{ background: `${rarest.color}14`, boxShadow: `inset 0 0 0 1px ${rarest.color}55` }}
            >
              <div className="w-24 shrink-0">
                <CollectibleCard card={rarestCard.card} imageUrl={rarestCard.copies[0]?.imageUrl} compact />
              </div>
              <div>
                <div className="font-display text-lg font-bold">{rarestCard.card.name}</div>
                <div className="font-display text-sm font-bold" style={{ color: rarest.color }}>
                  {rarest.label} · score {rarestCard.card.rarityScore}
                </div>
                <div className="mt-1 text-xs text-white/60">Found {rarestCard.card.stats.discoveryCount}× on campus</div>
              </div>
            </Link>
          </section>
        )}

        {favorites.length > 0 && (
          <section>
            <SectionTitle>Favorites</SectionTitle>
            <div className="-mx-5 mt-2 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {favorites.map((e) => (
                <Link key={e.card.id} to={`/card/${e.card.id}`} className="w-28 shrink-0 active:scale-95">
                  <CollectibleCard card={e.card} imageUrl={e.copies.find((c) => c.favorite)?.imageUrl} compact />
                </Link>
              ))}
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <section>
            <SectionTitle>Explorer style</SectionTitle>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((c) => (
                <span key={c.category} className="rounded-full bg-white/8 px-3 py-1.5 text-sm ring-1 ring-white/10">
                  {CATEGORY_ICON[c.category]} {c.category} <b className="ml-1 font-display">{c.count}</b>
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle>Recent discoveries</SectionTitle>
          {recentDiscoveries.length === 0 ? (
            <p className="mt-2 text-sm text-white/50">
              No discoveries yet.{' '}
              {isMe && (
                <Link to="/" className="text-accent underline">
                  Go find something!
                </Link>
              )}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {recentDiscoveries.map((d, i) => (
                <motion.li
                  key={d.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    to={`/card/${d.cardId}`}
                    className="flex items-center gap-3 rounded-xl bg-white/5 p-2 ring-1 ring-white/10 active:scale-[0.98]"
                  >
                    <img src={d.photoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.name}</div>
                      <div className="text-xs text-white/50">
                        {new Date(d.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        {d.isDuplicate && ' · duplicate'}
                      </div>
                    </div>
                    <span className="font-display text-sm text-accent">+{d.xpAwarded}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        {isMe && (
          <button onClick={logout} className="mt-2 rounded-2xl bg-white/5 py-3 text-sm text-white/60 ring-1 ring-white/10">
            Log out
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/5 py-3 ring-1 ring-white/10">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-white/50">{label}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xs font-bold tracking-widest text-white/50 uppercase">{children}</h2>;
}
