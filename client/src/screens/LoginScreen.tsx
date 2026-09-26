import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { usePlayer } from '../context/PlayerContext';

export function LoginScreen() {
  const { login } = usePlayer();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password, mode);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_20%,#15352c,#07070d_60%)] px-6">
      <motion.div
        className="text-7xl"
        animate={{ rotate: [0, -12, 12, -6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
      >
        🧭
      </motion.div>
      <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">Campus Quest</h1>
      <p className="mt-2 max-w-xs text-center text-white/70">
        Go outside. Discover something. Collect it. Meet someone.
      </p>

      <form onSubmit={submit} className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoCapitalize="none"
          autoComplete="username"
          className="rounded-2xl bg-white/8 px-4 py-3.5 outline-none ring-1 ring-white/10 focus:ring-accent/60"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="rounded-2xl bg-white/8 px-4 py-3.5 outline-none ring-1 ring-white/10 focus:ring-accent/60"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          disabled={busy || !username || !password}
          className="mt-1 rounded-2xl bg-accent py-4 font-display text-lg font-bold text-ink transition active:scale-95 disabled:opacity-50"
        >
          {busy ? '…' : mode === 'register' ? 'Start exploring' : 'Log in'}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-sm text-white/60"
        >
          {mode === 'register' ? 'Already exploring? Log in' : 'New here? Create an explorer'}
        </button>
      </form>
    </div>
  );
}
