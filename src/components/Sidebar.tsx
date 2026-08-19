import { NAV, NAV_GROUPS } from '../lib/nav';
import { Boxes, LogOut, ChevronRight } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS, canAccess } from '../lib/auth';
import type { Profile } from '../lib/types';

export function Sidebar({
  current,
  onNavigate,
  open,
  onClose,
  stockAlerts = 0,
  salesAlerts = 0,
  profile,
  onSignOut,
}: {
  current: string;
  onNavigate: (id: string) => void;
  open: boolean;
  onClose: () => void;
  stockAlerts?: number;
  salesAlerts?: number;
  profile: Profile | null;
  onSignOut: () => void;
}) {
  const role = profile?.role;

  const badgeFor = (id: string) => {
    if (id === 'products' && stockAlerts > 0) return stockAlerts;
    if (id === 'sales' && salesAlerts > 0) return salesAlerts;
    return null;
  };

  const initials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-ink-200 bg-white transition-transform duration-300 lg:translate-x-0 dark:border-ink-800 dark:bg-ink-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-ink-100 px-5 dark:border-ink-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
            <Boxes size={20} />
          </div>
          <div>
            <div className="font-display text-sm font-bold leading-tight">Nexus ERP</div>
            <div className="text-[11px] text-ink-400">Gestion Commerciale</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const items = NAV.filter((n) => n.group === group && canAccess(role, n.id));
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-5">
                <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  {group}
                </div>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = current === item.id;
                  const badge = badgeFor(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavigate(item.id); onClose(); }}
                      className={`group mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        active
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300'
                          : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
                      }`}
                    >
                      <Icon
                        size={18}
                        className={active ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 group-hover:text-ink-600 dark:group-hover:text-ink-200'}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge !== null && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {badge}
                        </span>
                      )}
                      {item.badge === 'ai' && (
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User profile footer */}
        {profile && (
          <div className="shrink-0 border-t border-ink-100 p-3 dark:border-ink-800">
            <div className="flex items-center gap-2.5 rounded-xl p-2 hover:bg-ink-50 dark:hover:bg-ink-800/50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white shadow-soft">
                {initials(profile.full_name || profile.id)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {profile.full_name || 'Utilisateur'}
                </div>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[profile.role]}`}>
                  {ROLE_LABELS[profile.role]}
                </span>
              </div>
              <button
                onClick={onSignOut}
                title="Se déconnecter"
                className="rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <LogOut size={15} />
              </button>
            </div>
            {profile.role === 'admin' && (
              <button
                onClick={() => { onNavigate('settings'); onClose(); }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-ink-500 transition hover:bg-ink-50 hover:text-ink-700 dark:hover:bg-ink-800"
              >
                <ChevronRight size={12} />
                Gérer les utilisateurs
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
