import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatDate } from '../lib/format';
import { Card, Badge, Modal, Spinner, EmptyState, StatusBadge, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import { FileText, Plus, Search, Eye, Trash2, ShoppingCart, ArrowRight, CreditCard, X, Printer, Download } from 'lucide-react';
import type { PurchaseDocument, PurchaseLine, Supplier, Product } from '../lib/types';
import { generateDocumentHTML, openPrintWindow, downloadDocument } from '../lib/document';

const TYPE_LABELS: Record<string, string> = {
  quote_request: 'Demande de prix', order: 'Bon de commande', receipt: 'Réception', invoice: 'Facture fournisseur', credit_note: 'Avoir fournisseur',
};
const FLOW = ['quote_request', 'order', 'receipt', 'invoice'];

export function Purchases({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<PurchaseDocument | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [d, s] = await Promise.all([
      supabase.from('purchase_documents').select('*, supplier:suppliers(*)').is('archived_at', null).order('date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    setDocs((d.data as PurchaseDocument[]) || []);
    setSuppliers((s.data as Supplier[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter((d) => {
      if (filter !== 'all' && d.type !== filter) return false;
      if (!q) return true;
      return d.number.toLowerCase().includes(q) || (d.supplier?.name || '').toLowerCase().includes(q);
    });
  }, [docs, filter, search]);

  const handleCreate = async (type: string, supplierId: string, lines: { product_id: string; description: string; qty: number; unit_cost: number; tax_rate: number }[], notes: string) => {
    const prefix = 'BCF';
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('purchase_documents').select('number').like('number', `${prefix}-${year}-%`);
    const num = `${prefix}-${year}-${String((existing?.length || 0) + 1).padStart(4, '0')}`;
    let subtotal = 0, taxAmount = 0;
    const computed = lines.map((l) => { const lt = l.qty * l.unit_cost; subtotal += lt; taxAmount += lt * (l.tax_rate / 100); return { ...l, line_total: lt }; });
    const total = subtotal + taxAmount;
    const { data, error } = await supabase.from('purchase_documents').insert({
      number: num, type, status: type === 'invoice' ? 'received' : 'draft', supplier_id: supplierId, date: new Date().toISOString().slice(0, 10), subtotal, tax_amount: taxAmount, total, paid_amount: 0, notes,
    }).select().single();
    if (error) { toast('Erreur', 'error'); return; }
    if (computed.length > 0) await supabase.from('purchase_lines').insert(computed.map((l) => ({ ...l, document_id: data.id })));
    await supabase.from('activities').insert({ type: 'purchase', title: `${TYPE_LABELS[type]} ${num} créé`, description: suppliers.find((s) => s.id === supplierId)?.name || '', icon: 'ShoppingCart' });
    toast(`${TYPE_LABELS[type]} ${num} créé`);
    setShowForm(false); load();
  };

  const receiveGoods = async (doc: PurchaseDocument) => {
    const { data: lines } = await supabase.from('purchase_lines').select('*, product:products(*)').eq('document_id', doc.id);
    if (!lines || lines.length === 0) { toast('Aucune ligne', 'error'); return; }
    for (const l of lines as any[]) {
      if (l.product_id) {
        const newQty = (l.product?.stock_qty || 0) + l.qty;
        await supabase.from('products').update({ stock_qty: newQty, cost_price: l.unit_cost }).eq('id', l.product_id);
        await supabase.from('stock_movements').insert({ product_id: l.product_id, type: 'in', qty: l.qty, unit_cost: l.unit_cost, reason: `Réception ${doc.number}`, reference: doc.number });
      }
    }
    await supabase.from('purchase_documents').update({ status: 'received' }).eq('id', doc.id);
    await supabase.from('activities').insert({ type: 'purchase', title: `Réception ${doc.number}`, description: 'Stock mis à jour', icon: 'ArrowRight' });
    toast('Marchandise réceptionnée, stock mis à jour');
    load(); setDetail(null);
  };

  const paySupplier = async (doc: PurchaseDocument, amount: number, method: string) => {
    const prefix = settings?.payment_prefix || 'REG';
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('payments').select('number').like('number', `${prefix}-${year}-%`);
    const num = `${prefix}-${year}-${String((existing?.length || 0) + 1).padStart(4, '0')}`;
    const newPaid = doc.paid_amount + amount;
    const status = newPaid >= doc.total ? 'paid' : 'partial';
    await supabase.from('payments').insert({ number: num, direction: 'outbound', party_type: 'supplier', party_id: doc.supplier_id, document_id: doc.id, amount, method, date: new Date().toISOString().slice(0, 10), reference: num });
    await supabase.from('purchase_documents').update({ paid_amount: newPaid, status }).eq('id', doc.id);
    if (doc.supplier_id) {
      const { data: sup } = await supabase.from('suppliers').select('balance').eq('id', doc.supplier_id).single();
      if (sup) await supabase.from('suppliers').update({ balance: sup.balance + amount }).eq('id', doc.supplier_id);
    }
    toast('Paiement fournisseur enregistré');
    load(); setDetail(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('purchase_documents').update({ archived_at: new Date().toISOString() }).eq('id', deleteId);
    if (error) { toast('Erreur', 'error'); return; }
    toast('Document archivé'); setDeleteId(null); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Achats</h1>
          <p className="mt-1 text-sm text-ink-500">Demande → Commande → Réception → Facture → Paiement</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Nouvel achat</button>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {FLOW.map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2 dark:bg-ink-800">
                <FileText size={14} className="text-amber-600" />
                <span className="font-medium">{TYPE_LABELS[t]}</span>
              </div>
              {i < FLOW.length - 1 && <ArrowRight size={16} className="text-ink-400" />}
            </div>
          ))}
          <ArrowRight size={16} className="text-ink-400" />
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><CreditCard size={14} /> <span className="font-medium">Paiement</span></div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {['all', 'quote_request', 'order', 'receipt', 'invoice'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === f ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'}`}>
            {f === 'all' ? 'Tous' : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div> : filtered.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={24} />} title="Aucun achat" action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Nouvel achat</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3 font-medium">Numéro</th>
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="table-row-hover cursor-pointer border-b border-ink-50 dark:border-ink-800/50" onClick={() => setDetail(d)}>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Badge tone="warning">{TYPE_LABELS[d.type]}</Badge><span className="font-mono text-xs font-medium">{d.number}</span></div></td>
                    <td className="px-4 py-3">{d.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(d.date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(d.total, sym)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setDetail(d)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800"><Eye size={15} /></button>
                        <button onClick={() => setDeleteId(d.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && <PurchaseForm suppliers={suppliers} onClose={() => setShowForm(false)} onCreate={handleCreate} />}
      {detail && <PurchaseDetail doc={detail} onClose={() => setDetail(null)} onReceive={receiveGoods} onPay={paySupplier} sym={sym} settings={settings} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Archiver le document" message="Le document sera déplacé dans les archives. Vous pourrez le restaurer depuis la page Archives." confirmLabel="Archiver" danger />
    </div>
  );
}

function PurchaseForm({ suppliers, onClose, onCreate }: { suppliers: Supplier[]; onClose: () => void; onCreate: (type: string, supplierId: string, lines: any[], notes: string) => void }) {
  const [type, setType] = useState('order');
  const [supplierId, setSupplierId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<any[]>([{ product_id: '', description: '', qty: 1, unit_cost: 0, tax_rate: 20 }]);
  const [notes, setNotes] = useState('');

  useEffect(() => { supabase.from('products').select('*').order('name').then(({ data }) => setProducts((data as Product[]) || [])); }, []);
  const addLine = () => setLines([...lines, { product_id: '', description: '', qty: 1, unit_cost: 0, tax_rate: 20 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: any) => setLines(lines.map((l, idx) => {
    if (idx !== i) return l;
    const next = { ...l, [field]: value };
    if (field === 'product_id') { const p = products.find((x) => x.id === value); if (p) { next.description = p.name; next.unit_cost = p.cost_price; } }
    return next;
  }));
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);
  const tax = lines.reduce((s, l) => s + l.qty * l.unit_cost * (l.tax_rate / 100), 0);

  return (
    <Modal open onClose={onClose} title="Nouvel achat" size="xl" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={() => { if (!supplierId) { toast('Sélectionnez un fournisseur', 'error'); return; } onCreate(type, supplierId, lines.filter((l) => l.qty > 0), notes); }}>Créer</button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="quote_request">Demande de prix</option>
              <option value="order">Bon de commande</option>
              <option value="invoice">Facture fournisseur</option>
            </select>
          </div>
          <div><label className="label">Fournisseur</label>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between"><label className="text-sm font-medium">Lignes</label><button onClick={addLine} className="btn-ghost text-xs"><Plus size={14} /> Ajouter</button></div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <select className="input col-span-4" value={l.product_id} onChange={(e) => updateLine(i, 'product_id', e.target.value)}>
                  <option value="">— Produit —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="input col-span-3" placeholder="Description" value={l.description} onChange={(e) => updateLine(i, 'description', e.target.value)} />
                <input type="number" step="0.01" className="input col-span-2" placeholder="Qté" value={l.qty} onChange={(e) => updateLine(i, 'qty', parseFloat(e.target.value) || 0)} />
                <input type="number" step="0.01" className="input col-span-2" placeholder="Coût" value={l.unit_cost} onChange={(e) => updateLine(i, 'unit_cost', parseFloat(e.target.value) || 0)} />
                <button onClick={() => removeLine(i)} className="col-span-1 rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><X size={15} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
          <div><div className="text-xs text-ink-500">Sous-total HT</div><div className="font-display font-bold">{formatMoney(subtotal)}</div></div>
          <div><div className="text-xs text-ink-500">TVA</div><div className="font-display font-bold">{formatMoney(tax)}</div></div>
          <div><div className="text-xs text-ink-500">Total TTC</div><div className="font-display font-bold text-amber-600">{formatMoney(subtotal + tax)}</div></div>
        </div>
        <div><label className="label">Notes</label><textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function PurchaseDetail({ doc, onClose, onReceive, onPay, sym, settings }: { doc: PurchaseDocument; onClose: () => void; onReceive: (d: PurchaseDocument) => void; onPay: (d: PurchaseDocument, amount: number, method: string) => void; sym: string; settings: any }) {
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [payAmount, setPayAmount] = useState(doc.total - doc.paid_amount);
  const [payMethod, setPayMethod] = useState('transfer');

  useEffect(() => { supabase.from('purchase_lines').select('*, product:products(*)').eq('document_id', doc.id).then(({ data }) => { setLines((data as PurchaseLine[]) || []); setLoading(false); }); }, [doc.id]);
  const remaining = doc.total - doc.paid_amount;

  const buildDocHTML = () => generateDocumentHTML(
    {
      number: doc.number,
      typeLabel: TYPE_LABELS[doc.type] || doc.type,
      date: doc.date,
      due_date: doc.due_date,
      subtotal: doc.subtotal,
      tax_amount: doc.tax_amount,
      total: doc.total,
      paid_amount: doc.paid_amount,
      notes: doc.notes,
    },
    lines.map((l) => ({ description: l.description || l.product?.name, qty: l.qty, unit_cost: l.unit_cost, tax_rate: l.tax_rate, line_total: l.line_total })),
    { name: doc.supplier?.name || '—', email: doc.supplier?.email, phone: doc.supplier?.phone },
    'Fournisseur',
    settings || {},
    sym,
  );

  return (
    <Modal open onClose={onClose} title={`${TYPE_LABELS[doc.type]} ${doc.number}`} size="xl" footer={
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => openPrintWindow(buildDocHTML())}><Printer size={15} /> Imprimer</button>
          <button className="btn-ghost" onClick={() => downloadDocument(buildDocHTML(), `${doc.number}.html`)}><Download size={15} /> Télécharger PDF</button>
        </div>
        <div className="flex gap-2">
          {doc.type === 'order' && doc.status !== 'received' && <button className="btn-secondary" onClick={() => onReceive(doc)}><ArrowRight size={15} /> Réceptionner</button>}
          {remaining > 0 && <button className="btn-primary" onClick={() => setShowPay(true)}><CreditCard size={15} /> Payer fournisseur</button>}
        </div>
      </div>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4"><div className="text-xs text-ink-500">Fournisseur</div><div className="mt-1 font-medium">{doc.supplier?.name || '—'}</div></div>
          <div className="card p-4"><div className="flex justify-between"><div><div className="text-xs text-ink-500">Date</div><div className="mt-1 font-medium">{formatDate(doc.date)}</div></div><div className="text-right"><div className="text-xs text-ink-500">Échéance</div><div className="mt-1 font-medium">{formatDate(doc.due_date)}</div></div></div></div>
        </div>
        {loading ? <div className="flex justify-center py-6"><Spinner className="h-5 w-5 text-brand-600" /></div> : (
          <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800/50"><tr className="text-left text-xs uppercase tracking-wider text-ink-400"><th className="px-3 py-2 font-medium">Désignation</th><th className="px-3 py-2 text-right font-medium">Qté</th><th className="px-3 py-2 text-right font-medium">Coût</th><th className="px-3 py-2 text-right font-medium">Total</th></tr></thead>
              <tbody>
                {lines.map((l) => (<tr key={l.id} className="border-t border-ink-50 dark:border-ink-800/50"><td className="px-3 py-2">{l.description || l.product?.name}</td><td className="px-3 py-2 text-right">{l.qty}</td><td className="px-3 py-2 text-right">{formatMoney(l.unit_cost, sym)}</td><td className="px-3 py-2 text-right font-medium">{formatMoney(l.line_total, sym)}</td></tr>))}
              </tbody>
            </table>
          </div>
        )}
        <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">Sous-total HT</span><span className="font-medium">{formatMoney(doc.subtotal, sym)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">TVA</span><span className="font-medium">{formatMoney(doc.tax_amount, sym)}</span></div>
          <div className="flex justify-between border-t border-ink-100 pt-1.5 dark:border-ink-800"><span className="font-semibold">Total TTC</span><span className="font-display text-lg font-bold text-amber-600">{formatMoney(doc.total, sym)}</span></div>
          {doc.paid_amount > 0 && <div className="flex justify-between text-emerald-600"><span>Payé</span><span className="font-medium">{formatMoney(doc.paid_amount, sym)}</span></div>}
          {remaining > 0 && <div className="flex justify-between text-red-600"><span>Reste à payer</span><span className="font-medium">{formatMoney(remaining, sym)}</span></div>}
        </div>
      </div>
      {showPay && (
        <Modal open onClose={() => setShowPay(false)} title="Paiement fournisseur" size="sm" footer={<><button className="btn-secondary" onClick={() => setShowPay(false)}>Annuler</button><button className="btn-primary" onClick={() => onPay(doc, payAmount, payMethod)}>Valider</button></>}>
          <div className="space-y-3">
            <div><label className="label">Montant</label><input type="number" step="0.01" className="input" value={payAmount} onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)} /></div>
            <div><label className="label">Mode</label><select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}><option value="transfer">Virement</option><option value="cash">Espèces</option><option value="check">Chèque</option></select></div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
