import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DiscoveryResult } from '@shared/types';
import { api, ApiRequestError } from '../api/client';
import { CameraHUD } from '../components/camera/CameraHUD';
import { CardReveal } from '../components/cards/CardReveal';
import { usePlayer } from '../context/PlayerContext';
import { useCamera } from '../hooks/useCamera';

/** A captured photo waiting on (or retrying) analysis. Kept until it succeeds or is discarded. */
interface PendingCapture {
  blob: Blob;
  previewUrl: string;
  captureId: string;
}

type Phase =
  | { kind: 'camera' }
  | { kind: 'analyzing' }
  | { kind: 'error'; error: ApiRequestError }
  | { kind: 'reveal'; result: DiscoveryResult };

const ANALYZING_LINES = ['Scanning shapes…', 'Consulting the field guide…', 'Digging up a fun fact…', 'Calculating rarity…'];

export function ExploreScreen() {
  const { player, setPlayer } = usePlayer();
  const navigate = useNavigate();
  const cam = useCamera();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [flash, setFlash] = useState(0);

  const clearPending = () => {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  };

  async function analyze(capture: PendingCapture) {
    setPhase({ kind: 'analyzing' });
    try {
      const result = await api.analyzeDiscovery(capture.blob, capture.captureId);
      setPlayer(result.player); // authoritative server state
      setPhase({ kind: 'reveal', result });
    } catch (e) {
      const error = e instanceof ApiRequestError ? e : new ApiRequestError('INTERNAL', 'Something went wrong.');
      setPhase({ kind: 'error', error });
    }
  }

  function begin(blob: Blob) {
    clearPending();
    const capture = { blob, previewUrl: URL.createObjectURL(blob), captureId: crypto.randomUUID() };
    setPending(capture);
    analyze(capture);
  }

  async function onShutter() {
    if (phase.kind !== 'camera') return;
    setFlash((f) => f + 1);
    navigator.vibrate?.(30);
    const blob = await cam.capture();
    if (blob) begin(blob);
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) begin(file);
  }

  function backToCamera() {
    clearPending();
    setPhase({ kind: 'camera' });
  }

  if (!player) return null;
  const cameraLive = cam.status === 'live';

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Camera preview */}
      <video
        ref={cam.videoRef}
        playsInline
        muted
        className={`absolute inset-0 h-full w-full object-cover ${cam.facing === 'user' ? '-scale-x-100' : ''}`}
      />

      {!cameraLive && <CameraFallback status={cam.status} onUpload={() => fileInput.current?.click()} onRetry={cam.retry} />}

      {cameraLive && phase.kind === 'camera' && <Viewfinder />}

      <CameraHUD
        player={player}
        objective={player.stats.cardsOwned === 0 ? 'Photograph anything interesting around you' : 'Find something you haven’t collected yet'}
      />

      {/* Torch */}
      {cam.torchSupported && (
        <button
          onClick={cam.toggleTorch}
          className={`absolute right-3 top-[132px] z-20 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md ${
            cam.torchOn ? 'bg-accent-2 text-ink' : 'bg-black/45'
          }`}
          aria-label="Toggle flash"
        >
          ⚡
        </button>
      )}

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-around px-8 pb-6">
        <button
          onClick={() => fileInput.current?.click()}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/45 text-xl backdrop-blur-md active:scale-90"
          aria-label="Upload a photo"
        >
          🖼️
        </button>
        <button
          onClick={onShutter}
          disabled={!cameraLive || phase.kind !== 'camera'}
          aria-label="Take picture"
          className="group relative flex h-20 w-20 items-center justify-center rounded-full disabled:opacity-40"
        >
          <span className="absolute inset-0 rounded-full border-4 border-white/90" />
          <span className="h-[62px] w-[62px] rounded-full bg-white transition group-active:scale-90 group-active:bg-accent" />
        </button>
        <button
          onClick={cam.flip}
          disabled={!cameraLive}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/45 text-xl backdrop-blur-md active:scale-90 disabled:opacity-40"
          aria-label="Flip camera"
        >
          🔄
        </button>
      </div>

      <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {/* Shutter flash */}
      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="pointer-events-none absolute inset-0 z-40 bg-white"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase.kind === 'analyzing' && pending && <Analyzing key="analyzing" previewUrl={pending.previewUrl} />}
        {phase.kind === 'error' && (
          <ErrorSheet
            key="error"
            error={phase.error}
            onRetry={phase.error.isNetwork && pending ? () => analyze(pending) : undefined}
            onDismiss={backToCamera}
          />
        )}
        {phase.kind === 'reveal' && (
          <CardReveal
            key="reveal"
            result={phase.result}
            onDone={backToCamera}
            onViewCard={(id) => navigate(`/card/${id}`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Viewfinder() {
  const corner = 'absolute h-10 w-10 border-white/80';
  return (
    <div className="pointer-events-none absolute left-1/2 top-[46%] z-10 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2">
      <span className={`${corner} left-0 top-0 rounded-tl-2xl border-l-4 border-t-4`} />
      <span className={`${corner} right-0 top-0 rounded-tr-2xl border-r-4 border-t-4`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
      <span className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4`} />
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />
    </div>
  );
}

function Analyzing({ previewUrl }: { previewUrl: string }) {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLine((l) => (l + 1) % ANALYZING_LINES.length), 1300);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div className="absolute inset-0 z-30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/55" />
      <div className="scan-line absolute inset-x-6 h-1 rounded-full bg-accent shadow-[0_0_24px_6px_var(--color-accent)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <motion.div
          className="font-display text-4xl font-bold tracking-[0.2em]"
          animate={{ opacity: [1, 0.45, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          ANALYZING…
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.div
            key={line}
            className="text-sm text-white/80"
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
          >
            {ANALYZING_LINES[line]}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const ERROR_ICON: Partial<Record<string, string>> = {
  NETWORK: '📡',
  LOW_CONFIDENCE: '🔍',
  NOT_IDENTIFIED: '🤔',
  PERSON_DETECTED: '🙈',
  INVALID_IMAGE: '🖼️',
  RATE_LIMITED: '⏳',
};

function ErrorSheet({ error, onRetry, onDismiss }: { error: ApiRequestError; onRetry?: () => void; onDismiss: () => void }) {
  return (
    <motion.div
      className="absolute inset-0 z-40 flex items-end bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      <motion.div
        className="pb-safe w-full rounded-t-3xl bg-panel px-6 pt-6"
        initial={{ y: 200 }}
        animate={{ y: 0 }}
        exit={{ y: 200 }}
        transition={{ type: 'spring', damping: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl">{ERROR_ICON[error.code] ?? '⚠️'}</div>
        <p className="mt-3 font-display text-xl font-bold leading-snug">{error.message}</p>
        <div className="mt-5 flex gap-3 pb-4">
          {onRetry ? (
            <>
              <button onClick={onDismiss} className="flex-1 rounded-2xl bg-white/10 py-3.5 font-display font-bold">
                Discard
              </button>
              <button onClick={onRetry} className="flex-1 rounded-2xl bg-accent py-3.5 font-display font-bold text-ink">
                Retry upload
              </button>
            </>
          ) : (
            <button onClick={onDismiss} className="flex-1 rounded-2xl bg-accent py-3.5 font-display font-bold text-ink">
              Try another photo
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function CameraFallback({ status, onUpload, onRetry }: { status: string; onUpload: () => void; onRetry: () => void }) {
  if (status === 'starting' || status === 'idle') {
    return <div className="absolute inset-0 flex items-center justify-center text-white/50">Starting camera…</div>;
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_40%,#1d2a3a,#07070d)] px-10 text-center">
      <div className="text-6xl">📷</div>
      <p className="font-display text-xl font-bold">
        {status === 'denied' ? 'Camera access was blocked' : 'Camera not available here'}
      </p>
      <p className="text-sm text-white/60">
        {status === 'denied'
          ? 'Allow camera access in your browser settings, or upload a photo instead.'
          : 'The camera needs HTTPS or localhost. You can still upload a photo.'}
      </p>
      <button onClick={onUpload} className="rounded-2xl bg-accent px-6 py-3.5 font-display font-bold text-ink">
        Upload a photo
      </button>
      {status === 'denied' && (
        <button onClick={onRetry} className="text-sm text-white/60 underline">
          Try camera again
        </button>
      )}
    </div>
  );
}
