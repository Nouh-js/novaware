import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Store,
  BarChart3,
  Sparkles,
  Settings,
  FileText,
  CreditCard,
  Archive,
  ScanLine,
  Briefcase,
  ClipboardList,
  ArrowLeftRight,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  badge?: 'sales' | 'stock' | 'ai';
};

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, group: 'Pilotage' },
  { id: 'sales', label: 'Documents commerciaux', icon: ShoppingCart, group: 'Commercial', badge: 'sales' },
  { id: 'pos', label: 'Point de Vente', icon: Store, group: 'Commercial' },
  { id: 'services', label: 'Services', icon: Briefcase, group: 'Commercial' },
  { id: 'products', label: 'Produits & Stock', icon: Package, group: 'Logistique', badge: 'stock' },
  { id: 'inventory', label: 'Inventaire', icon: ClipboardList, group: 'Logistique' },
  { id: 'stock-movements', label: 'Mouvements de stock', icon: ArrowLeftRight, group: 'Logistique' },
  { id: 'customers', label: 'Clients', icon: Users, group: 'Tiers' },
  { id: 'suppliers', label: 'Fournisseurs', icon: Truck, group: 'Tiers' },
  { id: 'purchases', label: 'Achats', icon: FileText, group: 'Tiers' },
  { id: 'payments', label: 'Paiements', icon: CreditCard, group: 'Finance' },
  { id: 'reports', label: 'Rapports', icon: BarChart3, group: 'Finance' },
  { id: 'ai', label: 'Assistant IA', icon: Sparkles, group: 'Intelligence', badge: 'ai' },
  { id: 'ocr', label: 'OCR Factures', icon: ScanLine, group: 'Intelligence' },
  { id: 'archives', label: 'Archives', icon: Archive, group: 'Système' },
  { id: 'settings', label: 'Paramètres', icon: Settings, group: 'Système' },
];

export const NAV_GROUPS = ['Pilotage', 'Commercial', 'Logistique', 'Tiers', 'Finance', 'Intelligence', 'Système'];
