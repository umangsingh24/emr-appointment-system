import clsx from 'clsx';
import { LogOut, Menu, Stethoscope, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { ROLE_LABELS } from '../../lib/constants.js';
import { PageLoader } from '../ui/Spinner.jsx';
import { NAV_ITEMS } from './navigation.js';

function LiveIndicator() {
  const socket = useSocket();
  const [connected, setConnected] = useState(() => Boolean(socket?.connected));

  useEffect(() => {
    if (!socket) return undefined;
    const update = () => setConnected(socket.connected);
    update();
    socket.on('connect', update);
    socket.on('disconnect', update);
    return () => {
      socket.off('connect', update);
      socket.off('disconnect', update);
    };
  }, [socket]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={connected ? 'Live updates on' : 'Reconnecting…'}>
      <span className={clsx('size-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-amber-400')} aria-hidden="true" />
      {connected ? 'Live' : 'Offline'}
    </span>
  );
}

function Sidebar({ items, onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Main">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          <Icon className="size-4.5" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  const brand = (
    <div className="flex h-16 items-center gap-2.5 px-5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-white">
        <Stethoscope className="size-4.5" aria-hidden="true" />
      </span>
      <span className="text-sm font-semibold text-slate-900">EMR Appointments</span>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        {brand}
        <Sidebar items={items} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="relative flex h-full w-64 flex-col bg-white shadow-xl">
            {brand}
            <Sidebar items={items} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          className="-ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <LiveIndicator />
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="max-w-40 truncate text-sm font-medium text-slate-900 sm:max-w-none">{user.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-4.5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
