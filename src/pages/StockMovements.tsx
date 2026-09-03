import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/format';
import { Card, Spinner, EmptyState } from '../components/ui';
import { ArrowLeftRight, Search, ArrowDown, ArrowUp, RotateCcw, ShoppingCart, Truck, Settings2 } from 'lucide-react';
import type { StockMovement, Product } from '../lib/types';

const TYPE_LABELS: Record<string, string> = {
  in: 'Entrée', out: 'Sortie', 'pos-sale': 'Vente POS', purchase: 'Achat',
  'customer-return': 'Retour client', 'supplier-return': 'Retour fournisseur',
  'inventory-adjustment': 'Ajustement inventaire', transfer: 'Transfert',
};

const TYPE_ICONS: Record<string, typeof ArrowDown> = {
  in: ArrowDown, out: ArrowUp, 'pos-sale': ShoppingCart, purchase: Truck,
  'customer-return': RotateCcw, 'supplier-return': RotateCcw,
  'inventory-adjustment': Settings2, transfer: ArrowLeftRight,
};

export function StockMovements({ settings: _settings }: { settings: any }) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Pick<Product, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('stock_movements').select('*, product:products(*)').order('created_at', { ascending: false }).limit(500);
      setMovements((data as StockMovement[]) || []);
      const { data: prods } = await supabase.from('products').select('id, name').order('name');
      setProducts((prods as Pick<Product, 'id' | 'name'>[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return movements.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (productFilter !== 'all' && m.product_id !== productFilter) return false;
      if (!q) return true;
      const pn = m.product?.name || '';
      return pn.toLowerCase().includes(q) || (m.reference || '').toLowerCase().includes(q) || (m.reason || '').toLowerCase().includes(q);
    });
  }, [movements, search, typeFilter, productFilter]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const types = ['all', 'in', 'out', 'pos-sale', 'purchase', 'customer-return', 'supplier-return', 'inventory-adjustment', 'transfer'];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Mouvements de stock</h1>
        <p className="mt-1 text-sm text-ink-500">Historique complet des entrées et sorties de stock</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400"><ArrowLeftRight size={20} /></div>
          <div><div className="text-xs text-ink-500">Total</div><div className="font-display text-xl font-bold">{movements.length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><ArrowDown size={20} /></div>
          <div><div className="text-xs text-ink-500">Entrées</div><div className="font-display text-xl font-bold">{movements.filter((m) => m.qty > 0).length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"><ArrowUp size={20} /></div>
          <div><div className="text-xs text-ink-500">Sorties</div><div className="font-display text-xl font-bold">{movements.filter((m) => m.qty < 0).length}</div></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"><Settings2 size={20} /></div>
          <div><div className="text-xs text-ink-500">Ajustements</div><div className="font-display text-xl font-bold">{movements.filter((m) => m.type === 'inventory-adjustment').length}</div></div>
        </Card>
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Rechercher par produit, réf…" className="input pl-9" />
          </div>
          <select className="input max-w-[180px]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}>
            {types.map((t) => <option key={t} value={t}>{t === 'all' ? 'Tous les types' : TYPE_LABELS[t] || t}</option>)}
          </select>
          <select className="input max-w-[200px]" value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(0); }}>
            <option value="all">Tous les produits</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div>
        ) : paginated.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight size={24} />} title="Aucun mouvement" description="Les mouvements de stock apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Produit</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Qté</th>
                  <th className="px-4 py-3 text-right font-medium">Avant</th>
                  <th className="px-4 py-3 text-right font-medium">Après</th>
                  <th className="px-4 py-3 font-medium">Origine</th>
                  <th className="px-4 py-3 font-medium">Utilisateur</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((m) => {
                  const Icon = TYPE_ICONS[m.type] || ArrowLeftRight;
                  const pos = m.qty > 0;
                  return (
                    <tr key={m.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-500">{formatDate(m.created_at)}</td>
                      <td className="px-4 py-3 font-medium">{m.product?.name || '—'}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><Icon size={14} className={pos ? 'text-emerald-500' : 'text-red-500'} />{TYPE_LABELS[m.type] || m.type}</span></td>
                      <td className={`px-4 py-3 text-right font-medium ${pos ? 'text-emerald-600' : 'text-red-600'}`}>{pos ? '+' : ''}{m.qty}</td>
                      <td className="px-4 py-3 text-right text-ink-500">{m.stock_before ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-ink-500">{m.stock_after ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-500">{m.reference || '—'}</td>
                      <td className="px-4 py-3 text-ink-500">{m.user_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-ink-800">
                <span className="text-xs text-ink-400">Page {page + 1} / {totalPages} — {filtered.length} mouvements</span>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</button>
                  <button className="btn-secondary text-sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Suivant</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
