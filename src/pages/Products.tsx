import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatNumber, formatDate } from '../lib/format';
import { Card, Badge, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import {
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  PackageX,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sliders,
  Barcode,
  History,
  Boxes,
} from 'lucide-react';
import type { Product, Category, Brand, StockMovement, DiscountType, SchoolLevel } from '../lib/types';
import { PRODUCT_CATEGORIES, DEFAULT_CATEGORY, SCHOOL_LEVELS, finalPrice } from '../lib/types';

type Tab = 'list' | 'alerts' | 'movements';

export function Products({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [tab, setTab] = useState<Tab>('list');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    const [p, c, b, m] = await Promise.all([
      supabase.from('products').select('*, category:categories(*), brand:brands(*)').is('archived_at', null).order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('brands').select('*').order('name'),
      supabase.from('stock_movements').select('*, product:products(*)').order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts((p.data as Product[]) || []);
    setCategories((c.data as Category[])
      .filter((cat) => (PRODUCT_CATEGORIES as readonly string[]).includes(cat.name))
      .sort((a, b) => (PRODUCT_CATEGORIES as readonly string[]).indexOf(a.name) - (PRODUCT_CATEGORIES as readonly string[]).indexOf(b.name)) || []);
    setBrands((b.data as Brand[]) || []);
    setMovements((m.data as StockMovement[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').includes(q)) &&
      (filterStatus === 'all' || (filterStatus === 'active' && p.active) || (filterStatus === 'inactive' && !p.active)) &&
      (filterCategory === 'all' || p.category_id === filterCategory) &&
      (filterLevel === 'all' || (p.school_level || 'Tous') === filterLevel),
    );
  }, [products, search, filterStatus, filterCategory, filterLevel]);

  const lowStock = products.filter((p) => p.stock_qty > 0 && p.stock_qty <= p.min_stock);
  const outStock = products.filter((p) => p.stock_qty <= 0);

  const handleSave = async (data: Partial<Product>, id?: string) => {
    const { category, brand, created_at, updated_at, ...payload } = data;
    void category; void brand; void created_at; void updated_at;
    if (id) {
      const { error } = await supabase.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) { toast('Erreur lors de la modification', 'error'); return; }
      toast('Produit modifié');
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) { toast('Erreur lors de la création', 'error'); return; }
      toast('Produit créé');
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('products').update({ archived_at: new Date().toISOString() }).eq('id', deleteId);
    if (error) { toast('Erreur de suppression', 'error'); return; }
    toast('Produit archivé');
    setDeleteId(null);
    load();
  };

  const handleAdjust = async (product: Product, type: 'in' | 'out' | 'adjust', qty: number, reason: string) => {
    const delta = type === 'out' ? -Math.abs(qty) : type === 'in' ? Math.abs(qty) : qty;
    const newQty = Math.max(0, product.stock_qty + delta);
    const { error: e1 } = await supabase.from('products').update({ stock_qty: newQty, updated_at: new Date().toISOString() }).eq('id', product.id);
    if (e1) { toast('Erreur de mise à jour', 'error'); return; }
    await supabase.from('stock_movements').insert({
      product_id: product.id,
      type,
      qty: delta,
      unit_cost: product.cost_price,
      reason,
      reference: 'MANUAL',
    });
    toast('Stock ajusté');
    setAdjusting(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Produits & Stock</h1>
          <p className="mt-1 text-sm text-ink-500">{products.length} produits · {formatMoney(products.reduce((s, p) => s + p.stock_qty * p.cost_price, 0), sym)} de valeur de stock</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={16} /> Nouveau produit
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total produits" value={formatNumber(products.length)} icon={<Package size={18} />} tone="brand" />
        <StatTile label="Valeur du stock" value={formatMoney(products.reduce((s, p) => s + p.stock_qty * p.cost_price, 0), sym)} icon={<Boxes size={18} />} tone="emerald" />
        <StatTile label="Stock faible" value={formatNumber(lowStock.length)} icon={<AlertTriangle size={18} />} tone="amber" />
        <StatTile label="Ruptures" value={formatNumber(outStock.length)} icon={<PackageX size={18} />} tone="red" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900">
        {([
          { id: 'list', label: 'Catalogue', icon: Package },
          { id: 'alerts', label: 'Alertes', icon: AlertTriangle },
          { id: 'movements', label: 'Mouvements', icon: History },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-white text-ink-900 shadow-soft dark:bg-ink-800 dark:text-ink-100' : 'text-ink-500 hover:text-ink-700'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <Card padding={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, SKU, code-barres…"
                className="input pl-9"
              />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')} className="input max-w-[140px]">
              <option value="all">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input max-w-[160px]">
              <option value="all">Toutes catégories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="input max-w-[160px]">
              <option value="all">Tous niveaux</option>
              {SCHOOL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <Badge tone="neutral">{filtered.length} résultat(s)</Badge>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Package size={24} />} title="Aucun produit" description="Ajoutez votre premier produit pour commencer." action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Ajouter</button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium">Catégorie</th>
                    <th className="px-4 py-3 font-medium">Niveau</th>
                    <th className="px-4 py-3 text-right font-medium">Prix vente</th>
                    <th className="px-4 py-3 text-right font-medium">Stock</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const status = p.stock_qty <= 0 ? 'out' : p.stock_qty <= p.min_stock ? 'low' : 'ok';
                    return (
                      <tr key={p.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-800">
                              <Package size={16} />
                            </div>
                            <div>
                              <div className="font-medium text-ink-800 dark:text-ink-100">{p.name}</div>
                              <div className="text-xs text-ink-400">{p.brand?.name || '—'} · {p.unit}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-500">{p.sku}</td>
                        <td className="px-4 py-3">
                          {p.category ? <Badge tone="brand">{p.category.name}</Badge> : <Badge tone="neutral">{DEFAULT_CATEGORY}</Badge>}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-500">{p.school_level || 'Tous'}</td>
                        <td className="px-4 py-3 text-right">
                          {p.discount_type !== 'none' && p.discount_value > 0 ? (
                            <div>
                              <div className="text-xs text-ink-400 line-through">{formatMoney(p.sale_price, sym)}</div>
                              <div className="font-medium text-emerald-600">{formatMoney(finalPrice(p), sym)}</div>
                              <div className="text-[10px] text-ink-400">
                                {p.discount_type === 'percent' ? `-${p.discount_value}%` : `-${formatMoney(p.discount_value, sym)}`}
                              </div>
                            </div>
                          ) : (
                            <div className="font-medium">{formatMoney(p.sale_price, sym)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-medium">{formatNumber(p.stock_qty)}</span>
                          <span className="text-xs text-ink-400"> / {formatNumber(p.min_stock)} min</span>
                        </td>
                        <td className="px-4 py-3">
                          {status === 'out' ? <Badge tone="danger">Rupture</Badge> : status === 'low' ? <Badge tone="warning">Faible</Badge> : <Badge tone="success">OK</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setAdjusting(p)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800" title="Ajuster le stock"><Sliders size={15} /></button>
                            <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800" title="Modifier"><Pencil size={15} /></button>
                            <button onClick={() => setDeleteId(p.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Supprimer"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'alerts' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="font-display font-semibold">Stock faible ({lowStock.length})</h3>
            </div>
            {lowStock.length === 0 ? <p className="py-6 text-center text-sm text-ink-400">Aucune alerte</p> : (
              <div className="space-y-2">
                {lowStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-ink-500">{p.sku} · {p.location}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-600">{formatNumber(p.stock_qty)}</div>
                      <div className="text-xs text-ink-400">min {formatNumber(p.min_stock)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <PackageX size={18} className="text-red-500" />
              <h3 className="font-display font-semibold">Ruptures de stock ({outStock.length})</h3>
            </div>
            {outStock.length === 0 ? <p className="py-6 text-center text-sm text-ink-400">Aucune rupture</p> : (
              <div className="space-y-2">
                {outStock.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-ink-500">{p.sku}</div>
                    </div>
                    <Badge tone="danger">Indisponible</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'movements' && (
        <Card padding={false}>
          <div className="border-b border-ink-100 p-4 dark:border-ink-800">
            <h3 className="font-display font-semibold">Historique des mouvements</h3>
          </div>
          {movements.length === 0 ? <EmptyState icon={<History size={24} />} title="Aucun mouvement" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                    <th className="px-4 py-3 font-medium">Produit</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Quantité</th>
                    <th className="px-4 py-3 font-medium">Raison</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50">
                      <td className="px-4 py-3 font-medium">{m.product?.name || '—'}</td>
                      <td className="px-4 py-3">
                        {m.type === 'in' ? <Badge tone="success"><ArrowDownToLine size={12} /> Entrée</Badge> :
                         m.type === 'out' ? <Badge tone="danger"><ArrowUpFromLine size={12} /> Sortie</Badge> :
                         <Badge tone="brand"><Sliders size={12} /> Ajustement</Badge>}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${m.qty >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.qty > 0 ? '+' : ''}{formatNumber(m.qty)}
                      </td>
                      <td className="px-4 py-3 text-ink-500">{m.reason || '—'}</td>
                      <td className="px-4 py-3 text-ink-500">{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          categories={categories}
          brands={brands}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}

      {adjusting && (
        <AdjustStockModal product={adjusting} onClose={() => setAdjusting(null)} onAdjust={handleAdjust} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Archiver le produit"
        message="Le produit sera déplacé dans les archives. Vous pourrez le restaurer depuis la page Archives."
        confirmLabel="Archiver"
        danger
      />
    </div>
  );
}

function StatTile({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: 'brand' | 'emerald' | 'amber' | 'red' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400',
  };
  return (
    <Card className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <div>
        <div className="font-display text-lg font-bold">{value}</div>
        <div className="text-xs text-ink-500">{label}</div>
      </div>
    </Card>
  );
}

function ProductForm({
  product,
  categories,
  brands,
  onClose,
  onSave,
}: {
  product: Product | null;
  categories: Category[];
  brands: Brand[];
  onClose: () => void;
  onSave: (data: Partial<Product>, id?: string) => void;
}) {
  const [form, setForm] = useState<Partial<Product>>(
    product || {
      name: '',
      sku: '',
      barcode: '',
      category_id: categories.find((c) => c.name === DEFAULT_CATEGORY)?.id || null,
      cost_price: 0,
      sale_price: 0,
      tax_rate: 20,
      unit: 'pièce',
      stock_qty: 0,
      min_stock: 5,
      max_stock: 100,
      valuation_method: 'CMUP',
      active: true,
      school_level: 'Tous',
      discount_type: 'none',
      discount_value: 0,
    },
  );

  const set = (k: keyof Product, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name || !form.sku) { toast('Nom et SKU requis', 'error'); return; }
    const payload: Partial<Product> = {
      ...form,
      category_id: form.category_id || categories.find((c) => c.name === DEFAULT_CATEGORY)?.id || null,
    };
    onSave(payload, product?.id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Modifier le produit' : 'Nouveau produit'}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={submit}>{product ? 'Enregistrer' : 'Créer'}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nom du produit *</label>
          <input className="input" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">SKU / Référence *</label>
          <input className="input font-mono" value={form.sku || ''} onChange={(e) => set('sku', e.target.value)} />
        </div>
        <div>
          <label className="label">Code-barres</label>
          <div className="relative">
            <Barcode size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9 font-mono" value={form.barcode || ''} onChange={(e) => set('barcode', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Catégorie</label>
          <select className="input" value={form.category_id || categories.find((c) => c.name === DEFAULT_CATEGORY)?.id || ''} onChange={(e) => set('category_id', e.target.value || null)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Marque</label>
          <select className="input" value={form.brand_id || ''} onChange={(e) => set('brand_id', e.target.value || null)}>
            <option value="">—</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Niveau scolaire</label>
          <select className="input" value={form.school_level || 'Tous'} onChange={(e) => set('school_level', e.target.value as SchoolLevel)}>
            {SCHOOL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select className="input" value={form.active === false ? 'inactive' : 'active'} onChange={(e) => set('active', e.target.value === 'active')}>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>
        </div>
        <div>
          <label className="label">Prix de revient (HT)</label>
          <input type="number" step="0.01" className="input" value={form.cost_price ?? 0} onChange={(e) => set('cost_price', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Prix de vente (HT)</label>
          <input type="number" step="0.01" className="input" value={form.sale_price ?? 0} onChange={(e) => set('sale_price', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">TVA (%)</label>
          <input type="number" step="0.01" className="input" value={form.tax_rate ?? 20} onChange={(e) => set('tax_rate', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Unité</label>
          <input className="input" value={form.unit || ''} onChange={(e) => set('unit', e.target.value)} />
        </div>
        <div>
          <label className="label">Stock actuel</label>
          <input type="number" step="0.01" className="input" value={form.stock_qty ?? 0} onChange={(e) => set('stock_qty', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Stock minimum</label>
          <input type="number" step="0.01" className="input" value={form.min_stock ?? 5} onChange={(e) => set('min_stock', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Stock maximum</label>
          <input type="number" step="0.01" className="input" value={form.max_stock ?? 100} onChange={(e) => set('max_stock', parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Méthode de valorisation</label>
          <select className="input" value={form.valuation_method || 'CMUP'} onChange={(e) => set('valuation_method', e.target.value)}>
            <option value="CMUP">CMUP (Coût Moyen Pondéré)</option>
            <option value="FIFO">FIFO (Premier entré, premier sorti)</option>
            <option value="LIFO">LIFO (Dernier entré, premier sorti)</option>
          </select>
        </div>
        <div>
          <label className="label">Emplacement</label>
          <input className="input" value={form.location || ''} onChange={(e) => set('location', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[70px]" value={form.description || ''} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="col-span-2 rounded-lg border border-ink-100 p-4 dark:border-ink-800">
          <div className="mb-3 flex items-center gap-2">
            <Badge tone="brand">Remise</Badge>
            <span className="text-xs text-ink-500">Appliquez une remise sur le prix de vente</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type de remise</label>
              <select className="input" value={form.discount_type || 'none'} onChange={(e) => set('discount_type', e.target.value as DiscountType)}>
                <option value="none">Aucune</option>
                <option value="percent">Pourcentage (%)</option>
                <option value="fixed">Montant fixe (DH)</option>
              </select>
            </div>
            <div>
              <label className="label">Valeur de la remise</label>
              <input type="number" step="0.01" className="input" value={form.discount_value ?? 0} disabled={form.discount_type === 'none'} onChange={(e) => set('discount_value', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          {form.discount_type !== 'none' && form.discount_value > 0 && (
            <div className="mt-3 flex items-center gap-4 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
              <div>
                <div className="text-xs text-ink-500">Prix original</div>
                <div className="font-medium line-through text-ink-400">{formatMoney(form.sale_price ?? 0, sym)}</div>
              </div>
              <div>
                <div className="text-xs text-ink-500">Remise</div>
                <div className="font-medium text-red-600">
                  {form.discount_type === 'percent' ? `-${form.discount_value}%` : `-${formatMoney(form.discount_value, sym)}`}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-500">Prix final</div>
                <div className="font-display text-lg font-bold text-emerald-600">{formatMoney(finalPrice({ sale_price: form.sale_price ?? 0, discount_type: form.discount_type || 'none', discount_value: form.discount_value ?? 0 }), sym)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function AdjustStockModal({
  product,
  onClose,
  onAdjust,
}: {
  product: Product;
  onClose: () => void;
  onAdjust: (p: Product, type: 'in' | 'out' | 'adjust', qty: number, reason: string) => void;
}) {
  const [type, setType] = useState<'in' | 'out' | 'adjust'>('in');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ajuster le stock — ${product.name}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={() => onAdjust(product, type, qty, reason)} disabled={qty <= 0}>Valider</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
          <div className="text-sm text-ink-500">Stock actuel</div>
          <div className="font-display text-xl font-bold">{formatNumber(product.stock_qty)} <span className="text-sm font-normal text-ink-400">{product.unit}</span></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'in', label: 'Entrée', icon: ArrowDownToLine },
            { id: 'out', label: 'Sortie', icon: ArrowUpFromLine },
            { id: 'adjust', label: 'Ajuster', icon: Sliders },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition ${
                type === t.id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800'
              }`}
            >
              <t.icon size={18} /> {t.label}
            </button>
          ))}
        </div>
        <div>
          <label className="label">Quantité</label>
          <input type="number" step="0.01" className="input" value={qty} onChange={(e) => setQty(parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Raison</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Réception fournisseur, casse, inventaire…" />
        </div>
      </div>
    </Modal>
  );
}
