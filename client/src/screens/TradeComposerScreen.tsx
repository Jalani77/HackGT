import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { rarityRank } from '@shared/rarity';
import type { CardMini, CollectionResponse, ProfileResponse } from '@shared/types';
import { api } from '../api/client';
import { MiniCard } from '../components/social/MiniCard';
import { Avatar } from '../components/social/StudentChip';

const MAX_PER_SIDE = 5;

interface Option {
  copyId: string;
  card: CardMini;
  /** The other side wants this card (on their wishlist). */
  wanted: boolean;
}

function tradableOptions(col: CollectionResponse, wanted: Set<string>): Option[] {
  return col.entries
    .flatMap((e) =>
      e.copies
        .filter((c) => c.tradable)
        .map((c) => ({
          copyId: c.id,
          card: { id: e.card.id, name: e.card.name, rarity: e.card.rarity, imageUrl: c.imageUrl },
          wanted: wanted.has(e.card.id),
        })),
    )
    .sort((a, b) => Number(b.wanted) - Number(a.wanted) || rarityRank(b.card.rarity) - rarityRank(a.card.rarity));
}

export function TradeComposerScreen() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const [them, setThem] = useState<ProfileResponse | null>(null);
  const [mine, setMine] = useState<Option[] | null>(null);
  const [theirs, setTheirs] = useState<Option[] | null>(null);
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([api.profile(userId), api.collection('me'), api.collection(userId), api.wishlist('me'), api.wishlist(userId)])
      .then(([profile, myCol, theirCol, myWishlist, theirWishlist]) => {
        setThem(profile);
        setMine(tradableOptions(myCol, new Set(theirWishlist.map((w) => w.card.id))));
        setTheirs(tradableOptions(theirCol, new Set(myWishlist.map((w) => w.card.id))));
      })
      .catch((e) => setError(e.message));
  }, [userId]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : list.length < MAX_PER_SIDE ? [...list, id] : list);

  const summary = useMemo(() => {
    const pick = (opts: Option[] | null, ids: string[]) => (opts ?? []).filter((o) => ids.includes(o.copyId));
    return { give: pick(mine, give), get: pick(theirs, get) };
  }, [mine, theirs, give, get]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await api.createTrade({ toUserId: userId, offeredCopyIds: give, requestedCopyIds: get, message: message.trim() || undefined });
      navigate('/social?tab=trades', { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }

  if (!them || !mine || !theirs) {
    return <p className="p-10 text-center text-white/50">{error ?? 'Loading…'}</p>;
  }
  const name = them.user.displayName;

  return (
    <div className="h-full overflow-y-auto">
      <div className="pt-safe mx-auto flex max-w-md flex-col gap-5 px-4 pb-10">
        <button onClick={() => navigate(-1)} className="self-start py-2 text-sm text-white/60">
          ← Back
        </button>
        <header className="flex items-center gap-3">
          <Avatar student={them.user} size={48} />
          <div>
            <h1 className="font-display text-2xl font-bold">Trade with {name}</h1>
            <p className="text-sm text-white/55">Pick up to {MAX_PER_SIDE} cards on each side.</p>
          </div>
        </header>

        <Picker
          title={`You get from ${name}`}
          hint="★ = on your wishlist"
          options={theirs}
          selected={get}
          onToggle={(id) => toggle(get, setGet, id)}
          empty={`${name} hasn't marked any cards as tradable yet. You can still send a gift!`}
          wantedLabel="You want this"
        />

        <Picker
          title="You give"
          hint={`★ = ${name} wants this`}
          options={mine}
          selected={give}
          onToggle={(id) => toggle(give, setGive, id)}
          empty={
            <>
              You don't have any tradable cards.{' '}
              <Link to="/collection" className="text-accent underline">
                Mark some as tradable
              </Link>{' '}
              first. Duplicates are perfect!
            </>
          }
          wantedLabel={`${name} wants this`}
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          placeholder={`Say hi to ${name} (optional). Maybe suggest meeting up to explore together!`}
          rows={2}
          className="resize-none rounded-xl bg-white/8 px-3.5 py-3 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-accent/60"
        />

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

        <motion.div layout className="sticky bottom-2 rounded-2xl bg-panel-2/95 p-3 ring-1 ring-white/15 backdrop-blur">
          <div className="flex items-center justify-between text-sm">
            <span>
              Give <b className="font-display">{summary.give.length}</b> · Get <b className="font-display">{summary.get.length}</b>
              {summary.get.length === 0 && summary.give.length > 0 && <span className="text-white/50"> (gift 🎁)</span>}
            </span>
            <button
              onClick={send}
              disabled={give.length === 0 || sending}
              className="rounded-xl bg-accent px-5 py-2.5 font-display font-bold text-ink active:scale-95 disabled:opacity-40"
            >
              {sending ? 'Sending…' : 'Send offer'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function Picker({
  title,
  hint,
  options,
  selected,
  onToggle,
  empty,
  wantedLabel,
}: {
  title: string;
  hint: string;
  options: Option[];
  selected: string[];
  onToggle: (copyId: string) => void;
  empty: React.ReactNode;
  wantedLabel: string;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">{title}</h2>
        <span className="text-[11px] text-white/40">{hint}</span>
      </div>
      {options.length === 0 ? (
        <p className="mt-2 rounded-xl bg-white/5 p-3 text-sm text-white/55">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {options.map((o) => {
            const on = selected.includes(o.copyId);
            return (
              <li key={o.copyId}>
                <button
                  onClick={() => onToggle(o.copyId)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-left ring-1 transition active:scale-[0.98] ${
                    on ? 'bg-accent/10 ring-accent' : 'bg-white/5 ring-white/10'
                  }`}
                >
                  <MiniCard card={o.card} size={46} selected={on} highlight={o.wanted} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{o.card.name}</div>
                    {o.wanted && <div className="text-xs font-bold text-accent-2">★ {wantedLabel}</div>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
