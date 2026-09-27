import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { RARITY_DISPLAY } from '@shared/rarity';
import type { CollectionEntry, ProfileResponse, WishlistEntry } from '@shared/types';
import { api } from '../api/client';
import { CATEGORY_ICON } from '../components/cards/categoryIcons';
import { CollectibleCard } from '../components/cards/CollectibleCard';
import { MiniCard } from '../components/social/MiniCard';
import { XPBar } from '../components/XPBar';
import { usePlayer } from '../context/PlayerContext';

export function ProfileScreen() {
  const { id = 'me' } = useParams();
  const navigate = useNavigate();
  const { logout, setPlayer } = usePlayer();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);
  const [tradables, setTradables] = useState<CollectionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(null);
    Promise.all([api.profile(id), api.wishlist(id), api.collection(id)]).then(
      ([p, w, col]) => {
        setProfile(p);
        setWishlist(w);
        setTradables(col.entries.filter((e) => e.copies.some((c) => c.tradable)));
        if (p.isMe) setPlayer(p.user); // keep HUD in sync with server state
      },
      (e) => setError(e.message),
    );
  }, [id, setPlayer]);

  async function removeWish(cardId: string) {
    setWishlist((w) => w.filter((e) => e.card.id !== cardId));
    await api.removeFromWishlist(cardId).catch((e) => setError(e.message));
  }

  if (error) return <p className="p-10 text-center text-red-300">{error}</p>;
  if (!profile) return <p className="p-10 text-center text-white/50">Loading profile…</p>;

  const { user, rarestCard, favorites, categories, recentDiscoveries, isMe, achievements } = profile;
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
            {user.stats.trades > 0 && (
              <p className="text-xs text-accent">
                🤝 {user.stats.trades} trade{user.stats.trades > 1 ? 's' : ''} completed
              </p>
            )}
          </div>
        </section>

        <XPBar level={user.level} />

        {!isMe && (
          <Link
            to={`/trade/${user.id}`}
            className="rounded-2xl bg-accent py-3.5 text-center font-display text-lg font-bold text-ink active:scale-95"
          >
            🤝 Propose a trade
          </Link>
        )}

        <section className="grid grid-cols-4 gap-2 text-center">
          <Stat value={user.stats.cardsOwned} label="Cards" />
          <Stat value={user.stats.uniqueCards} label="Unique" />
          <Stat value={user.stats.discoveries} label="Found" />
          <Stat value={profile.tradableCount} label="Tradable" />
          <Stat value={user.stats.trades} label="Trades" />
          <Stat value={user.stats.missionsCompleted} label="Missions" />
          <Stat value={user.stats.eventsAttended} label="Events" />
          <Stat value={user.stats.routesCompleted} label="Routes" />
        </section>

        {isMe && (
          <Link
            to="/rewards"
            className="flex items-center justify-between rounded-2xl bg-accent-2/10 px-4 py-3.5 ring-1 ring-accent-2/40 active:scale-[0.98]"
          >
            <span className="font-display font-bold">🎁 Student deals & rewards</span>
            <span className="text-accent-2">›</span>
          </Link>
        )}

        {achievements.length > 0 && (
          <section>
            <SectionTitle>
              Achievements · {achievements.filter((a) => a.unlockedAt).length}/{achievements.length}
            </SectionTitle>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[...achievements]
                .sort((a, b) => Number(!!b.unlockedAt) - Number(!!a.unlockedAt))
                .map((a) => (
                  <div
                    key={a.key}
                    title={`${a.title}: ${a.description}`}
                    className={`flex flex-col items-center rounded-2xl p-2 text-center ring-1 ${
                      a.unlockedAt ? 'bg-accent-2/10 ring-accent-2/40' : 'bg-white/5 ring-white/10'
                    }`}
                  >
                    <span className={`text-2xl ${a.unlockedAt ? '' : 'opacity-30 grayscale'}`}>{a.icon}</span>
                    <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-tight">{a.title}</span>
                    {!a.unlockedAt && (
                      <span className="mt-0.5 text-[9px] text-white/40">
                        {a.progress}/{a.target}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

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

        <section>
          <SectionTitle>{isMe ? 'My wishlist' : `${user.displayName} is looking for`}</SectionTitle>
          {wishlist.length === 0 ? (
            <p className="mt-2 text-sm text-white/50">
              {isMe
                ? 'Nothing yet. Tap “Add to wishlist” on any card you’re hunting for, and other students will see it.'
                : 'Their wishlist is empty.'}
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {wishlist.map((w) => {
                const canHelp = !isMe && w.viewerTradableCopies > 0;
                const d = RARITY_DISPLAY[w.card.rarity];
                return (
                  <li
                    key={w.card.id}
                    className={`flex items-center gap-3 rounded-xl p-2 ring-1 ${canHelp ? 'bg-accent-2/10 ring-accent-2/60' : 'bg-white/5 ring-white/10'}`}
                  >
                    <Link to={`/card/${w.card.id}`}>
                      <MiniCard card={w.card} size={48} highlight={canHelp} />
                    </Link>
                    <Link to={`/card/${w.card.id}`} className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">🔍 {w.card.name}</div>
                      <div className="text-xs" style={{ color: d.color }}>
                        {'★'.repeat(d.stars)} {d.label}
                      </div>
                      {canHelp && <div className="text-xs font-bold text-accent-2">You have this! You could trade it.</div>}
                      {isMe && (
                        <div className="text-xs text-white/50">
                          {w.ownedByUser
                            ? 'You own one, but want more'
                            : w.tradableElsewhere > 0
                              ? `${w.tradableElsewhere} student${w.tradableElsewhere > 1 ? 's' : ''} can trade you this`
                              : 'Nobody is trading this yet. Go find one!'}
                        </div>
                      )}
                    </Link>
                    {isMe && (
                      <button
                        onClick={() => removeWish(w.card.id)}
                        className="px-2 text-lg text-white/40"
                        aria-label={`Remove ${w.card.name} from wishlist`}
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {!isMe && tradables.length > 0 && (
          <section>
            <SectionTitle>Open to trade</SectionTitle>
            <div className="-mx-5 mt-2 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {tradables.map((e) => (
                <Link key={e.card.id} to={`/card/${e.card.id}`} className="w-28 shrink-0 active:scale-95">
                  <CollectibleCard
                    card={e.card}
                    imageUrl={e.copies.find((c) => c.tradable)?.imageUrl}
                    copies={e.copies.filter((c) => c.tradable).length}
                    tradable
                    compact
                  />
                </Link>
              ))}
            </div>
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
