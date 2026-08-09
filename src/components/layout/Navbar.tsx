import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BookLock,
  FileBarChart2,
  Info,
  LayoutDashboard,
  Menu,
  ScanLine,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Logo } from './Logo';
import { cn } from '@/lib/utils';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/scan', label: 'Compliance Scan', icon: ScanLine, end: false },
  { to: '/reports', label: 'Reports', icon: FileBarChart2, end: false },
  { to: '/framework', label: 'DPDPA Framework', icon: BookLock, end: false },
  { to: '/about', label: 'About', icon: Info, end: false },
];

function SystemPill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-matrix/35 bg-matrix/8 px-3 py-1">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-matrix" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-matrix" />
      </span>
      <span className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-matrix">
        System Online
      </span>
    </span>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/80 bg-void/78 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="DPDPA Sentinel home">
          <Logo />
          <span className="hidden sm:block">
            <span className="block font-mono text-sm font-bold tracking-[0.16em] text-ink">
              DPDPA <span className="text-neon text-glow">SENTINEL</span>
            </span>
            <span className="block font-mono text-[0.56rem] uppercase tracking-[0.2em] text-ink-faint">
              Privacy Compliance Intelligence
            </span>
          </span>
        </NavLink>

        <nav className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative rounded-lg px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.13em] transition-colors',
                  isActive ? 'text-neon' : 'text-ink-dim hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive ? (
                    <span className="absolute inset-x-2.5 -bottom-[9px] h-px bg-gradient-to-r from-transparent via-neon to-transparent" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <span className="hidden xl:block">
            <SystemPill />
          </span>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'grid h-9 w-9 place-items-center rounded-lg border transition-colors',
                isActive
                  ? 'border-neon/60 bg-neon/12 text-neon'
                  : 'border-hairline text-ink-dim hover:border-neon/40 hover:text-neon',
              )
            }
            aria-label="Settings"
            title="Settings"
          >
            <Settings2 size={16} />
          </NavLink>

          <div
            className="hidden h-9 items-center gap-2 rounded-lg border border-hairline bg-white/4 pl-1.5 pr-3 sm:flex"
            title="Analyst profile"
          >
            <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-neon/80 to-electric text-[0.6rem] font-bold text-void">
              DP
            </span>
            <span className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink-dim">
              Analyst
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline text-ink-dim transition-colors hover:border-neon/40 hover:text-neon lg:hidden"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet navigation */}
      <div
        className={cn(
          'overflow-hidden border-t border-hairline/70 bg-abyss/95 transition-[max-height,opacity] duration-300 lg:hidden',
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <nav className="mx-auto flex max-w-[1400px] flex-col gap-1 px-4 py-3 sm:px-6" aria-label="Mobile">
          {[...NAV_ITEMS, { to: '/settings', label: 'Settings', icon: Settings2, end: false }].map(
            (item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-xs uppercase tracking-[0.13em] transition-colors',
                    isActive
                      ? 'bg-neon/10 text-neon border border-neon/30'
                      : 'text-ink-dim border border-transparent hover:bg-white/4 hover:text-ink',
                  )
                }
              >
                <item.icon size={15} />
                {item.label}
              </NavLink>
            ),
          )}
          <div className="mt-2 flex items-center gap-2 px-1 pb-1">
            <ShieldCheck size={14} className="text-matrix" />
            <SystemPill />
          </div>
        </nav>
      </div>
    </header>
  );
}
