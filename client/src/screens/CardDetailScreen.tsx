import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CardDTO, CollectionEntry } from '@shared/types';
import { api } from '../api/client';
import { CollectibleCard } from '../components/cards/CollectibleCard';

export function CardDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState<CardDTO | null>(null);
  const [mine, setMine] = useState<CollectionEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.card(id), api.collection()])
      .then(([c, col]) => {
        setCard(c);
        setMine(col.entries.find((e) => e.card.id === id) ?? null);
      })
      .catch((e) => setError(e.message));
  }, [id]);

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
                    <div className="flex-1 text-sm">
                      <div>{new Date(c.acquiredAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                      <div className="text-xs text-white/50">
                        via {c.acquiredVia}
                        {c.environment && ` · ${c.environment.season} ${c.environment.timeOfDay.toLowerCase()}`}
                      </div>
                    </div>
                    <span className="font-display text-sm text-accent">+{c.xpAwarded} XP</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
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
