import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { CardDTO, CardSocial, CollectionEntry, CopyPatch } from '@shared/types';
import { api } from '../api/client';
import { CollectibleCard } from '../components/cards/CollectibleCard';
import { StudentChip } from '../components/social/StudentChip';

export function CardDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardDTO | null>(null);
  const [mine, setMine] = useState<CollectionEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  /** Optimistically flip a flag on one of my copies; roll back if the server rejects it. */
  async function toggle(copyId: string, patch: CopyPatch) {
    const apply = (p: CopyPatch) =>
      setMine((m) => m && { ...m, copies: m.copies.map((c) => (c.id === copyId ? { ...c, ...p } : c)) });
    const before = mine?.copies.find((c) => c.id === copyId);
    if (!before) return;
    setToggleError(null);
    apply(patch);
    try {
      const saved = await api.updateCopy(copyId, patch);
      apply({ favorite: saved.favorite, tradable: saved.tradable });
    } catch (e) {
      apply({ favorite: before.favorite, tradable: before.tradable });
      setToggleError((e as Error).message);
    }
  }

  const [social, setSocial] = useState<CardSocial | null>(null);

  useEffect(() => {
    Promise.all([api.card(id), api.collection(), api.cardSocial(id)])
      .then(([c, col, s]) => {
        setCard(c);
        setMine(col.entries.find((e) => e.card.id === id) ?? null);
        setSocial(s);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function toggleWishlist() {
    if (!social) return;
    const next = !social.inMyWishlist;
    setSocial({ ...social, inMyWishlist: next });
    try {
      await (next ? api.addToWishlist(id) : api.removeFromWishlist(id));
    } catch (e) {
      setSocial({ ...social, inMyWishlist: !next });
      setToggleError((e as Error).message);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="pt-safe px-4">
        <button onClick={() => navigate(-1)} className="py-2 text-sm text-white/60">
          ← Back
        </button>
      </div>
      {error && <p className="p-6 text-center text-red-300">{error}</p>}
      {card && (
        <div className="mx-auto flex max-w-md flex-col gap-5 px-5 pb-10">
          <div className="mx-auto w-[82%] max-w-[300px]">
            <CollectibleCard card={card} imageUrl={mine?.copies[0]?.imageUrl} />
          </div>

          {card.imageCredit && (
            <p className="-mt-3 text-center text-[11px] text-white/40">
              Photo: {card.imageCredit.author} ·{' '}
              <a href={card.imageCredit.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                {card.imageCredit.license}
              </a>
            </p>
          )}

          {!mine && (
            <p className="-mt-2 rounded-xl bg-white/5 p-3 text-center text-sm text-white/60 ring-1 ring-white/10">
              🔒 You haven't collected this yet. Find one on campus or trade for it!
            </p>
          )}

          {social && (
            <button
              onClick={toggleWishlist}
              className={`rounded-2xl py-3.5 font-display font-bold ring-1 transition active:scale-95 ${
                social.inMyWishlist ? 'bg-accent-2/15 text-accent-2 ring-accent-2/60' : 'bg-white/8 ring-white/15'
              }`}
            >
              {social.inMyWishlist ? '★ On your wishlist' : '☆ Add to wishlist'}
            </button>
          )}

          {social && social.tradableBy.length > 0 && (
            <section>
              <h2 className="font-display text-xs font-bold tracking-widest text-accent">CAN TRADE IT TO YOU</h2>
              <div className="mt-2 flex flex-col gap-2">
                {social.tradableBy.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <StudentChip student={s} extra={`${s.copies} tradable`} />
                    <Link
                      to={`/trade/${s.id}`}
                      className="rounded-xl bg-accent px-3.5 py-2 font-display text-sm font-bold text-ink active:scale-95"
                    >
                      Trade
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {social && social.wantedBy.length > 0 && (
            <section>
              <h2 className="font-display text-xs font-bold tracking-widest text-accent-2">
                ❤️ WANTED BY {social.wantedBy.length} STUDENT{social.wantedBy.length > 1 ? 'S' : ''}
              </h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {social.wantedBy.map((s) => (
                  <StudentChip key={s.id} student={s} />
                ))}
              </div>
              {mine && (
                <p className="mt-2 text-xs text-white/50">
                  You own this. Mark a copy 🔄 tradable below and they'll see it's available.
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="font-display text-xs font-bold tracking-widest text-white/50">ABOUT</h2>
            <p className="mt-1.5 leading-relaxed text-white/85">{card.description}</p>
          </section>

          <section className="rounded-2xl bg-accent/10 p-4 ring-1 ring-accent/30">
            <h2 className="font-display text-xs font-bold tracking-widest text-accent">FUN FACT</h2>
            <p className="mt-1.5 leading-relaxed">{card.funFact}</p>
          </section>

          <section className="grid grid-cols-2 gap-2.5">
            <Stat label="Trade value" value={card.tradeValue} />
            <Stat label="Rarity score" value={card.rarityScore} />
            <Stat label="Found on campus" value={`${card.stats.discoveryCount}×`} />
            <Stat label="Students want it" value={card.stats.wantedBy} />
            <Stat label="First discovered by" value={card.firstDiscoveredBy?.username ?? '—'} />
            <Stat label="Your copies" value={mine?.copies.length ?? 0} />
          </section>

          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {card.tags.map((t) => (
                <span key={t} className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/70">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {mine && (
            <section>
              <h2 className="font-display text-xs font-bold tracking-widest text-white/50">YOUR COPIES</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {mine.copies.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-2 ring-1 ring-white/10">
                    <img src={c.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1 text-sm">
                      <div>{new Date(c.acquiredAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                      <div className="truncate text-xs text-white/50">
                        via {c.acquiredVia} · +{c.xpAwarded} XP
                        {c.environment && ` · ${c.environment.season}`}
                      </div>
                    </div>
                    <Toggle
                      on={c.favorite}
                      onClick={() => toggle(c.id, { favorite: !c.favorite })}
                      label="Favorite"
                      icon="★"
                      color="var(--color-accent-2)"
                    />
                    <Toggle
                      on={c.tradable}
                      onClick={() => toggle(c.id, { tradable: !c.tradable })}
                      label="Tradable"
                      icon="🔄"
                      color="var(--color-accent)"
                    />
                  </li>
                ))}
              </ul>
              {toggleError && <p className="mt-2 text-sm text-red-300">{toggleError}</p>}
              <p className="mt-2 text-xs text-white/45">
                ★ favorites show on your profile. 🔄 tradable copies are the ones you're willing to trade away.
                {mine.copies.length > 1 && ' Duplicates make great trade offers!'}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  label,
  icon,
  color,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition active:scale-90 ${
        on ? '' : 'bg-white/5 opacity-40 grayscale'
      }`}
      style={on ? { background: `color-mix(in srgb, ${color} 22%, transparent)`, boxShadow: `inset 0 0 0 1px ${color}`, color } : undefined}
    >
      {icon}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10">
      <div className="text-[11px] text-white/50">{label}</div>
      <div className="truncate font-display text-lg font-bold">{value}</div>
    </div>
  );
}
