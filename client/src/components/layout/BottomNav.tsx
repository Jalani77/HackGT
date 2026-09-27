import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';

const TABS = [
  { to: '/', label: 'Explore', icon: '📷' },
  { to: '/collection', label: 'Collection', icon: '🃏' },
  { to: '/quests', label: 'Quests', icon: '🎯' },
  { to: '/social', label: 'Social', icon: '🤝' },
  { to: '/profile', label: 'Profile', icon: '🧑‍🚀' },
];

export function BottomNav() {
  const { player, refresh } = usePlayer();
  const location = useLocation();
  const incoming = player?.notifications.incomingTrades ?? 0;

  // Re-check for incoming trade offers when navigating, and every 30s while the app is open.
  useEffect(() => {
    refresh();
  }, [location.pathname, refresh]);
  useEffect(() => {
    const t = setInterval(() => !document.hidden && refresh(), 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <nav className="pb-safe z-30 flex justify-around border-t border-white/10 bg-ink/85 pt-1.5 backdrop-blur-xl">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-semibold transition ${
              isActive ? 'text-accent' : 'text-white/50'
            }`
          }
        >
          <span className="relative text-xl">
            {t.icon}
            {t.to === '/social' && incoming > 0 && (
              <span className="absolute -right-2.5 -top-1 min-w-4 rounded-full bg-accent-2 px-1 text-center font-display text-[10px] font-bold leading-4 text-ink">
                {incoming}
              </span>
            )}
          </span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
