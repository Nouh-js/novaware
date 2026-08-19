import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatNumber, timeAgo } from '../lib/format';
import { Card, SectionTitle, Badge, Spinner } from '../components/ui';
import { AreaChart, DonutChart, BarChart } from '../components/Charts';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Wallet,
  Package,
  AlertTriangle,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  Users,
  Receipt,
  Activity as ActivityIcon,
} from 'lucide-react';
import type {
  SalesDocument,
  SalesLine,
  Product,
  Customer,
  Activity,
  Notification,
  Payment,
  Settings,
} from '../lib/types';

export function Dashboard({
  onNavigate,
  settings,
}: {
  onNavigate: (id: string) => void;
  settings: Settings | null;
}) {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<SalesDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesLines, setSalesLines] = useState<SalesLine[]>([]);

  const sym = settings?.currency_symbol || 'DH';

  useEffect(() => {
    (async () => {
      const [inv, prods, acts, nots, pays, custs, lines] = await Promise.all([
        supabase.from('sales_documents').select('*').order('date', { ascending: false }),
        supabase.from('products').select('*, category:categories(*)'),
        supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('payments').select('*').order('date', { ascending: false }),
        supabase.from('customers').select('*'),
        supabase.from('sales_lines').select('*, product:products(*)'),
      ]);
      setInvoices((inv.data as SalesDocument[]) || []);
      setProducts((prods.data as Product[]) || []);
      setActivities((acts.data as Activity[]) || []);
      setNotifications((nots.data as Notification[]) || []);
      setPayments((pays.data as Payment[]) || []);
      setCustomers((custs.data as Customer[]) || []);
      setSalesLines((lines.data as SalesLine[]) || []);
      setLoading(false);
    })();
  }, []);

  const kpis = useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.type === 'invoice' && (i.status === 'paid' || i.status === 'partial'));
    const revenue = paidInvoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
    const todaySales = invoices
      .filter((i) => i.type === 'invoice' && i.date === new Date().toISOString().slice(0, 10))
      .reduce((s, i) => s + (i.total || 0), 0);
    const unpaid = invoices
      .filter((i) => i.type === 'invoice' && (i.status === 'partial' || i.status === 'overdue' || (i.status === 'sent' && i.paid_amount < i.total)))
      .reduce((s, i) => s + (i.total - i.paid_amount), 0);
    const invoiceIds = new Set(paidInvoices.map((i) => i.id));
    const margin = salesLines
      .filter((l) => invoiceIds.has(l.document_id))
      .reduce((s, l) => s + (l.unit_price * l.qty) - ((l.product?.cost_price ?? 0) * l.qty), 0);
    const inbound = payments.filter((p) => p.direction === 'inbound').reduce((s, p) => s + p.amount, 0);
    const outbound = payments.filter((p) => p.direction === 'outbound').reduce((s, p) => s + p.amount, 0);
    const activeCustomerIds = new Set(invoices.filter((i) => i.customer_id).map((i) => i.customer_id));
    const activeCustomers = customers.filter((c) => activeCustomerIds.has(c.id)).length;
    const netCash = inbound - outbound;
    const stockValue = products.reduce((s, p) => s + p.cost_price * p.stock_qty, 0);
    return { revenue, todaySales, unpaid, margin, inbound, outbound, netCash, activeCustomers, stockValue };
  }, [invoices, payments, customers, products, salesLines]);

  const stockAlerts = products.filter((p) => p.stock_qty <= p.min_stock);
  const outOfStock = products.filter((p) => p.stock_qty <= 0);
  const pendingOrders = invoices.filter((i) => i.type === 'order' && i.status !== 'cancelled').length;

  const revenueSeries = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return days.map((d, i) => ({
      label: d,
      value: Math.round(8000 + Math.random() * 12000 + i * 800),
    }));
  }, []);

  const categoryDist = useMemo(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    const map: Record<string, number> = {};
    products.forEach((p) => {
      const cat = p.category?.name || 'Autre';
      map[cat] = (map[cat] || 0) + p.stock_qty;
    });
    return Object.entries(map).map(([k, v], i) => ({
      label: k.slice(0, 6),
      value: v,
      color: colors[i % colors.length],
    }));
  }, [products]);

  const topProducts = useMemo(() => {
    return products
      .slice()
      .sort((a, b) => b.sale_price * b.stock_qty - a.sale_price * a.stock_qty)
      .slice(0, 5)
      .map((p) => ({ label: p.name.slice(0, 8), value: Math.round(p.sale_price * p.stock_qty) }));
  }, [products]);

  const monthlyBars = useMemo(
    () => ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'].map((m) => ({ label: m, value: Math.round(20000 + Math.random() * 40000) })),
    [],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-ink-500">
          Vue d'ensemble de l'activité commerciale — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Chiffre d'affaires"
          value={formatMoney(kpis.revenue, sym)}
          delta="+12.4%"
          up
          icon={<TrendingUp size={18} />}
          tone="brand"
        />
        <KpiCard
          label="Ventes du jour"
          value={formatMoney(kpis.todaySales, sym)}
          delta="+5.2%"
          up
          icon={<ShoppingCart size={18} />}
          tone="emerald"
        />
        <KpiCard
          label="Marge brute"
          value={formatMoney(kpis.margin, sym)}
          delta="+3.1%"
          up
          icon={<Wallet size={18} />}
          tone="amber"
        />
        <KpiCard
          label="Factures impayées"
          value={formatMoney(kpis.unpaid, sym)}
          delta="-2.0%"
          up={false}
          icon={<FileText size={18} />}
          tone="red"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MiniStat label="Valeur de stock" value={formatMoney(kpis.stockValue, sym)} icon={<Boxes size={16} />} onClick={() => onNavigate('products')} />
        <MiniStat label="Produits en stock" value={formatNumber(products.length)} icon={<Boxes size={16} />} onClick={() => onNavigate('products')} />
        <MiniStat label="Stock faible" value={formatNumber(stockAlerts.length)} icon={<AlertTriangle size={16} />} tone="warning" onClick={() => onNavigate('products')} />
        <MiniStat label="Ruptures" value={formatNumber(outOfStock.length)} icon={<Package size={16} />} tone="danger" onClick={() => onNavigate('products')} />
        <MiniStat label="Commandes en attente" value={formatNumber(pendingOrders)} icon={<Clock size={16} />} onClick={() => onNavigate('sales')} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Évolution du chiffre d'affaires"
            subtitle="7 derniers jours"
            action={<Badge tone="success"><TrendingUp size={12} /> +12.4%</Badge>}
          />
          <AreaChart data={revenueSeries} height={240} format={(v) => `${(v / 1000).toFixed(0)}k`} />
        </Card>
        <Card>
          <SectionTitle title="Répartition du stock" subtitle="Par catégorie" />
          <div className="flex justify-center py-2">
            <DonutChart data={categoryDist} />
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle title="Activité récente" />
          <div className="space-y-1">
            {activities.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-400">Aucune activité</p>
            )}
            {activities.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Top produits" subtitle="Par valeur de stock" />
          <BarChart data={topProducts} height={200} color="#10b981" format={(v) => formatMoney(v, sym)} />
        </Card>

        <Card>
          <SectionTitle title="Alertes & notifications" action={<button onClick={() => onNavigate('settings')} className="text-xs font-medium text-brand-600 hover:underline">Voir tout</button>} />
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 rounded-lg p-2 transition hover:bg-ink-50 dark:hover:bg-ink-800/60">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  n.severity === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' :
                  n.severity === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400' :
                  'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
                }`}>
                  <AlertTriangle size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-800 dark:text-ink-100">{n.title}</div>
                  {n.message && <div className="text-xs text-ink-500">{n.message}</div>}
                  <div className="text-[10px] text-ink-400">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Cash flow */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Flux de trésorerie" subtitle="6 derniers mois" />
          <BarChart data={monthlyBars} height={200} color="#3b82f6" format={(v) => `${(v / 1000).toFixed(0)}k`} />
        </Card>
        <Card>
          <SectionTitle title="Encaissements vs Décaissements" />
          <div className="grid grid-cols-2 gap-4 pt-2">
            <FlowCard label="Encaissements" value={formatMoney(kpis.inbound, sym)} icon={<ArrowUpRight size={18} />} tone="success" />
            <FlowCard label="Décaissements" value={formatMoney(kpis.outbound, sym)} icon={<ArrowDownRight size={18} />} tone="danger" />
            <FlowCard label="Solde net" value={formatMoney(kpis.netCash, sym)} icon={<Wallet size={18} />} tone="brand" />
            <FlowCard label="Clients actifs" value={formatNumber(kpis.activeCustomers)} icon={<Users size={18} />} tone="info" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  up,
  icon,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  up: boolean;
  icon: React.ReactNode;
  tone: 'brand' | 'emerald' | 'amber' | 'red';
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
  };
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-500">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        <span className={`inline-flex items-center gap-0.5 font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {delta}
        </span>
        <span className="text-ink-400">vs période précédente</span>
      </div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  icon,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    neutral: 'text-ink-500',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  };
  return (
    <button
      onClick={onClick}
      className="card flex items-center gap-3 p-4 text-left transition hover:shadow-pop"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 ${tones[tone]} dark:bg-ink-800`}>
        {icon}
      </div>
      <div>
        <div className="font-display text-lg font-bold">{value}</div>
        <div className="text-xs text-ink-500">{label}</div>
      </div>
    </button>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const icons: Record<string, React.ReactNode> = {
    sale: <Receipt size={14} className="text-brand-600" />,
    payment: <Wallet size={14} className="text-emerald-600" />,
    stock: <AlertTriangle size={14} className="text-amber-600" />,
    purchase: <ShoppingCart size={14} className="text-sky-600" />,
    customer: <Users size={14} className="text-violet-600" />,
    product: <Package size={14} className="text-ink-600" />,
    system: <ActivityIcon size={14} className="text-ink-600" />,
  };
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-ink-50 dark:hover:bg-ink-800/60">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-800">
        {icons[activity.type] || icons.system}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{activity.title}</div>
        {activity.description && <div className="truncate text-xs text-ink-500">{activity.description}</div>}
      </div>
      <div className="text-[10px] text-ink-400">{timeAgo(activity.created_at)}</div>
    </div>
  );
}

function FlowCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: 'success' | 'danger' | 'brand' | 'info';
}) {
  const tones: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    danger: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400',
    info: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
  };
  return (
    <div className="rounded-xl border border-ink-100 p-4 dark:border-ink-800">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-xs text-ink-500">{label}</div>
    </div>
  );
}
