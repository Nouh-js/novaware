import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate, formatMoney } from '../lib/format';
import { Card, Badge, Spinner, EmptyState, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import { Archive, RotateCcw, Trash2, Search, Package, Users, Truck, ShoppingCart, FileText } from 'lucide-react';

type ArchivedRecord = {
  id: string;
  label: string;
  sub: string;
  archived_at: string;
  table: string;
  raw: any;
};

const TYPE_LABELS: Record<string, string> = {
  quote: 'Devis', order: 'Bon de commande', delivery: 'Bon de livraison',
  invoice: 'Facture', proforma: 'Proforma', credit_note: 'Avoir',
};

type FilterType = 'all' | 'products' | 'customers' | 'suppliers' | 'sales_documents' | 'purchase_documents';

const FILTERS: { id: FilterType; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'all', label: 'Tous', icon: Archive },
  { id: 'products', label: 'Produits', icon: Package },
  { id: 'customers', label: 'Clients', icon: Users },
  { id: 'suppliers', label: 'Fournisseurs', icon: Truck },
  { id: 'sales_documents', label: 'Ventes', icon: ShoppingCart },
  { id: 'purchase_documents', label: 'Achats', icon: FileText },
];

export function Archives({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ArchivedRecord[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [restoreId, setRestoreId] = useState<{ id: string; table: string } | null>(null);
  const [deleteId, setDeleteId] = useState<{ id: string; table: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [prods, customers, suppliers, sales, purchases] = await Promise.all([
      supabase.from('products').select('*').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
      supabase.from('customers').select('*').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
      supabase.from('suppliers').select('*').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
      supabase.from('sales_documents').select('*, customer:customers(name)').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
      supabase.from('purchase_documents').select('*, supplier:suppliers(name)').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
    ]);

    const all: ArchivedRecord[] = [
      ...((prods.data || []).map((r: any) => ({
        id: r.id, table: 'products', archived_at: r.archived_at, raw: r,
        label: r.name, sub: `SKU: ${r.sku} · ${formatMoney(r.sale_price, sym)}`,
      }))),
      ...((customers.data || []).map((r: any) => ({
        id: r.id, table: 'customers', archived_at: r.archived_at, raw: r,
        label: r.name, sub: `${r.email || ''} ${r.phone ? '· ' + r.phone : ''}`.trim(),
      }))),
      ...((suppliers.data || []).map((r: any) => ({
        id: r.id, table: 'suppliers', archived_at: r.archived_at, raw: r,
        label: r.name, sub: `${r.email || ''} ${r.phone ? '· ' + r.phone : ''}`.trim(),
      }))),
      ...((sales.data || []).map((r: any) => ({
        id: r.id, table: 'sales_documents', archived_at: r.archived_at, raw: r,
        label: `${TYPE_LABELS[r.type] || r.type} ${r.number}`,
        sub: `${r.customer?.name || 'Comptant'} · ${formatMoney(r.total, sym)}`,
      }))),
      ...((purchases.data || []).map((r: any) => ({
        id: r.id, table: 'purchase_documents', archived_at: r.archived_at, raw: r,
        label: `Achat ${r.number}`,
        sub: `${r.supplier?.name || '—'} · ${formatMoney(r.total, sym)}`,
      }))),
    ].sort((a, b) => new Date(b.archived_at).getTime() - new Date(a.archived_at).getTime());

    setRecords(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      if (filter !== 'all' && r.table !== filter) return false;
      if (!q) return true;
      return r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q);
    });
  }, [records, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: records.length };
    records.forEach((r) => { c[r.table] = (c[r.table] || 0) + 1; });
    return c;
  }, [records]);

  const handleRestore = async () => {
    if (!restoreId) return;
    const { error } = await supabase.from(restoreId.table).update({ archived_at: null }).eq('id', restoreId.id);
    if (error) { toast('Erreur lors de la restauration', 'error'); return; }
    toast('Élément restauré avec succès');
    setRestoreId(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // For documents, delete lines first
    if (deleteId.table === 'sales_documents') {
      await supabase.from('sales_lines').delete().eq('document_id', deleteId.id);
    }
    if (deleteId.table === 'purchase_documents') {
      await supabase.from('purchase_lines').delete().eq('document_id', deleteId.id);
    }
    const { error } = await supabase.from(deleteId.table).delete().eq('id', deleteId.id);
    if (error) { toast('Erreur lors de la suppression', 'error'); return; }
    toast('Supprimé définitivement');
    setDeleteId(null);
    load();
  };

  const tableIcon = (table: string) => {
    switch (table) {
      case 'products': return <Package size={16} className="text-brand-500" />;
      case 'customers': return <Users size={16} className="text-emerald-500" />;
      case 'suppliers': return <Truck size={16} className="text-amber-500" />;
      case 'sales_documents': return <ShoppingCart size={16} className="text-blue-500" />;
      case 'purchase_documents': return <FileText size={16} className="text-purple-500" />;
      default: return <Archive size={16} className="text-ink-400" />;
    }
  };

  const tableLabel = (table: string) => {
    switch (table) {
      case 'products': return 'Produit';
      case 'customers': return 'Client';
      case 'suppliers': return 'Fournisseur';
      case 'sales_documents': return 'Document vente';
      case 'purchase_documents': return 'Document achat';
      default: return table;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Archives</h1>
          <p className="mt-1 text-sm text-ink-500">{records.length} élément(s) archivé(s) — restaurez ou supprimez définitivement</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === f.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'
            }`}
          >
            <f.icon size={13} />
            {f.label}
            <span className={`ml-0.5 rounded px-1 text-xs ${filter === f.id ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800'}`}>
              {counts[f.id] || 0}
            </span>
          </button>
        ))}
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans les archives…" className="input pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Archive size={32} />}
            title="Aucun élément archivé"
            description="Les éléments supprimés (archivés) apparaîtront ici pour restauration ou suppression définitive."
          />
        ) : (
          <div className="divide-y divide-ink-50 dark:divide-ink-800/50">
            {filtered.map((r) => (
              <div key={`${r.table}-${r.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 dark:bg-ink-800">
                  {tableIcon(r.table)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink-800 dark:text-ink-100 truncate">{r.label}</span>
                    <Badge tone="neutral" className="shrink-0">{tableLabel(r.table)}</Badge>
                  </div>
                  <div className="text-xs text-ink-500 truncate">{r.sub}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-ink-400">Archivé le</div>
                  <div className="text-xs font-medium text-ink-600 dark:text-ink-300">{formatDate(r.archived_at)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setRestoreId({ id: r.id, table: r.table })}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/40 dark:text-emerald-400 dark:hover:bg-emerald-950/20 transition"
                    title="Restaurer"
                  >
                    <RotateCcw size={13} /> Restaurer
                  </button>
                  <button
                    onClick={() => setDeleteId({ id: r.id, table: r.table })}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition"
                    title="Supprimer définitivement"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!restoreId}
        onClose={() => setRestoreId(null)}
        onConfirm={handleRestore}
        title="Restaurer l'élément"
        message="L'élément sera remis dans sa liste d'origine et redeviendra visible."
        confirmLabel="Restaurer"
      />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Suppression définitive"
        message="Cette action est irréversible. L'élément sera définitivement supprimé de la base de données."
        confirmLabel="Supprimer définitivement"
        danger
      />
    </div>
  );
}
