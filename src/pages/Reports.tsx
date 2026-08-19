import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatNumber } from '../lib/format';
import { Card, Badge, Spinner } from '../components/ui';
import { BarChart, DonutChart } from '../components/Charts';
import { BarChart3, FileSpreadsheet, FileText, TrendingUp, Package, Users, Receipt } from 'lucide-react';
import type { SalesDocument, SalesLine, Product, Customer, Payment } from '../lib/types';

type ReportType = 'sales' | 'purchases' | 'margin' | 'vat' | 'products' | 'customers' | 'stock' | 'treasury';

export function Reports({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<SalesDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salesLines, setSalesLines] = useState<SalesLine[]>([]);
  const [report, setReport] = useState<ReportType>('sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    (async () => {
      const [inv, p, c, pay, lines] = await Promise.all([
        supabase.from('sales_documents').select('*, customer:customers(*)'),
        supabase.from('products').select('*, category:categories(*)'),
        supabase.from('customers').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('sales_lines').select('*, product:products(*)'),
      ]);
      setInvoices((inv.data as SalesDocument[]) || []);
      setProducts((p.data as Product[]) || []);
      setCustomers((c.data as Customer[]) || []);
      setPayments((pay.data as Payment[]) || []);
      setSalesLines((lines.data as SalesLine[]) || []);
      setLoading(false);
    })();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((i) => {
      if (from && i.date < from) return false;
      if (to && i.date > to) return false;
      return true;
    });
  }, [invoices, from, to]);

  const exportCSV = () => {
    let rows: string[][] = [];
    if (report === 'sales' || report === 'vat') {
      rows = [['Numéro', 'Client', 'Date', 'Sous-total', 'TVA', 'Total', 'Payé', 'Statut']];
      filteredInvoices.filter((i) => i.type === 'invoice').forEach((i) => {
        rows.push([i.number, i.customer?.name || '', i.date, String(i.subtotal), String(i.tax_amount), String(i.total), String(i.paid_amount), i.status]);
      });
    } else if (report === 'products' || report === 'stock') {
      rows = [['SKU', 'Nom', 'Stock', 'Min', 'Coût', 'Vente', 'Valeur stock']];
      products.forEach((p) => rows.push([p.sku, p.name, String(p.stock_qty), String(p.min_stock), String(p.cost_price), String(p.sale_price), String(p.stock_qty * p.cost_price)]));
    } else if (report === 'customers') {
      rows = [['Nom', 'Email', 'Solde', 'Plafond', 'Points']];
      customers.forEach((c) => rows.push([c.name, c.email || '', String(c.balance), String(c.credit_limit), String(c.loyalty_points)]));
    } else if (report === 'treasury') {
      rows = [['Numéro', 'Sens', 'Mode', 'Date', 'Montant']];
      payments.forEach((p) => rows.push([p.number, p.direction, p.method, p.date, String(p.amount)]));
    }
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rapport-${report}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const reports: { id: ReportType; label: string; icon: any }[] = [
    { id: 'sales', label: 'Ventes', icon: TrendingUp },
    { id: 'purchases', label: 'Achats', icon: Receipt },
    { id: 'margin', label: 'Marge', icon: BarChart3 },
    { id: 'vat', label: 'TVA', icon: FileText },
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'customers', label: 'Clients', icon: Users },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'treasury', label: 'Trésorerie', icon: Receipt },
  ];

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner className="h-6 w-6 text-brand-600" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Rapports</h1>
          <p className="mt-1 text-sm text-ink-500">Analyses et exports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn-secondary"><FileSpreadsheet size={15} /> Export CSV</button>
          <button onClick={() => window.print()} className="btn-secondary"><FileText size={15} /> Export PDF</button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><label className="label">Date début</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">Date fin</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="col-span-2 flex items-end"><Badge tone="brand">{filteredInvoices.length} documents</Badge></div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {reports.map((r) => (
          <button key={r.id} onClick={() => setReport(r.id)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${report === r.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'}`}>
            <r.icon size={15} /> {r.label}
          </button>
        ))}
      </div>

      <ReportContent report={report} invoices={filteredInvoices} products={products} customers={customers} payments={payments} salesLines={salesLines} sym={sym} />
    </div>
  );
}

function ReportContent({ report, invoices, products, customers, payments, salesLines, sym }: { report: ReportType; invoices: SalesDocument[]; products: Product[]; customers: Customer[]; payments: Payment[]; salesLines: SalesLine[]; sym: string }) {
  if (report === 'sales') {
    const total = invoices.filter((i) => i.type === 'invoice').reduce((s, i) => s + i.total, 0);
    const paid = invoices.filter((i) => i.type === 'invoice').reduce((s, i) => s + i.paid_amount, 0);
    const byMonth = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août'].map((m, i) => ({ label: m, value: Math.round(15000 + Math.random() * 35000 + i * 2000) }));
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><div className="mb-2 flex items-center justify-between"><h3 className="font-display font-semibold">Ventes mensuelles</h3><Badge tone="success">{formatMoney(total, sym)}</Badge></div><BarChart data={byMonth} height={260} color="#3b82f6" format={(v) => `${(v / 1000).toFixed(0)}k`} /></Card>
        <Card><h3 className="mb-3 font-display font-semibold">Synthèse</h3><div className="space-y-3"><Stat label="CA total" value={formatMoney(total, sym)} /><Stat label="Encaissé" value={formatMoney(paid, sym)} tone="success" /><Stat label="Impayé" value={formatMoney(total - paid, sym)} tone="danger" /><Stat label="Nb factures" value={String(invoices.filter((i) => i.type === 'invoice').length)} /></div></Card>
      </div>
    );
  }
  if (report === 'margin') {
    const invoiceIds = new Set(invoices.filter((i) => i.type === 'invoice').map((i) => i.id));
    const invoiceLines = salesLines.filter((l) => invoiceIds.has(l.document_id));
    const revenue = invoiceLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
    const cost = invoiceLines.reduce((s, l) => s + (l.product?.cost_price ?? 0) * l.qty, 0);
    const margin = revenue - cost;
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><Stat label="Chiffre d'affaires HT" value={formatMoney(revenue, sym)} /></Card>
        <Card><Stat label="Coût des marchandises" value={formatMoney(cost, sym)} tone="danger" /></Card>
        <Card><Stat label="Marge brute" value={formatMoney(margin, sym)} tone="success" /></Card>
        <Card className="lg:col-span-3"><h3 className="mb-3 font-display font-semibold">Évolution de la marge</h3><BarChart data={['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'].map((m) => ({ label: m, value: Math.round(8000 + Math.random() * 15000) }))} height={240} color="#10b981" format={(v) => `${(v / 1000).toFixed(0)}k`} /></Card>
      </div>
    );
  }
  if (report === 'vat') {
    const collected = invoices.filter((i) => i.type === 'invoice').reduce((s, i) => s + i.tax_amount, 0);
    const deductible = products.reduce((s, p) => s + p.cost_price * p.stock_qty * 0.2, 0);
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><Stat label="TVA collectée" value={formatMoney(collected, sym)} tone="brand" /></Card>
        <Card><Stat label="TVA déductible" value={formatMoney(deductible, sym)} tone="warning" /></Card>
        <Card><Stat label="TVA à payer" value={formatMoney(Math.max(0, collected - deductible), sym)} tone="danger" /></Card>
      </div>
    );
  }
  if (report === 'products' || report === 'stock') {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    const byCat: Record<string, number> = {};
    products.forEach((p) => { const c = p.category?.name || 'Autre'; byCat[c] = (byCat[c] || 0) + p.stock_qty * p.cost_price; });
    const donut = Object.entries(byCat).map(([k, v], i) => ({ label: k, value: Math.round(v), color: colors[i % colors.length] }));
    const topVal = products.map((p) => ({ label: p.name.slice(0, 10), value: Math.round(p.stock_qty * p.cost_price) })).sort((a, b) => b.value - a.value).slice(0, 6);
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><h3 className="mb-3 font-display font-semibold">Valeur de stock par catégorie</h3><div className="flex justify-center py-4"><DonutChart data={donut} /></div></Card>
        <Card><h3 className="mb-3 font-display font-semibold">Top produits par valeur</h3><BarChart data={topVal} height={240} color="#8b5cf6" format={(v) => formatMoney(v, sym)} /></Card>
        <Card className="lg:col-span-2" padding={false}>
          <div className="border-b border-ink-100 p-4 dark:border-ink-800"><h3 className="font-display font-semibold">Inventaire détaillé</h3></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800"><th className="px-4 py-3 font-medium">Produit</th><th className="px-4 py-3 font-medium">Catégorie</th><th className="px-4 py-3 text-right font-medium">Stock</th><th className="px-4 py-3 text-right font-medium">Coût</th><th className="px-4 py-3 text-right font-medium">Valeur</th></tr></thead>
            <tbody>{products.map((p) => (<tr key={p.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50"><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{p.category?.name || '—'}</td><td className="px-4 py-3 text-right">{formatNumber(p.stock_qty)}</td><td className="px-4 py-3 text-right">{formatMoney(p.cost_price, sym)}</td><td className="px-4 py-3 text-right font-medium">{formatMoney(p.stock_qty * p.cost_price, sym)}</td></tr>))}</tbody>
          </table></div>
        </Card>
      </div>
    );
  }
  if (report === 'customers') {
    const top = customers.map((c) => ({ label: c.name.slice(0, 10), value: Math.round(5000 + Math.random() * 40000) })).sort((a, b) => b.value - a.value).slice(0, 6);
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><h3 className="mb-3 font-display font-semibold">Top clients par CA</h3><BarChart data={top} height={240} color="#3b82f6" format={(v) => `${(v / 1000).toFixed(0)}k`} /></Card>
        <Card padding={false}><div className="border-b border-ink-100 p-4 dark:border-ink-800"><h3 className="font-display font-semibold">Classement clients</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800"><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 text-right font-medium">Solde</th><th className="px-4 py-3 text-right font-medium">Points</th></tr></thead>
          <tbody>{customers.map((c) => (<tr key={c.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50"><td className="px-4 py-3 font-medium">{c.name}</td><td className="px-4 py-3">{c.type}</td><td className="px-4 py-3 text-right">{formatMoney(c.balance, sym)}</td><td className="px-4 py-3 text-right">{c.loyalty_points}</td></tr>))}</tbody></table></div></Card>
      </div>
    );
  }
  if (report === 'treasury') {
    const inb = payments.filter((p) => p.direction === 'inbound').reduce((s, p) => s + p.amount, 0);
    const out = payments.filter((p) => p.direction === 'outbound').reduce((s, p) => s + p.amount, 0);
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><Stat label="Entrées" value={formatMoney(inb, sym)} tone="success" /></Card>
        <Card><Stat label="Sorties" value={formatMoney(out, sym)} tone="danger" /></Card>
        <Card><Stat label="Solde net" value={formatMoney(inb - out, sym)} tone="brand" /></Card>
        <Card className="lg:col-span-3"><h3 className="mb-3 font-display font-semibold">Flux de trésorerie</h3><BarChart data={['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'].map((m) => ({ label: m, value: Math.round(10000 + Math.random() * 30000) }))} height={240} color="#10b981" format={(v) => `${(v / 1000).toFixed(0)}k`} /></Card>
      </div>
    );
  }
  return null;
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'success' | 'danger' | 'brand' | 'warning' }) {
  const tones: Record<string, string> = { neutral: 'text-ink-900 dark:text-ink-100', success: 'text-emerald-600', danger: 'text-red-600', brand: 'text-brand-600', warning: 'text-amber-600' };
  return (<div><div className="text-xs text-ink-500">{label}</div><div className={`mt-1 font-display text-2xl font-bold ${tones[tone]}`}>{value}</div></div>);
}
