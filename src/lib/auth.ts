export type UserRole = 'admin' | 'manager' | 'sales' | 'accountant' | 'cashier' | 'warehouse';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Manager',
  sales: 'Commercial',
  accountant: 'Comptable',
  cashier: 'Caissier',
  warehouse: 'Magasinier',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  manager: 'bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-400',
  sales: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  accountant: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  cashier: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300',
  warehouse: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
};

// Which nav page IDs each role can access
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'sales', 'pos', 'products', 'services', 'inventory', 'stock-movements', 'customers', 'suppliers', 'purchases', 'payments', 'reports', 'ai', 'ocr', 'archives', 'settings'],
  manager: ['dashboard', 'sales', 'pos', 'products', 'services', 'inventory', 'stock-movements', 'customers', 'suppliers', 'purchases', 'payments', 'reports', 'ai', 'ocr', 'archives'],
  sales: ['dashboard', 'sales', 'customers', 'pos', 'services', 'ai'],
  accountant: ['dashboard', 'sales', 'payments', 'reports', 'ai', 'ocr'],
  cashier: ['pos', 'services'],
  warehouse: ['dashboard', 'products', 'inventory', 'stock-movements', 'purchases', 'ocr'],
};

export function canAccess(role: UserRole | undefined, page: string): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false;
}

export function defaultPage(role: UserRole | undefined): string {
  if (!role) return 'dashboard';
  const pages = ROLE_PERMISSIONS[role];
  return pages?.[0] ?? 'dashboard';
}
