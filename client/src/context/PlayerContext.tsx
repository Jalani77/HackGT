import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicUser } from '@shared/types';
import { api, tokenStore } from '../api/client';

interface PlayerContextValue {
  player: PublicUser | null;
  loading: boolean;
  login: (username: string, password: string, mode: 'login' | 'register') => Promise<void>;
  logout: () => void;
  /** Replace local player state with authoritative server state (e.g. from a DiscoveryResult). */
  setPlayer: (p: PublicUser) => void;
  refresh: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return setPlayer(null);
    try {
      setPlayer(await api.me());
    } catch {
      setPlayer(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (username: string, password: string, mode: 'login' | 'register') => {
    const res = mode === 'login' ? await api.login(username, password) : await api.register(username, password);
    tokenStore.set(res.token);
    setPlayer(res.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setPlayer(null);
  }, []);

  return (
    <PlayerContext.Provider value={{ player, loading, login, logout, setPlayer, refresh }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}
