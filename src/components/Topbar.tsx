import { useEffect, useRef, useState } from 'react';
import { Menu, Search, Bell, Moon, Sun, Plus, Command, LogOut, User, Settings } from 'lucide-react';
import { NAV } from '../lib/nav';
import type { Notification, Profile } from '../lib/types';
import { timeAgo } from '../lib/format';
import { ROLE_LABELS, ROLE_COLORS, canAccess } from '../lib/auth';

export function Topbar({
  onMenu,
  onNavigate,
  theme,
  onToggleTheme,
  notifications,
  onMarkAllRead,
  search,
  setSearch,
  profile,
  onSignOut,
}: {
  onMenu: () => void;
  onNavigate: (id: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  notifications: Notification[];
  onMarkAllRead: () => void;
  search: string;
  setSearch: (v: string) => void;
  profile: Profile | null;
  onSignOut: () => void;
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === 'Escape') { setPaletteOpen(false); setNotifOpen(false); setUserOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPaletteOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const sevColor: Record<string, string> = {
    info: 'bg-sky-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    success: 'bg-emerald-500',
  };

  const initials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const visibleNav = NAV.filter((item) => canAccess(profile?.role, item.id));
  const filteredNav = search
    ? visibleNav.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
    : visibleNav;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/80 px-4 backdrop-blur-md dark:border-ink-800 dark:bg-ink-900/80">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden dark:hover:bg-ink-800"
      >
        <Menu size={20} />
      </button>

      <div className="relative flex-1 max-w-md" ref={paletteRef}>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setPaletteOpen(true)}
            placeholder="Rechercher ou sauter à un module…"
            className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-16 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:focus:bg-ink-900"
          />
          <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-400 sm:flex dark:border-ink-700 dark:bg-ink-800">
            <Command size={10} />K
          </kbd>
        </div>
        {paletteOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-ink-200 animate-scale-in dark:bg-ink-900 dark:ring-ink-800">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Navigation
            </div>
            {filteredNav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id); setPaletteOpen(false); setSearch(''); }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-ink-700 transition hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
                >
                  <Icon size={16} className="text-ink-400" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {canAccess(profile?.role, 'sales') && (
          <button
            onClick={() => onNavigate('sales')}
            className="hidden items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-brand-700 sm:flex"
          >
            <Plus size={16} /> Nouvelle vente
          </button>
        )}

        <button
          onClick={onToggleTheme}
          className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 dark:hover:bg-ink-800"
          title="Thème"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-ink-200 animate-scale-in dark:bg-ink-900 dark:ring-ink-800">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <button onClick={onMarkAllRead} className="text-xs font-medium text-brand-600 hover:underline">
                    Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-ink-400">Aucune notification</div>
                )}
                {notifications.slice(0, 8).map((n) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 border-b border-ink-50 px-4 py-3 last:border-0 dark:border-ink-800/50 ${!n.read ? 'bg-brand-50/40 dark:bg-brand-950/20' : ''}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sevColor[n.severity] || 'bg-ink-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-800 dark:text-ink-100">{n.title}</div>
                      {n.message && <div className="truncate text-xs text-ink-500">{n.message}</div>}
                      <div className="mt-0.5 text-[10px] text-ink-400">{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User avatar dropdown */}
        {profile && (
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setUserOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-soft">
                {initials(profile.full_name || profile.id)}
              </div>
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">
                  {profile.full_name || 'Utilisateur'}
                </span>
                <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-semibold ${ROLE_COLORS[profile.role]}`}>
                  {ROLE_LABELS[profile.role]}
                </span>
              </div>
            </button>
            {userOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-ink-200 animate-scale-in dark:bg-ink-900 dark:ring-ink-800">
                <div className="border-b border-ink-100 px-4 py-3 dark:border-ink-800">
                  <div className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                    {profile.full_name || 'Utilisateur'}
                  </div>
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[profile.role]}`}>
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>
                {canAccess(profile.role, 'settings') && (
                  <button
                    onClick={() => { onNavigate('settings'); setUserOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-600 transition hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800"
                  >
                    <Settings size={15} className="text-ink-400" /> Paramètres
                  </button>
                )}
                <button
                  onClick={() => { onNavigate('settings'); setUserOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-ink-600 transition hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800"
                >
                  <User size={15} className="text-ink-400" /> Mon profil
                </button>
                <div className="border-t border-ink-100 dark:border-ink-800">
                  <button
                    onClick={() => { onSignOut(); setUserOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <LogOut size={15} /> Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
