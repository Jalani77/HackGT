import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { StudentListItem, TradeDTO } from '@shared/types';
import { api } from '../api/client';
import { MiniCard } from '../components/social/MiniCard';
import { Avatar } from '../components/social/StudentChip';
import { usePlayer } from '../context/PlayerContext';

export function SocialScreen() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'trades' ? 'trades' : 'students';
  const { player } = usePlayer();
  const incoming = player?.notifications.incomingTrades ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <header className="pt-safe sticky top-0 z-10 bg-ink/85 px-4 pb-3 backdrop-blur-xl">
        <h1 className="font-display text-3xl font-bold">Social</h1>
        <p className="text-sm text-white/60">Find students who have what you're looking for.</p>
        <div className="mt-3 grid grid-cols-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
          {(['students', 'trades'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setParams(t === 'trades' ? { tab: 'trades' } : {}, { replace: true })}
              className={`relative rounded-xl py-2 font-display text-sm font-bold transition ${
                tab === t ? 'bg-white text-ink' : 'text-white/60'
              }`}
            >
              {t === 'students' ? 'Students' : 'Trades'}
              {t === 'trades' && incoming > 0 && (
                <span className="ml-1.5 rounded-full bg-accent-2 px-1.5 text-[11px] text-ink">{incoming}</span>
              )}
            </button>
          ))}
        </div>
      </header>
      {tab === 'students' ? <Students /> : <Trades />}
    </div>
  );
}

function Students() {
  const [q, setQ] = useState('');
  const [students, setStudents] = useState<StudentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => api.students(q.trim() || undefined).then(setStudents, (e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex flex-col gap-3 px-4 pb-8">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by username…"
        autoCapitalize="none"
        autoCorrect="off"
        className="rounded-xl bg-white/8 px-3.5 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-accent/60"
      />
      {error && <p className="text-red-300">{error}</p>}
      {!students && !error && <p className="py-8 text-center text-white/50">Finding explorers…</p>}
      {students?.length === 0 && <p className="py-8 text-center text-white/50">No students found.</p>}
      {students?.map((s, i) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i, 10) * 0.03 }}
          className="rounded-2xl bg-panel p-3.5 ring-1 ring-white/10"
        >
          <Link to={`/profile/${s.id}`} className="flex items-center gap-3">
            <Avatar student={s} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-lg font-bold">{s.displayName}</div>
              <div className="text-xs text-white/50">
                Lv {s.level} {s.levelTitle} · {s.tradableCount} tradable · {s.wishlistCount} wanted
              </div>
            </div>
            <span className="text-white/30">›</span>
          </Link>

          {(s.iWantFromThem.length > 0 || s.theyWantFromMe.length > 0) && (
            <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
              {s.iWantFromThem.length > 0 && (
                <MatchRow label={`Has ${s.iWantFromThem.length} you want`} color="var(--color-accent)" cards={s.iWantFromThem} />
              )}
              {s.theyWantFromMe.length > 0 && (
                <MatchRow label={`Wants ${s.theyWantFromMe.length} of yours`} color="var(--color-accent-2)" cards={s.theyWantFromMe} />
              )}
              <Link
                to={`/trade/${s.id}`}
                className="mt-1 rounded-xl bg-accent py-2.5 text-center font-display text-sm font-bold text-ink active:scale-95"
              >
                Propose a trade
              </Link>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

function MatchRow({ label, color, cards }: { label: string; color: string; cards: StudentListItem['iWantFromThem'] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-xs font-bold" style={{ color }}>
        {label}
      </span>
      <div className="flex gap-1.5 overflow-hidden">
        {cards.slice(0, 5).map((c) => (
          <MiniCard key={c.id} card={c} size={34} highlight />
        ))}
      </div>
    </div>
  );
}

function Trades() {
  const { setPlayer, refresh } = usePlayer();
  const [trades, setTrades] = useState<TradeDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => api.trades().then(setTrades, (e) => setError(e.message)), []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function act(trade: TradeDTO, action: 'accept' | 'reject' | 'cancel') {
    setBusy(trade.id);
    setError(null);
    try {
      if (action === 'accept') {
        const res = await api.acceptTrade(trade.id);
        setPlayer(res.player);
        setToast(
          res.levelUp
            ? `Trade complete! +${res.xpAwarded} XP · LEVEL UP → ${res.levelUp.to}`
            : `Trade complete! +${res.xpAwarded} XP. Cards added to your collection.`,
        );
      } else {
        await (action === 'reject' ? api.rejectTrade(trade.id) : api.cancelTrade(trade.id));
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      load();
    }
  }

  if (!trades) return <p className="py-10 text-center text-white/50">{error ?? 'Loading trades…'}</p>;
  const incoming = trades.filter((t) => t.status === 'pending' && t.direction === 'incoming');
  const outgoing = trades.filter((t) => t.status === 'pending' && t.direction === 'outgoing');
  const history = trades.filter((t) => t.status !== 'pending' && t.status !== 'processing');

  return (
    <div className="flex flex-col gap-6 px-4 pb-8">
      {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

      <Section title="Waiting on you" empty="No offers right now.">
        {incoming.map((t) => (
          <TradeCard key={t.id} trade={t} busy={busy === t.id}>
            <button onClick={() => act(t, 'reject')} className="flex-1 rounded-xl bg-white/10 py-2.5 font-display font-bold">
              Decline
            </button>
            <button onClick={() => act(t, 'accept')} className="flex-1 rounded-xl bg-accent py-2.5 font-display font-bold text-ink">
              Accept trade
            </button>
          </TradeCard>
        ))}
      </Section>

      <Section title="Your offers" empty="You haven't sent any offers. Find a student with a card you want!">
        {outgoing.map((t) => (
          <TradeCard key={t.id} trade={t} busy={busy === t.id}>
            <button onClick={() => act(t, 'cancel')} className="flex-1 rounded-xl bg-white/10 py-2.5 font-display font-bold">
              Cancel offer
            </button>
          </TradeCard>
        ))}
      </Section>

      {history.length > 0 && (
        <Section title="History">
          {history.map((t) => (
            <TradeCard key={t.id} trade={t} />
          ))}
        </Section>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl bg-accent px-4 py-3 text-center font-display font-bold text-ink shadow-2xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            🤝 {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode[] | React.ReactNode }) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <section>
      <h2 className="font-display text-xs font-bold uppercase tracking-widest text-white/50">{title}</h2>
      <div className="mt-2 flex flex-col gap-3">
        {count === 0 && empty ? <p className="text-sm text-white/45">{empty}</p> : children}
      </div>
    </section>
  );
}

const STATUS_STYLE: Record<string, string> = {
  accepted: 'text-accent',
  declined: 'text-red-300',
  cancelled: 'text-white/50',
  expired: 'text-amber-300',
};

function TradeCard({ trade, busy, children }: { trade: TradeDTO; busy?: boolean; children?: React.ReactNode }) {
  const other = trade.direction === 'incoming' ? trade.from : trade.to;
  // Always phrase from the viewer's point of view.
  const youGive = trade.direction === 'incoming' ? trade.requested : trade.offered;
  const youGet = trade.direction === 'incoming' ? trade.offered : trade.requested;
  return (
    <div className={`rounded-2xl bg-panel p-3.5 ring-1 ring-white/10 transition ${busy ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2.5">
        <Avatar student={other} size={32} />
        <Link to={`/profile/${other.id}`} className="font-display font-bold">
          {other.displayName}
        </Link>
        <span className="text-xs text-white/40">{trade.direction === 'incoming' ? 'sent you an offer' : 'your offer'}</span>
        {trade.status !== 'pending' && (
          <span className={`ml-auto text-xs font-bold uppercase ${STATUS_STYLE[trade.status] ?? ''}`}>{trade.status}</span>
        )}
      </div>
      {trade.message && <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-sm italic text-white/80">“{trade.message}”</p>}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
        <Side label="You give" items={youGive} />
        <span className="pt-7 text-xl text-white/40">⇄</span>
        <Side label="You get" items={youGet} />
      </div>
      {trade.statusReason && <p className="mt-2 text-xs text-amber-300/80">{trade.statusReason}</p>}
      {children && <div className="mt-3 flex gap-2">{children}</div>}
    </div>
  );
}

function Side({ label, items }: { label: string; items: TradeDTO['offered'] }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold uppercase tracking-wider text-white/45">{label}</div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-white/40">Nothing (a gift!)</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {items.map((i) => (
            <li key={i.copyId} className="flex items-center gap-2">
              <MiniCard card={i.card} size={36} />
              <span className="truncate text-xs">{i.card.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
