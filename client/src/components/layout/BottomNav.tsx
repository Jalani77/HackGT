import { NavLink } from 'react-router-dom';

// Only screens that exist are listed; Social/Missions/Events/Profile are added as each phase ships.
const TABS = [
  { to: '/', label: 'Explore', icon: '📷' },
  { to: '/collection', label: 'Collection', icon: '🃏' },
];

export function BottomNav() {
  return (
    <nav className="pb-safe z-30 flex justify-around border-t border-white/10 bg-ink/85 pt-1.5 backdrop-blur-xl">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `flex min-w-20 flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[11px] font-semibold transition ${
              isActive ? 'text-accent' : 'text-white/50'
            }`
          }
        >
          <span className="text-xl">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
