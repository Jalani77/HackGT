import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CARD_CATEGORIES, type CardCategory, type CardMini } from '@shared/types';
import { api } from '../api/client';
import { CATEGORY_ICON } from '../components/cards/categoryIcons';
import { useCelebrate } from '../context/CelebrationContext';
import { usePlayer } from '../context/PlayerContext';

const MIN_STOPS = 2;
const MAX_STOPS = 8;
const field = 'w-full rounded-xl bg-white/8 px-3.5 py-2.5 text-sm outline-none ring-1 ring-white/10 focus:ring-accent/60';

type Target = { type: 'any' } | { type: 'category'; category: CardCategory } | { type: 'card'; cardId: string };
interface Stop {
  key: number;
  label: string;
  area: string;
  hint: string;
  target: Target;
}

let nextKey = 1;
const blankStop = (): Stop => ({ key: nextKey++, label: '', area: '', hint: '', target: { type: 'any' } });

export function CreateRouteScreen() {
  const navigate = useNavigate();
  const { setPlayer } = usePlayer();
  const celebrate = useCelebrate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estMinutes, setEstMinutes] = useState('30');
  const [stops, setStops] = useState<Stop[]>([blankStop(), blankStop(), blankStop()]);
  const [myCards, setMyCards] = useState<CardMini[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Specific-card stops must be things you've photographed yourself (the server re-checks).
  useEffect(() => {
    api.collection().then((col) =>
      setMyCards(
        col.entries
          .filter((e) => e.card.source === 'discovery' && e.copies.some((c) => c.acquiredVia === 'discovery'))
          .map((e) => ({ id: e.card.id, name: e.card.name, rarity: e.card.rarity, imageUrl: e.card.imageUrl })),
      ),
    );
  }, []);

  const update = (key: number, patch: Partial<Stop>) => setStops((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setStops((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.createRoute({
        title: title.trim(),
        description: description.trim() || undefined,
        estMinutes: estMinutes ? Number(estMinutes) : null,
        checkpoints: stops.map((s) => ({
          label: s.label.trim(),
          area: s.area.trim() || undefined,
          hint: s.hint.trim() || undefined,
          cardId: s.target.type === 'card' ? s.target.cardId : null,
          category: s.target.type === 'category' ? s.target.category : null,
        })),
      });
      setPlayer(res.player);
      celebrate(res.progress, res.levelUp, { title: 'Route published! 🗺️' });
      navigate(`/routes/${res.data.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const valid = title.trim().length >= 3 && stops.every((s) => s.label.trim());

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={submit} className="pt-safe mx-auto flex max-w-md flex-col gap-4 px-5 pb-10">
        <button type="button" onClick={() => navigate(-1)} className="self-start py-2 text-sm text-white/60">
          ← Back
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold">Create a route</h1>
          <p className="text-sm text-white/60">
            Share your favorite walk. Other students follow it stop by stop, and you earn XP each time someone finishes it.
          </p>
        </div>

        <input className={field} placeholder="Route name (e.g. Hidden Gardens Loop)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} />
        <textarea
          className={`${field} resize-none`}
          rows={2}
          placeholder="What makes this walk special? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
        />
        <label className="flex items-center justify-between gap-3 text-sm text-white/70">
          About how long? (minutes)
          <input type="number" min={1} max={600} className={`${field} w-24`} value={estMinutes} onChange={(e) => setEstMinutes(e.target.value)} />
        </label>

        <div className="font-display text-xs font-bold uppercase tracking-widest text-white/50">Stops (in order)</div>
        <AnimatePresence initial={false}>
          {stops.map((s, i) => (
            <motion.div
              key={s.key}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-2 rounded-2xl bg-panel p-3 ring-1 ring-white/10"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-2 font-display text-sm font-bold text-ink">
                  {i + 1}
                </span>
                <input className={field} placeholder="Stop name (e.g. The big oak)" value={s.label} onChange={(e) => update(s.key, { label: e.target.value })} maxLength={40} />
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-xs text-white/50 disabled:opacity-20" aria-label="Move up">
                    ▲
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === stops.length - 1} className="px-1 text-xs text-white/50 disabled:opacity-20" aria-label="Move down">
                    ▼
                  </button>
                </div>
              </div>

              <select
                className={field}
                value={s.target.type === 'any' ? 'any' : s.target.type === 'category' ? `cat:${s.target.category}` : `card:${s.target.cardId}`}
                onChange={(e) => {
                  const v = e.target.value;
                  update(s.key, {
                    target: v === 'any' ? { type: 'any' } : v.startsWith('cat:') ? { type: 'category', category: v.slice(4) as CardCategory } : { type: 'card', cardId: v.slice(5) },
                  });
                }}
              >
                <option value="any">✨ Photograph anything</option>
                <optgroup label="Any card in a category">
                  {CARD_CATEGORIES.map((c) => (
                    <option key={c} value={`cat:${c}`}>
                      {CATEGORY_ICON[c]} Any {c.toLowerCase()}
                    </option>
                  ))}
                </optgroup>
                {myCards.length > 0 && (
                  <optgroup label="A specific card you've found">
                    {myCards.map((c) => (
                      <option key={c.id} value={`card:${c.id}`}>
                        🃏 {c.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <input className={field} placeholder="Area (e.g. Tech Green)" value={s.area} onChange={(e) => update(s.key, { area: e.target.value })} maxLength={40} />
                <input className={field} placeholder="Hint (optional)" value={s.hint} onChange={(e) => update(s.key, { hint: e.target.value })} maxLength={120} />
              </div>

              {stops.length > MIN_STOPS && (
                <button type="button" onClick={() => setStops((x) => x.filter((y) => y.key !== s.key))} className="self-end text-xs text-white/40 underline">
                  Remove stop
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {stops.length < MAX_STOPS && (
          <button type="button" onClick={() => setStops((s) => [...s, blankStop()])} className="rounded-2xl border border-dashed border-white/20 py-3 text-sm text-white/60">
            + Add a stop
          </button>
        )}

        <p className="text-xs text-white/45">
          Describe areas at the landmark level (a building or green), never a person's location. Specific-card stops can
          only use cards you've photographed yourself.
        </p>

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

        <button disabled={busy || !valid} className="rounded-2xl bg-accent py-4 font-display text-lg font-bold text-ink active:scale-95 disabled:opacity-40">
          {busy ? 'Publishing…' : 'Publish route'}
        </button>
      </form>
    </div>
  );
}
