import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatDate } from '../lib/format';
import { Card, Badge, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import {
  ClipboardList, Plus, Search, Eye, ArrowRight, X, Check, RotateCcw,
  ArrowLeft, ScanLine, AlertTriangle, TrendingUp, TrendingDown, Package,
  FileText, ChevronRight,
} from 'lucide-react';
import type {
  Inventory as InventoryT, InventoryLine, InventoryType, InventoryStatus,
  Product, Profile,
} from '../lib/types';
import { INVENTORY_TYPE_LABELS, INVENTORY_STATUS_LABELS, GAP_REASONS } from '../lib/types';

type View = 'dashboard' | 'list' | 'wizard' | 'counting' | 'gaps' | 'detail';

const STATUS_TONES: Record<InventoryStatus, 'neutral' | 'brand' | 'warning' | 'error' | 'success'> = {
  draft: 'neutral', preparing: 'brand', counting: 'warning', gap_check: 'error', validated: 'success', cancelled: 'neutral',
};

export function Inventory({ settings, profile }: { settings: any; profile: Profile | null }) {
  const sym = settings?.currency_symbol || 'DH';
  const [view, setView] = useState<View>('dashboard');
  const [inventories, setInventories] = useState<InventoryT[]>([]);
  const [current, setCurrent] = useState<InventoryT | null>(null);
  const [lines, setLines] = useState<InventoryLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [gapLines, setGapLines] = useState<InventoryLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCancel, setShowCancel] = useState(false);
  const [showValidate, setShowValidate] = useState(false);
  const [recountLine, setRecountLine] = useState<InventoryLine | null>(null);
  const [recountValues, setRecountValues] = useState({ count2: '', count3: '' });

  const loadAll = async () => {
    setLoading(true);
    const { data: invs } = await supabase.from('inventories').select('*').order('created_at', { ascending: false });
    setInventories((invs as InventoryT[]) || []);
    const { data: prods } = await supabase.from('products').select('*').eq('active', true).order('name');
    setProducts((prods as Product[]) || []);
    const { data: movs } = await supabase.from('stock_movements').select('*, product:products(name)').order('created_at', { ascending: false }).limit(10);
    setRecentMovements(movs || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const filteredInvs = useMemo(() => {
    const q = search.toLowerCase();
    return inventories.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (!q) return true;
      return i.number.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || (i.responsible || '').toLowerCase().includes(q);
    });
  }, [inventories, search, statusFilter]);

  const loadLines = async (invId: string) => {
    const { data } = await supabase.from('inventory_lines').select('*, product:products(*)').eq('inventory_id', invId).order('created_at');
    setLines((data as InventoryLine[]) || []);
  };

  const openInventory = async (inv: InventoryT, target: View) => {
    setCurrent(inv);
    await loadLines(inv.id);
    setView(target);
  };

  // ── Dashboard KPIs ──────────────────────────────────────────────────────
  const totalProducts = products.length;
  const stockValue = products.reduce((s, p) => s + p.stock_qty * p.cost_price, 0);
  const inProgress = inventories.filter((i) => ['draft', 'preparing', 'counting', 'gap_check'].includes(i.status)).length;
  const lowStock = products.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.min_stock).length;
  const outOfStock = products.filter((p) => p.stock_qty <= 0).length;

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [wizStep, setWizStep] = useState(1);
  const [wiz, setWiz] = useState({
    name: '', date: new Date().toISOString().slice(0, 10), type: 'general' as InventoryType,
    warehouse: 'Principal', location: '', responsible: profile?.full_name || '', comment: '',
  });
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [wizSearch, setWizSearch] = useState('');
  const [wizCategory, setWizCategory] = useState('all');
  const [creating, setCreating] = useState(false);

  const wizPreviewNumber = useMemo(() => {
    const year = new Date().getFullYear();
    const count = inventories.filter((i) => i.number.startsWith(`INV-${year}-`)).length;
    return `INV-${year}-${String(count + 1).padStart(3, '0')}`;
  }, [inventories]);

  const wizFilteredProducts = useMemo(() => {
    const q = wizSearch.toLowerCase();
    return products.filter((p) => {
      if (wizCategory !== 'all' && (p.category_id || '') !== wizCategory) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').includes(q);
    });
  }, [products, wizSearch, wizCategory]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startCounting = async () => {
    setCreating(true);
    const ids = wiz.type === 'general' ? products.map((p) => p.id) : Array.from(selectedProductIds);
    if (ids.length === 0) { toast('Sélectionnez au moins un produit', 'error'); setCreating(false); return; }
    const { data: invData, error: invErr } = await supabase.from('inventories').insert({
      number: wizPreviewNumber, name: wiz.name || `Inventaire ${wizPreviewNumber}`, date: wiz.date,
      type: wiz.type, warehouse: wiz.warehouse, location: wiz.location || null,
      responsible: wiz.responsible || null, comment: wiz.comment || null,
      status: 'counting', total_items: ids.length,
    }).select().single();
    if (invErr) { toast('Erreur création inventaire', 'error'); setCreating(false); return; }
    const inv = invData as InventoryT;
    const linePayloads = ids.map((pid) => {
      const p = products.find((x) => x.id === pid);
      return { inventory_id: inv.id, product_id: pid, theoretical_qty: p?.stock_qty ?? 0, unit_cost: p?.cost_price ?? 0 };
    });
    await supabase.from('inventory_lines').insert(linePayloads);
    await supabase.from('activities').insert({ type: 'inventory', title: `Inventaire ${inv.number} créé`, description: inv.name, icon: 'ClipboardList' });
    setCreating(false);
    toast(`Inventaire ${inv.number} créé`);
    await loadAll();
    await openInventory(inv, 'counting');
    setWizStep(1);
    setWiz({ name: '', date: new Date().toISOString().slice(0, 10), type: 'general', warehouse: 'Principal', location: '', responsible: profile?.full_name || '', comment: '' });
    setSelectedProductIds(new Set());
  };

  // ── Counting ──────────────────────────────────────────────────────────────
  const [countSearch, setCountSearch] = useState('');
  const [quickMode, setQuickMode] = useState(false);
  const [scanInput, setScanInput] = useState('');

  const countFiltered = useMemo(() => {
    const q = countSearch.toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => {
      const pn = l.product?.name || '';
      return pn.toLowerCase().includes(q) || (l.product?.sku || '').toLowerCase().includes(q) || (l.product?.barcode || '').includes(q);
    });
  }, [lines, countSearch]);

  const savePhysicalQty = async (lineId: string, physical: number) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const gap = physical - line.theoretical_qty;
    const countStatus = gap === 0 ? 'conform' : 'gap';
    setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, physical_qty: physical, gap, count1: physical, count_status: countStatus } : l));
    await supabase.from('inventory_lines').update({ physical_qty: physical, gap, count1: physical, count_status: countStatus, updated_at: new Date().toISOString() }).eq('id', lineId);
    updateProgress();
  };

  const updateProgress = async () => {
    const counted = lines.filter((l) => l.physical_qty !== null).length;
    if (current) {
      await supabase.from('inventories').update({ progress: counted }).eq('id', current.id);
    }
  };

  const handleScan = () => {
    const code = scanInput.trim();
    if (!code) return;
    const line = lines.find((l) => l.product?.barcode === code || l.product?.sku === code);
    if (line) {
      if (quickMode) {
        const newQty = (line.physical_qty ?? 0) + 1;
        savePhysicalQty(line.id, newQty);
        toast(`${line.product?.name}: ${newQty}`);
      } else {
        const el = document.getElementById(`phy-${line.id}`);
        if (el) { el.focus(); }
      }
    } else {
      toast('Produit non trouvé', 'error');
    }
    setScanInput('');
  };

  const finishCounting = async () => {
    if (!current) return;
    const hasGaps = lines.some((l) => l.physical_qty !== null && l.gap !== 0);
    const allCounted = lines.every((l) => l.physical_qty !== null);
    const newStatus: InventoryStatus = hasGaps ? 'gap_check' : 'validated';
    await supabase.from('inventories').update({ status: newStatus, progress: lines.filter((l) => l.physical_qty !== null).length }).eq('id', current.id);
    if (!hasGaps && allCounted) {
      await validateInventory(true);
    } else {
      toast('Comptage terminé — vérifiez les écarts');
      await loadAll();
      const updated = { ...current, status: 'gap_check' as InventoryStatus };
      setCurrent(updated);
      setView('gaps');
    }
  };

  // ── Gaps ──────────────────────────────────────────────────────────────────
  const gapLinesWithGaps = useMemo(() => lines.filter((l) => l.physical_qty !== null && l.gap !== 0), [lines]);
  const gapKpis = useMemo(() => {
    const counted = lines.filter((l) => l.physical_qty !== null).length;
    const conform = lines.filter((l) => l.physical_qty !== null && l.gap === 0).length;
    const posGaps = gapLinesWithGaps.filter((l) => l.gap > 0).length;
    const negGaps = gapLinesWithGaps.filter((l) => l.gap < 0).length;
    const totalValue = gapLinesWithGaps.reduce((s, l) => s + l.gap * l.unit_cost, 0);
    return { counted, conform, posGaps, negGaps, totalValue };
  }, [lines, gapLinesWithGaps]);

  const setGapReason = async (lineId: string, reason: string) => {
    setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, gap_reason: reason, gap_status: 'verified' } : l));
    await supabase.from('inventory_lines').update({ gap_reason: reason, gap_status: 'verified', updated_at: new Date().toISOString() }).eq('id', lineId);
  };

  const validateInventory = async (skipDialog = false) => {
    if (!current) return;
    const gaps = lines.filter((l) => l.physical_qty !== null && l.gap !== 0);
    for (const l of gaps) {
      const { data: prod } = await supabase.from('products').select('stock_qty').eq('id', l.product_id).maybeSingle();
      const stockBefore = (prod as any)?.stock_qty ?? 0;
      const newStock = Math.max(0, l.theoretical_qty + l.gap);
      await supabase.from('products').update({ stock_qty: newStock, updated_at: new Date().toISOString() }).eq('id', l.product_id);
      await supabase.from('stock_movements').insert({
        product_id: l.product_id, type: 'inventory-adjustment', qty: l.gap, unit_cost: l.unit_cost,
        reason: l.gap_reason || 'Écart d\'inventaire', reference: current.number,
        stock_before: stockBefore, stock_after: newStock, user_name: profile?.full_name || null,
        warehouse: current.warehouse,
      });
    }
    await supabase.from('inventories').update({
      status: 'validated', validated_at: new Date().toISOString(), validated_by: profile?.full_name || null,
      updated_at: new Date().toISOString(),
    }).eq('id', current.id);
    await supabase.from('activities').insert({
      type: 'inventory', title: `Inventaire ${current.number} validé`,
      description: `${gaps.length} écarts appliqués`, icon: 'ClipboardList',
    });
    toast(`Inventaire ${current.number} validé — ${gaps.length} écarts appliqués`);
    setShowValidate(false);
    await loadAll();
    const updated = { ...current, status: 'validated' as InventoryStatus, validated_at: new Date().toISOString(), validated_by: profile?.full_name || null };
    setCurrent(updated);
    setView('detail');
  };

  const cancelInventory = async () => {
    if (!current) return;
    await supabase.from('inventories').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', current.id);
    toast('Inventaire annulé');
    setShowCancel(false);
    await loadAll();
    setView('list');
    setCurrent(null);
  };

  const saveRecount = async () => {
    if (!recountLine) return;
    const c2 = recountValues.count2 === '' ? null : parseFloat(recountValues.count2);
    const c3 = recountValues.count3 === '' ? null : parseFloat(recountValues.count3);
    const finalQty = c3 !== null ? c3 : c2 !== null ? c2 : recountLine.physical_qty;
    const gap = (finalQty ?? 0) - recountLine.theoretical_qty;
    setLines((prev) => prev.map((l) => l.id === recountLine.id ? { ...l, physical_qty: finalQty, count2: c2, count3: c3, gap, count_status: gap === 0 ? 'conform' : 'gap' } : l));
    await supabase.from('inventory_lines').update({ physical_qty: finalQty, count2: c2, count3: c3, gap, count_status: gap === 0 ? 'conform' : 'gap', updated_at: new Date().toISOString() }).eq('id', recountLine.id);
    toast('Recomptage enregistré');
    setRecountLine(null);
    setRecountValues({ count2: '', count3: '' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (view === 'dashboard') return <DashboardView settings={settings} sym={sym} loading={loading} totalProducts={totalProducts} stockValue={stockValue} inProgress={inProgress} lowStock={lowStock} outOfStock={outOfStock} inventories={inventories} recentMovements={recentMovements} onNew={() => setView('wizard')} onOpen={(inv) => openInventory(inv, 'detail')} onSeeAll={() => setView('list')} />;

  if (view === 'list') return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button onClick={() => setView('dashboard')} className="mb-1 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600"><ArrowLeft size={14} /> Tableau de bord</button>
          <h1 className="font-display text-2xl font-bold tracking-tight">Inventaires</h1>
        </div>
        <button className="btn-primary" onClick={() => { setWizStep(1); setView('wizard'); }}><Plus size={16} /> Nouvel inventaire</button>
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un inventaire…" className="input pl-9" />
          </div>
          <select className="input max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            {Object.entries(INVENTORY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {loading ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div> : filteredInvs.length === 0 ? (
          <EmptyState icon={<ClipboardList size={24} />} title="Aucun inventaire" description="Créez votre premier inventaire pour contrôler les quantités réellement disponibles en stock." action={<button className="btn-primary" onClick={() => { setWizStep(1); setView('wizard'); }}><Plus size={16} /> Nouvel inventaire</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                <th className="px-4 py-3 font-medium">Référence</th><th className="px-4 py-3 font-medium">Nom</th><th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Dépôt</th><th className="px-4 py-3 font-medium">Responsable</th>
                <th className="px-4 py-3 text-center font-medium">Produits</th><th className="px-4 py-3 text-center font-medium">Écart</th><th className="px-4 py-3 font-medium">Statut</th><th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filteredInvs.map((inv) => (
                  <tr key={inv.id} className="table-row-hover cursor-pointer border-b border-ink-50 dark:border-ink-800/50" onClick={() => openInventory(inv, 'detail')}>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{inv.number}</td>
                    <td className="px-4 py-3 font-medium">{inv.name}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(inv.date)}</td>
                    <td className="px-4 py-3">{INVENTORY_TYPE_LABELS[inv.type]}</td>
                    <td className="px-4 py-3">{inv.warehouse}</td>
                    <td className="px-4 py-3 text-ink-500">{inv.responsible || '—'}</td>
                    <td className="px-4 py-3 text-center">{inv.total_items}</td>
                    <td className="px-4 py-3 text-center text-ink-500">—</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONES[inv.status]}>{INVENTORY_STATUS_LABELS[inv.status]}</Badge></td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openInventory(inv, 'detail')} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800" title="Voir"><Eye size={15} /></button>
                        {(inv.status === 'counting' || inv.status === 'preparing') && <button onClick={() => openInventory(inv, 'counting')} className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/40" title="Continuer"><ArrowRight size={15} /></button>}
                        {inv.status === 'gap_check' && <button onClick={() => openInventory(inv, 'gaps')} className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40" title="Écarts"><AlertTriangle size={15} /></button>}
                        {!['validated', 'cancelled'].includes(inv.status) && <button onClick={() => { setCurrent(inv); setShowCancel(true); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Annuler"><X size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog open={showCancel} onClose={() => setShowCancel(false)} onConfirm={cancelInventory} title="Annuler l'inventaire" message="L'inventaire sera marqué comme annulé. Cette action est irréversible." confirmLabel="Annuler l'inventaire" danger />
    </div>
  );

  if (view === 'wizard') return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setView('list')} className="mb-1 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600"><ArrowLeft size={14} /> Retour</button>
        <h1 className="font-display text-2xl font-bold tracking-tight">Nouvel inventaire</h1>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {['Configuration', 'Sélection des produits'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${wizStep === i + 1 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400 dark:bg-ink-800'}`}>{i + 1}</div>
            <span className={`text-sm font-medium ${wizStep === i + 1 ? 'text-ink-800 dark:text-ink-100' : 'text-ink-400'}`}>{label}</span>
            {i === 0 && <ChevronRight size={16} className="text-ink-300" />}
          </div>
        ))}
      </div>

      {wizStep === 1 ? (
        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className="label">Référence</label><input className="input bg-ink-50 dark:bg-ink-800/50" value={wizPreviewNumber} readOnly /></div>
            <div><label className="label">Nom de l'inventaire</label><input className="input" value={wiz.name} onChange={(e) => setWiz({ ...wiz, name: e.target.value })} placeholder="Ex : Inventaire général août" /></div>
            <div><label className="label">Date</label><input type="date" className="input" value={wiz.date} onChange={(e) => setWiz({ ...wiz, date: e.target.value })} /></div>
            <div><label className="label">Type d'inventaire</label><select className="input" value={wiz.type} onChange={(e) => setWiz({ ...wiz, type: e.target.value as InventoryType })}>{Object.entries(INVENTORY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Dépôt</label><input className="input" value={wiz.warehouse} onChange={(e) => setWiz({ ...wiz, warehouse: e.target.value })} /></div>
            <div><label className="label">Emplacement</label><input className="input" value={wiz.location} onChange={(e) => setWiz({ ...wiz, location: e.target.value })} placeholder="Ex : Rayon A" /></div>
            <div><label className="label">Responsable</label><input className="input" value={wiz.responsible} onChange={(e) => setWiz({ ...wiz, responsible: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Commentaire</label><textarea className="input min-h-[60px]" value={wiz.comment} onChange={(e) => setWiz({ ...wiz, comment: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end"><button className="btn-primary" onClick={() => setWizStep(2)}>Continuer <ArrowRight size={16} /></button></div>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={wizSearch} onChange={(e) => setWizSearch(e.target.value)} placeholder="Rechercher par nom, SKU, code-barres…" className="input pl-9" />
            </div>
            {wiz.type !== 'general' && <span className="text-sm text-ink-500">{selectedProductIds.size} produit(s) sélectionné(s)</span>}
          </div>
          {wiz.type === 'general' ? (
            <div className="p-6 text-center">
              <Package size={32} className="mx-auto mb-2 text-brand-500" />
              <p className="text-sm text-ink-500">Tous les {products.length} produits actifs seront inclus automatiquement dans cet inventaire général.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3"><input type="checkbox" checked={selectedProductIds.size === wizFilteredProducts.length && wizFilteredProducts.length > 0} onChange={(e) => setSelectedProductIds(e.target.checked ? new Set(wizFilteredProducts.map((p) => p.id)) : new Set())} /></th>
                  <th className="px-4 py-3 font-medium">Produit</th><th className="px-4 py-3 font-medium">SKU</th><th className="px-4 py-3 font-medium">Code-barres</th><th className="px-4 py-3 text-right font-medium">Stock</th><th className="px-4 py-3 font-medium">Emplacement</th>
                </tr></thead>
                <tbody>
                  {wizFilteredProducts.map((p) => (
                    <tr key={p.id} className="table-row-hover cursor-pointer border-b border-ink-50 dark:border-ink-800/50" onClick={() => toggleProduct(p.id)}>
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedProductIds.has(p.id)} onChange={() => toggleProduct(p.id)} /></td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-500">{p.barcode || '—'}</td>
                      <td className="px-4 py-3 text-right">{p.stock_qty}</td>
                      <td className="px-4 py-3 text-ink-500">{p.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-ink-100 p-4 dark:border-ink-800">
            <button className="btn-secondary" onClick={() => setWizStep(1)}><ArrowLeft size={16} /> Retour</button>
            <button className="btn-primary" onClick={startCounting} disabled={creating}>{creating ? <Spinner className="h-4 w-4" /> : <Check size={16} />} Lancer le comptage</button>
          </div>
        </Card>
      )}
    </div>
  );

  if (view === 'counting' && current) {
    const counted = lines.filter((l) => l.physical_qty !== null).length;
    const pct = lines.length > 0 ? Math.round((counted / lines.length) * 100) : 0;
    return (
      <div className="space-y-5">
        <div>
          <button onClick={() => setView('list')} className="mb-1 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600"><ArrowLeft size={14} /> Retour</button>
          <h1 className="font-display text-2xl font-bold tracking-tight">Comptage de l'inventaire</h1>
          <p className="mt-1 text-sm text-ink-500">{current.number} — {current.warehouse} — {formatDate(current.date)}</p>
        </div>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Progression : {counted} / {lines.length} produits</div>
              <div className="mt-2 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setQuickMode(!quickMode)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${quickMode ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300' : 'border-ink-200 text-ink-500 dark:border-ink-700'}`}>
                <ScanLine size={14} /> Comptage rapide {quickMode ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </Card>

        <Card padding={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input value={countSearch} onChange={(e) => setCountSearch(e.target.value)} placeholder="Rechercher un produit…" className="input pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <ScanLine size={16} className="text-brand-500" />
              <input value={scanInput} onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleScan()} placeholder="Scanner code-barres…" className="input w-48" />
              <button className="btn-secondary text-sm" onClick={handleScan}>OK</button>
            </div>
          </div>
          {loading ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3 font-medium">Produit</th><th className="px-4 py-3 font-medium">SKU</th><th className="px-4 py-3 font-medium">Code-barres</th>
                  <th className="px-4 py-3 text-right font-medium">Théorique</th><th className="px-4 py-3 text-right font-medium">Physique</th><th className="px-4 py-3 text-right font-medium">Écart</th><th className="px-4 py-3 text-center font-medium">Statut</th><th className="px-4 py-3 text-right font-medium">Action</th>
                </tr></thead>
                <tbody>
                  {countFiltered.map((l) => {
                    const gap = l.physical_qty !== null ? l.physical_qty - l.theoretical_qty : null;
                    return (
                      <tr key={l.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50">
                        <td className="px-4 py-3 font-medium">{l.product?.name || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{l.product?.sku || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-500">{l.product?.barcode || '—'}</td>
                        <td className="px-4 py-3 text-right text-ink-500">{l.theoretical_qty}</td>
                        <td className="px-4 py-3 text-right">
                          <input id={`phy-${l.id}`} type="number" className="input w-20 text-right" value={l.physical_qty ?? ''} onChange={(e) => savePhysicalQty(l.id, e.target.value === '' ? 0 : parseFloat(e.target.value))} placeholder="—" />
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${gap === null ? 'text-ink-300' : gap === 0 ? 'text-emerald-600' : gap < 0 ? 'text-red-600' : 'text-blue-600'}`}>{gap === null ? '—' : (gap > 0 ? '+' : '') + gap}</td>
                        <td className="px-4 py-3 text-center">
                          {l.count_status === 'conform' ? <Badge tone="success">Conforme</Badge> : l.count_status === 'gap' ? <Badge tone="error">Écart</Badge> : <Badge tone="neutral">En attente</Badge>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {l.gap !== 0 && l.physical_qty !== null && <button onClick={() => { setRecountLine(l); setRecountValues({ count2: l.count2?.toString() || '', count3: l.count3?.toString() || '' }); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/40" title="Recompter"><RotateCcw size={15} /></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-ink-100 p-4 dark:border-ink-800">
            <button className="btn-secondary" onClick={() => setView('list')}>Retour</button>
            <button className="btn-primary" onClick={finishCounting}>Terminer le comptage <Check size={16} /></button>
          </div>
        </Card>

        {recountLine && (
          <Modal open onClose={() => setRecountLine(null)} title={`Recompter — ${recountLine.product?.name}`} size="sm"
            footer={<><button className="btn-secondary" onClick={() => setRecountLine(null)}>Annuler</button><button className="btn-primary" onClick={saveRecount}><Check size={15} /> Enregistrer</button></>}>
            <div className="space-y-3">
              <div className="rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
                <div className="flex justify-between text-sm"><span className="text-ink-500">Stock théorique</span><span className="font-medium">{recountLine.theoretical_qty}</span></div>
                <div className="mt-1 flex justify-between text-sm"><span className="text-ink-500">Premier comptage</span><span className="font-medium">{recountLine.count1}</span></div>
              </div>
              <div><label className="label">Deuxième comptage</label><input type="number" className="input" value={recountValues.count2} onChange={(e) => setRecountValues({ ...recountValues, count2: e.target.value })} autoFocus /></div>
              <div><label className="label">Troisième comptage (optionnel)</label><input type="number" className="input" value={recountValues.count3} onChange={(e) => setRecountValues({ ...recountValues, count3: e.target.value })} /></div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  if (view === 'gaps' && current) return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setView('list')} className="mb-1 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600"><ArrowLeft size={14} /> Retour</button>
        <h1 className="font-display text-2xl font-bold tracking-tight">Vérification des écarts</h1>
        <p className="mt-1 text-sm text-ink-500">{current.number} — {current.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard icon={<Package size={18} />} label="Comptés" value={gapKpis.counted.toString()} color="brand" />
        <KpiCard icon={<Check size={18} />} label="Conformes" value={gapKpis.conform.toString()} color="emerald" />
        <KpiCard icon={<TrendingUp size={18} />} label="Écarts +" value={gapKpis.posGaps.toString()} color="blue" />
        <KpiCard icon={<TrendingDown size={18} />} label="Écarts -" value={gapKpis.negGaps.toString()} color="amber" />
        <KpiCard icon={<AlertTriangle size={18} />} label="Valeur écarts" value={formatMoney(gapKpis.totalValue, sym)} color="red" />
      </div>

      <Card padding={false}>
        {gapLinesWithGaps.length === 0 ? (
          <EmptyState icon={<Check size={24} />} title="Aucun écart" description="Tous les produits comptés sont conformes au stock théorique." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                <th className="px-4 py-3 font-medium">Produit</th><th className="px-4 py-3 text-right font-medium">Théorique</th><th className="px-4 py-3 text-right font-medium">Physique</th>
                <th className="px-4 py-3 text-right font-medium">Écart</th><th className="px-4 py-3 text-right font-medium">Valeur</th><th className="px-4 py-3 font-medium">Motif</th><th className="px-4 py-3 text-center font-medium">Statut</th>
              </tr></thead>
              <tbody>
                {gapLinesWithGaps.map((l) => (
                  <tr key={l.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50">
                    <td className="px-4 py-3 font-medium">{l.product?.name || '—'}</td>
                    <td className="px-4 py-3 text-right text-ink-500">{l.theoretical_qty}</td>
                    <td className="px-4 py-3 text-right">{l.physical_qty}</td>
                    <td className={`px-4 py-3 text-right font-medium ${l.gap < 0 ? 'text-red-600' : 'text-blue-600'}`}>{l.gap > 0 ? '+' : ''}{l.gap}</td>
                    <td className={`px-4 py-3 text-right font-medium ${l.gap * l.unit_cost < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatMoney(l.gap * l.unit_cost, sym)}</td>
                    <td className="px-4 py-3">
                      <select className="input text-xs" value={l.gap_reason || ''} onChange={(e) => setGapReason(l.id, e.target.value)}>
                        <option value="">— Sélectionner —</option>
                        {GAP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">{l.gap_status === 'verified' ? <Badge tone="success">Vérifié</Badge> : <Badge tone="warning">À vérifier</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-ink-100 p-4 dark:border-ink-800">
          <button className="btn-secondary" onClick={() => setView('counting')}>Retour au comptage</button>
          <button className="btn-primary" onClick={() => setShowValidate(true)}><Check size={16} /> Valider l'inventaire</button>
        </div>
      </Card>

      <ConfirmDialog open={showValidate} onClose={() => setShowValidate(false)} onConfirm={() => validateInventory(false)} title="Valider cet inventaire ?" message="La validation va appliquer les écarts constatés et modifier les quantités officielles en stock. Cette action sera enregistrée dans l'historique." confirmLabel="Valider l'inventaire" />
    </div>
  );

  if (view === 'detail' && current) return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setView('list')} className="mb-1 inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600"><ArrowLeft size={14} /> Retour</button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{current.name}</h1>
            <p className="mt-1 font-mono text-sm text-ink-500">{current.number}</p>
          </div>
          <Badge tone={STATUS_TONES[current.status]}>{INVENTORY_STATUS_LABELS[current.status]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><div className="text-xs text-ink-500">Date</div><div className="mt-1 font-medium">{formatDate(current.date)}</div></Card>
        <Card><div className="text-xs text-ink-500">Type</div><div className="mt-1 font-medium">{INVENTORY_TYPE_LABELS[current.type]}</div></Card>
        <Card><div className="text-xs text-ink-500">Dépôt</div><div className="mt-1 font-medium">{current.warehouse}</div></Card>
        <Card><div className="text-xs text-ink-500">Responsable</div><div className="mt-1 font-medium">{current.responsible || '—'}</div></Card>
      </div>

      {current.status === 'validated' && (
        <Card className="border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10">
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Check size={16} /> Inventaire validé le {formatDate(current.validated_at)} par {current.validated_by || '—'}</div>
        </Card>
      )}

      <Card padding={false}>
        <div className="border-b border-ink-100 p-4 dark:border-ink-800"><h3 className="font-medium">Lignes de l'inventaire ({lines.length})</h3></div>
        {lines.length === 0 ? <EmptyState icon={<Package size={24} />} title="Aucune ligne" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                <th className="px-4 py-3 font-medium">Produit</th><th className="px-4 py-3 text-right font-medium">Théorique</th><th className="px-4 py-3 text-right font-medium">Physique</th>
                <th className="px-4 py-3 text-right font-medium">Écart</th><th className="px-4 py-3 text-right font-medium">Valeur</th><th className="px-4 py-3 font-medium">Motif</th>
              </tr></thead>
              <tbody>
                {lines.map((l) => {
                  const gap = l.physical_qty !== null ? l.gap : null;
                  return (
                    <tr key={l.id} className="border-b border-ink-50 dark:border-ink-800/50">
                      <td className="px-4 py-3 font-medium">{l.product?.name || '—'}</td>
                      <td className="px-4 py-3 text-right text-ink-500">{l.theoretical_qty}</td>
                      <td className="px-4 py-3 text-right">{l.physical_qty ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${gap === null ? 'text-ink-300' : gap === 0 ? 'text-emerald-600' : gap < 0 ? 'text-red-600' : 'text-blue-600'}`}>{gap === null ? '—' : (gap > 0 ? '+' : '') + gap}</td>
                      <td className="px-4 py-3 text-right text-ink-500">{gap !== null ? formatMoney(gap * l.unit_cost, sym) : '—'}</td>
                      <td className="px-4 py-3 text-ink-500">{l.gap_reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(current.status === 'counting' || current.status === 'preparing') && (
          <div className="border-t border-ink-100 p-4 dark:border-ink-800"><button className="btn-primary" onClick={() => setView('counting')}><ArrowRight size={16} /> Continuer le comptage</button></div>
        )}
        {current.status === 'gap_check' && (
          <div className="border-t border-ink-100 p-4 dark:border-ink-800"><button className="btn-primary" onClick={() => setView('gaps')}><AlertTriangle size={16} /> Vérifier les écarts</button></div>
        )}
      </Card>
    </div>
  );

  return null;
}

// ── Dashboard sub-component ──────────────────────────────────────────────────
function DashboardView({ settings, sym, loading, totalProducts, stockValue, inProgress, lowStock, outOfStock, inventories, recentMovements, onNew, onOpen, onSeeAll }: {
  settings: any; sym: string; loading: boolean; totalProducts: number; stockValue: number; inProgress: number; lowStock: number; outOfStock: number;
  inventories: InventoryT[]; recentMovements: any[]; onNew: () => void; onOpen: (inv: InventoryT) => void; onSeeAll: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Inventaire</h1>
          <p className="mt-1 text-sm text-ink-500">Contrôlez, comptez et ajustez votre stock.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onSeeAll}>Tous les inventaires</button>
          <button className="btn-primary" onClick={onNew}><Plus size={16} /> Nouvel inventaire</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard icon={<Package size={18} />} label="Produits en stock" value={totalProducts.toString()} color="brand" />
        <KpiCard icon={<FileText size={18} />} label="Valeur du stock" value={formatMoney(stockValue, sym)} color="emerald" />
        <KpiCard icon={<ClipboardList size={18} />} label="Inventaires en cours" value={inProgress.toString()} color="blue" />
        <KpiCard icon={<AlertTriangle size={18} />} label="Écarts détectés" value="—" color="amber" />
        <KpiCard icon={<TrendingDown size={18} />} label="Stock faible" value={lowStock.toString()} color="amber" />
        <KpiCard icon={<TrendingDown size={18} />} label="Ruptures" value={outOfStock.toString()} color="red" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding={false}>
          <div className="flex items-center justify-between border-b border-ink-100 p-4 dark:border-ink-800">
            <h3 className="font-medium">Derniers inventaires</h3>
            <button onClick={onSeeAll} className="text-xs font-medium text-brand-600 hover:underline">Voir tout</button>
          </div>
          {loading ? <div className="flex justify-center py-8"><Spinner className="h-5 w-5 text-brand-600" /></div> : inventories.length === 0 ? (
            <div className="p-6 text-center text-sm text-ink-400">Aucun inventaire créé</div>
          ) : (
            <div className="divide-y divide-ink-50 dark:divide-ink-800/50">
              {inventories.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex cursor-pointer items-center justify-between p-4 hover:bg-ink-50 dark:hover:bg-ink-800/30" onClick={() => onOpen(inv)}>
                  <div className="min-w-0"><div className="font-mono text-xs text-ink-500">{inv.number}</div><div className="truncate font-medium">{inv.name}</div><div className="text-xs text-ink-400">{formatDate(inv.date)} · {inv.total_items} produits</div></div>
                  <Badge tone={STATUS_TONES[inv.status]}>{INVENTORY_STATUS_LABELS[inv.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding={false}>
          <div className="border-b border-ink-100 p-4 dark:border-ink-800"><h3 className="font-medium">Derniers mouvements de stock</h3></div>
          {recentMovements.length === 0 ? <div className="p-6 text-center text-sm text-ink-400">Aucun mouvement</div> : (
            <div className="divide-y divide-ink-50 dark:divide-ink-800/50">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0"><div className="truncate font-medium">{m.product?.name || '—'}</div><div className="text-xs text-ink-400">{formatDate(m.created_at)} · {m.type}</div></div>
                  <span className={`font-medium ${m.qty > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: 'brand' | 'emerald' | 'blue' | 'amber' | 'red' }) {
  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  };
  return (
    <Card className="flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>{icon}</div>
      <div className="min-w-0"><div className="truncate text-xs text-ink-500">{label}</div><div className="font-display text-lg font-bold">{value}</div></div>
    </Card>
  );
}
