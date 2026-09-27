import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENT_KINDS, type EventKind } from '@shared/types';
import { api } from '../api/client';
import { EVENT_ICON } from '../components/progress/common';

const KIND_LABEL: Record<EventKind, string> = {
  walk: 'Discovery walk',
  tour: 'Campus tour',
  scavenger: 'Scavenger hunt',
  cleanup: 'Campus cleanup',
  photo: 'Photo meetup',
  social: 'Social',
  charity: 'Charity',
  other: 'Other',
};

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, rounded to the next half hour. */
function defaultStart(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const field = 'rounded-xl bg-white/8 px-3.5 py-3 outline-none ring-1 ring-white/10 focus:ring-accent/60';

export function CreateEventScreen() {
  const navigate = useNavigate();
  const [f, setF] = useState({
    title: '',
    kind: 'walk' as EventKind,
    locationName: '',
    hostLabel: '',
    description: '',
    start: defaultStart(),
    durationMinutes: 60,
    minParticipants: 3,
    maxParticipants: '',
    requiredDiscoveries: 2,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createEvent({
        title: f.title.trim(),
        kind: f.kind,
        locationName: f.locationName.trim(),
        hostLabel: f.hostLabel.trim() || undefined,
        description: f.description.trim() || undefined,
        startsAt: new Date(f.start).toISOString(),
        durationMinutes: f.durationMinutes,
        minParticipants: f.minParticipants,
        maxParticipants: f.maxParticipants ? Number(f.maxParticipants) : null,
        requiredDiscoveries: f.requiredDiscoveries,
      });
      navigate(`/events/${created.id}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={submit} className="pt-safe mx-auto flex max-w-md flex-col gap-4 px-5 pb-10">
        <button type="button" onClick={() => navigate(-1)} className="self-start py-2 text-sm text-white/60">
          ← Back
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold">Host an event</h1>
          <p className="text-sm text-white/60">
            Bring people together. Everyone who checks in and hits the goal earns XP.
          </p>
        </div>

        <input className={field} placeholder="Event name (e.g. Tree ID Walk)" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={60} />

        <div className="grid grid-cols-4 gap-2">
          {EVENT_KINDS.map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => set('kind', k)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold ring-1 ${
                f.kind === k ? 'bg-accent/15 text-accent ring-accent' : 'bg-white/5 text-white/60 ring-white/10'
              }`}
            >
              <span className="text-xl">{EVENT_ICON[k]}</span>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <input
          className={field}
          placeholder="Public meeting spot (e.g. Tech Green fountain)"
          value={f.locationName}
          onChange={(e) => set('locationName', e.target.value)}
          maxLength={80}
        />
        <input className={field} placeholder="Club or organization (optional)" value={f.hostLabel} onChange={(e) => set('hostLabel', e.target.value)} maxLength={40} />
        <textarea
          className={`${field} resize-none`}
          rows={3}
          placeholder="What will you do? (optional)"
          value={f.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={400}
        />

        <label className="flex flex-col gap-1 text-sm text-white/70">
          Starts
          <input type="datetime-local" className={field} value={f.start} onChange={(e) => set('start', e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-white/70">
            Length
            <select className={field} value={f.durationMinutes} onChange={(e) => set('durationMinutes', Number(e.target.value))}>
              {[30, 45, 60, 90, 120, 180].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-white/70">
            Min. people
            <input type="number" min={2} max={50} className={field} value={f.minParticipants} onChange={(e) => set('minParticipants', Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-white/70">
            Max. people
            <input type="number" min={2} max={500} placeholder="No limit" className={field} value={f.maxParticipants} onChange={(e) => set('maxParticipants', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-white/70">
            Discoveries each
            <input type="number" min={0} max={10} className={field} value={f.requiredDiscoveries} onChange={(e) => set('requiredDiscoveries', Number(e.target.value))} />
          </label>
        </div>

        <p className="text-xs text-white/45">
          You'll get a check-in code to read out at the meeting spot. Only share public places. Never a dorm room or
          someone's home.
        </p>

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 ring-1 ring-red-400/30">{error}</p>}

        <button
          disabled={busy || f.title.trim().length < 3 || f.locationName.trim().length < 2}
          className="rounded-2xl bg-accent py-4 font-display text-lg font-bold text-ink active:scale-95 disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </div>
  );
}
