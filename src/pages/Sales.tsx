import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatDate } from '../lib/format';
import { Card, Badge, Modal, Spinner, EmptyState, StatusBadge, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import {
  ShoppingCart, Plus, Search, FileText, Send, CreditCard,
  ArrowRight, Eye, Trash2, Printer, Mail, FileSignature, X,
  Check, Eraser, Download, UserPlus, MessageCircle, ChevronDown,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import type { SalesDocument, SalesLine, Customer, Product, Service, SalesDocumentType } from '../lib/types';
import { generateDocumentHTML, openPrintWindow, downloadDocument } from '../lib/document';

const TYPE_LABELS: Record<string, string> = {
  quote: 'Devis', order: 'Bon de commande', delivery: 'Bon de livraison', invoice: 'Facture', proforma: 'Proforma', credit_note: 'Avoir',
};
const TYPE_PREFIX: Record<string, string> = {
  quote: 'DEV', order: 'BC', delivery: 'BL', invoice: 'FAC', proforma: 'PRO', credit_note: 'AV',
};
const FLOW: SalesDocumentType[] = ['quote', 'order', 'delivery', 'invoice'];

// Which document types can be converted from a given type
const CONVERT_OPTIONS: Record<string, SalesDocumentType[]> = {
  quote: ['order', 'delivery', 'invoice'],
  order: ['delivery', 'invoice'],
  delivery: ['invoice'],
};

export function Sales({ settings }: { settings: any; onNavigate: (id: string) => void }) {
  const sym = settings?.currency_symbol || 'DH';
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<SalesDocument[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<SalesDocument | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [d, c] = await Promise.all([
      supabase.from('sales_documents').select('*, customer:customers(*)').is('archived_at', null).order('date', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
    ]);
    setDocs((d.data as SalesDocument[]) || []);
    setCustomers((c.data as Customer[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter((d) => {
      if (filter !== 'all' && d.type !== filter) return false;
      if (!q) return true;
      return d.number.toLowerCase().includes(q) || (d.customer?.name || '').toLowerCase().includes(q);
    });
  }, [docs, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    docs.forEach((d) => { c[d.type] = (c[d.type] || 0) + 1; });
    return c;
  }, [docs]);

  const handleCreate = async (type: SalesDocumentType, customerId: string, lines: { product_id: string; description: string; qty: number; unit_price: number; tax_rate: number; discount: number }[], notes: string, applyTax: boolean) => {
    const prefix = (settings as any)?.[`${type}_prefix`] || TYPE_PREFIX[type];
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('sales_documents').select('number').like('number', `${prefix}-${year}-%`);
    const num = `${prefix}-${year}-${String((existing?.length || 0) + 1).padStart(4, '0')}`;
    let subtotal = 0, taxAmount = 0, discountAmount = 0;
    const computedLines = lines.map((l) => {
      const gross = l.qty * l.unit_price;
      const disc = gross * (l.discount / 100);
      discountAmount += disc;
      const lineTotal = gross - disc;
      subtotal += lineTotal;
      taxAmount += lineTotal * (l.tax_rate / 100);
      return { product_id: l.product_id || null, description: l.description, qty: l.qty, unit_price: l.unit_price, discount: l.discount, tax_rate: l.tax_rate, line_total: lineTotal };
    });
    const total = subtotal + taxAmount;
    const { data, error } = await supabase.from('sales_documents').insert({
      number: num, type, status: 'draft', customer_id: customerId, date: new Date().toISOString().slice(0, 10),
      subtotal, tax_amount: taxAmount, discount_amount: discountAmount, total, paid_amount: 0, notes,
    }).select().single();
    if (error) { toast('Erreur création document', 'error'); return; }
    if (computedLines.length > 0) {
      await supabase.from('sales_lines').insert(computedLines.map((l) => ({ ...l, document_id: data.id })));
    }
    // Deduct stock when creating a delivery note directly
    if (type === 'delivery') {
      for (const l of computedLines) {
        if (l.product_id) {
          const { data: prod } = await supabase.from('products').select('stock_qty').eq('id', l.product_id).maybeSingle();
          const current = (prod as any)?.stock_qty ?? 0;
          await supabase.from('products').update({ stock_qty: Math.max(0, current - l.qty) }).eq('id', l.product_id);
          await supabase.from('stock_movements').insert({ product_id: l.product_id, type: 'out', qty: -l.qty, unit_cost: 0, reason: `BL ${num}`, reference: num });
        }
      }
    }
    await supabase.from('activities').insert({ type: 'sale', title: `${TYPE_LABELS[type]} ${num} créé`, description: customers.find((c) => c.id === customerId)?.name || '', icon: 'FileText' });
    toast(`${TYPE_LABELS[type]} ${num} créé`);
    setShowForm(false);
    load();
  };

  const convertDoc = async (doc: SalesDocument, toType: SalesDocumentType) => {
    const prefix = (settings as any)?.[`${toType}_prefix`] || TYPE_PREFIX[toType];
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('sales_documents').select('number').like('number', `${prefix}-${year}-%`);
    const num = `${prefix}-${year}-${String((existing?.length || 0) + 1).padStart(4, '0')}`;
    const { data: newDoc, error } = await supabase.from('sales_documents').insert({
      number: num, type: toType, status: toType === 'invoice' ? 'sent' : 'validated', customer_id: doc.customer_id,
      date: new Date().toISOString().slice(0, 10),
      due_date: toType === 'invoice' ? new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) : null,
      subtotal: doc.subtotal, tax_amount: doc.tax_amount, total: doc.total, paid_amount: 0, parent_id: doc.id, notes: doc.notes,
    }).select().single();
    if (error) { toast('Erreur conversion', 'error'); return; }
    const { data: lines } = await supabase.from('sales_lines').select('*').eq('document_id', doc.id);
    if (lines && lines.length > 0) {
      await supabase.from('sales_lines').insert(
        lines.map((l: any) => ({
          document_id: newDoc.id, product_id: l.product_id, description: l.description,
          qty: l.qty, unit_price: l.unit_price, discount: l.discount, tax_rate: l.tax_rate, line_total: l.line_total,
        }))
      );
    }
    if (toType === 'delivery') {
      const dl = lines || [];
      for (const l of dl) {
        if (l.product_id) {
          const { data: prod } = await supabase.from('products').select('stock_qty').eq('id', l.product_id).maybeSingle();
          const current = (prod as any)?.stock_qty ?? 0;
          await supabase.from('products').update({ stock_qty: Math.max(0, current - l.qty) }).eq('id', l.product_id);
          await supabase.from('stock_movements').insert({ product_id: l.product_id, type: 'out', qty: -l.qty, unit_cost: 0, reason: `BL ${num}`, reference: num });
        }
      }
    }
    await supabase.from('activities').insert({ type: 'sale', title: `${TYPE_LABELS[toType]} ${num} généré`, description: `Converti depuis ${doc.number}`, icon: 'ArrowRight' });
    toast(`Converti en ${TYPE_LABELS[toType]} ${num}`);
    load();
  };

  const updateStatus = async (doc: SalesDocument, status: string) => {
    const { error } = await supabase.from('sales_documents').update({ status }).eq('id', doc.id);
    if (error) { toast('Erreur', 'error'); return; }
    toast('Statut mis à jour');
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('sales_documents').update({ archived_at: new Date().toISOString() }).eq('id', deleteId);
    if (error) { toast('Erreur', 'error'); return; }
    toast('Document archivé'); setDeleteId(null); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Documents commerciaux</h1>
          <p className="mt-1 text-sm text-ink-500">Devis → Commande → Livraison → Facture → Paiement</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Nouveau document</button>
      </div>

      {/* Flow visualization */}
      <Card>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {FLOW.map((t, i) => (
            <div key={t} className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-2 dark:bg-ink-800">
                <FileText size={14} className="text-brand-600" />
                <span className="font-medium">{TYPE_LABELS[t]}</span>
                <Badge tone="neutral">{counts[t] || 0}</Badge>
              </div>
              {i < FLOW.length - 1 && <ArrowRight size={16} className="text-ink-400" />}
            </div>
          ))}
          <ArrowRight size={16} className="text-ink-400" />
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CreditCard size={14} /> <span className="font-medium">Paiement</span>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {['all', 'quote', 'order', 'delivery', 'invoice', 'proforma', 'credit_note'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === f ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'
            }`}
          >
            {f === 'all' ? 'Tous' : TYPE_LABELS[f]} ({counts[f] || 0})
          </button>
        ))}
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par numéro, client…" className="input pl-9" />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div> : filtered.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={24} />} title="Aucun document" description="Créez un devis pour démarrer le cycle de vente." action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Nouveau</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3 font-medium">Numéro</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="table-row-hover cursor-pointer border-b border-ink-50 dark:border-ink-800/50" onClick={() => setDetail(d)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="brand">{TYPE_LABELS[d.type]}</Badge>
                        <span className="font-mono text-xs font-medium">{d.number}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{d.customer?.name || '—'}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(d.date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(d.total, sym)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setDetail(d)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800" title="Voir"><Eye size={15} /></button>
                        <button onClick={() => setDeleteId(d.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Supprimer"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && <DocumentForm customers={customers} onClose={() => setShowForm(false)} onCreate={handleCreate} settings={settings} />}
      {detail && <DocumentDetail doc={detail} onClose={() => setDetail(null)} onConvert={convertDoc} onStatus={updateStatus} sym={sym} settings={settings} onReload={load} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Archiver le document" message="Le document sera déplacé dans les archives. Vous pourrez le restaurer depuis la page Archives." confirmLabel="Archiver" danger />
    </div>
  );
}

function DocumentForm({ customers, onClose, onCreate, settings }: {
  customers: Customer[];
  onClose: () => void;
  onCreate: (type: SalesDocumentType, customerId: string, lines: { product_id: string; description: string; qty: number; unit_price: number; tax_rate: number; discount: number }[], notes: string, applyTax: boolean) => void;
  settings: any;
}) {
  const sym = settings?.currency_symbol || 'DH';
  const defaultTaxRate = settings?.default_tax_rate ?? 20;
  const [type, setType] = useState<SalesDocumentType>('quote');
  const [customerId, setCustomerId] = useState('');
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [lines, setLines] = useState<{ item_type: 'product' | 'service'; product_id: string; service_id: string; description: string; qty: number; unit_price: number; tax_rate: number; discount: number }[]>([{ item_type: 'product', product_id: '', service_id: '', description: '', qty: 1, unit_price: 0, tax_rate: defaultTaxRate, discount: 0 }]);
  const [notes, setNotes] = useState('');
  const [applyTax, setApplyTax] = useState(true);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', type: 'particulier', tax_id: '', email: '', phone: '', city: '', country: 'Maroc', payment_terms: '30 jours', credit_limit: 0, loyalty_points: 0, balance: 0 });
  const [savingClient, setSavingClient] = useState(false);

  useEffect(() => {
    supabase.from('products').select('*').eq('active', true).order('name').then(({ data }) => setProducts((data as Product[]) || []));
    supabase.from('services').select('*').eq('active', true).order('name').then(({ data }) => setServices((data as Service[]) || []));
  }, []);

  const addLine = () => setLines([...lines, { item_type: 'product', product_id: '', service_id: '', description: '', qty: 1, unit_price: 0, tax_rate: defaultTaxRate, discount: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: any) => {
    setLines(lines.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l, [field]: value };
      if (field === 'product_id') {
        const p = products.find((x) => x.id === value);
        if (p) { next.description = p.name; next.unit_price = p.sale_price; next.tax_rate = applyTax ? p.tax_rate : 0; }
      } else if (field === 'service_id') {
        const s = services.find((x) => x.id === value);
        if (s) { next.description = s.name; next.unit_price = s.price; next.tax_rate = applyTax && s.tax_enabled ? s.tax_rate : 0; }
      } else if (field === 'item_type') {
        next.product_id = '';
        next.service_id = '';
        next.description = '';
        next.unit_price = 0;
        next.tax_rate = applyTax ? defaultTaxRate : 0;
        next.discount = 0;
      }
      return next;
    }));
  };

  const toggleApplyTax = () => {
    const newVal = !applyTax;
    setApplyTax(newVal);
    setLines((prev) => prev.map((l) => {
      if (!newVal) return { ...l, tax_rate: 0 };
      if (l.item_type === 'product') {
        const p = products.find((x) => x.id === l.product_id);
        return { ...l, tax_rate: p?.tax_rate ?? defaultTaxRate };
      }
      if (l.item_type === 'service') {
        const s = services.find((x) => x.id === l.service_id);
        return { ...l, tax_rate: s?.tax_enabled ? s.tax_rate : 0 };
      }
      return { ...l, tax_rate: defaultTaxRate };
    }));
  };

  const createClient = async () => {
    if (!newClient.name.trim()) { toast('Nom du client requis', 'error'); return; }
    setSavingClient(true);
    const { data, error } = await supabase.from('customers').insert(newClient).select().single();
    setSavingClient(false);
    if (error) { toast('Erreur lors de la création du client', 'error'); return; }
    const created = data as Customer;
    setLocalCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(created.id);
    setShowNewClient(false);
    setNewClient({ name: '', type: 'particulier', tax_id: '', email: '', phone: '', city: '', country: 'Maroc', payment_terms: '30 jours', credit_limit: 0, loyalty_points: 0, balance: 0 });
    toast(`Client "${created.name}" créé et sélectionné`);
  };

  const nc = newClient;
  const setNc = (k: string, v: string) => setNewClient((prev) => ({ ...prev, [k]: v }));

  const grossSubtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const discountTotal = lines.reduce((s, l) => s + l.qty * l.unit_price * (l.discount / 100), 0);
  const subtotal = grossSubtotal - discountTotal;
  const tax = applyTax ? lines.reduce((s, l) => {
    const lineNet = l.qty * l.unit_price * (1 - l.discount / 100);
    return s + lineNet * (l.tax_rate / 100);
  }, 0) : 0;

  return (
    <Modal open onClose={onClose} title="Nouveau document commercial" size="xl" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={() => { if (!customerId) { toast('Sélectionnez un client', 'error'); return; } onCreate(type, customerId, lines.filter((l) => l.qty > 0).map((l) => ({ product_id: l.item_type === 'product' ? l.product_id : '', description: l.description, qty: l.qty, unit_price: l.unit_price, tax_rate: applyTax ? l.tax_rate : 0, discount: l.discount })), notes, applyTax); }}>Créer</button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type de document</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as SalesDocumentType)}>
              <option value="quote">Devis</option>
              <option value="order">Bon de commande</option>
              <option value="delivery">Bon de livraison</option>
              <option value="invoice">Facture</option>
              <option value="proforma">Facture proforma</option>
              <option value="credit_note">Avoir</option>
            </select>
          </div>
          <div>
            <label className="label">Client</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setShowNewClient(false); }}>
                <option value="">— Sélectionner —</option>
                {localCustomers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.tax_id ? ` (ICE: ${c.tax_id})` : ''}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowNewClient((v) => !v)}
                title="Créer un nouveau client"
                className={`shrink-0 rounded-lg border px-2.5 text-sm font-medium transition ${showNewClient ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/60 dark:text-brand-300' : 'border-ink-200 text-ink-500 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800'}`}
              >
                <UserPlus size={16} />
              </button>
            </div>
          </div>
        </div>

        {showNewClient && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 dark:border-brand-900/40 dark:bg-brand-950/10">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
                <UserPlus size={15} /> Nouveau client
              </div>
              <button onClick={() => setShowNewClient(false)} className="rounded p-0.5 text-ink-400 hover:text-ink-600"><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Nom / Raison sociale *</label>
                <input className="input" value={nc.name} onChange={(e) => setNc('name', e.target.value)} placeholder="Ex : Société Atlas SARL" autoFocus />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={nc.type} onChange={(e) => setNc('type', e.target.value)}>
                  <option value="particulier">Particulier</option>
                  <option value="entreprise">Entreprise</option>
                </select>
              </div>
              <div>
                <label className="label">ICE</label>
                <input className="input font-mono" value={nc.tax_id} onChange={(e) => setNc('tax_id', e.target.value)} placeholder="000000000000000" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={nc.email} onChange={(e) => setNc('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={nc.phone} onChange={(e) => setNc('phone', e.target.value)} placeholder="06 00 00 00 00" />
              </div>
              <div>
                <label className="label">Ville</label>
                <input className="input" value={nc.city} onChange={(e) => setNc('city', e.target.value)} />
              </div>
              <div>
                <label className="label">Pays</label>
                <input className="input" value={nc.country} onChange={(e) => setNc('country', e.target.value)} />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn-secondary text-sm" onClick={() => setShowNewClient(false)}>Annuler</button>
              <button className="btn-primary text-sm" onClick={createClient} disabled={savingClient}>
                {savingClient ? <Spinner className="h-3.5 w-3.5" /> : <Check size={14} />} Créer et sélectionner
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-ink-100 p-3 dark:border-ink-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200">TVA</span>
            <span className="text-xs text-ink-400">Appliquer la taxe sur les lignes</span>
          </div>
          <button
            onClick={toggleApplyTax}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              applyTax
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                : 'border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-900'
            }`}
          >
            {applyTax ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            {applyTax ? 'TVA activée' : 'TVA désactivée'}
          </button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">Lignes</label>
            <button onClick={addLine} className="btn-ghost text-xs"><Plus size={14} /> Ajouter ligne</button>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <select className="input col-span-2" value={l.item_type} onChange={(e) => updateLine(i, 'item_type', e.target.value)}>
                  <option value="product">Produit</option>
                  <option value="service">Service</option>
                </select>
                {l.item_type === 'product' ? (
                  <select className="input col-span-3" value={l.product_id} onChange={(e) => updateLine(i, 'product_id', e.target.value)}>
                    <option value="">— Choisir —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                ) : (
                  <select className="input col-span-3" value={l.service_id} onChange={(e) => updateLine(i, 'service_id', e.target.value)}>
                    <option value="">— Choisir —</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                <input type="number" step="0.01" className="input col-span-1" placeholder="Qté" value={l.qty} onChange={(e) => updateLine(i, 'qty', parseFloat(e.target.value) || 0)} />
                <input type="number" step="0.01" className="input col-span-2" placeholder="Prix" value={l.unit_price} onChange={(e) => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                <input type="number" step="0.01" min="0" max="100" className="input col-span-1" placeholder="Rem%" value={l.discount} onChange={(e) => updateLine(i, 'discount', parseFloat(e.target.value) || 0)} />
                <input type="number" step="0.01" className="input col-span-1" placeholder="TVA%" value={l.tax_rate} onChange={(e) => updateLine(i, 'tax_rate', parseFloat(e.target.value) || 0)} disabled={!applyTax} />
                <button onClick={() => removeLine(i)} className="col-span-2 rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><X size={15} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
          <div><div className="text-xs text-ink-500">Sous-total HT</div><div className="font-display font-bold">{formatMoney(grossSubtotal, sym)}</div></div>
          {discountTotal > 0 && <div><div className="text-xs text-ink-500">Remise</div><div className="font-display font-bold text-emerald-600">-{formatMoney(discountTotal, sym)}</div></div>}
          <div><div className="text-xs text-ink-500">Net HT</div><div className="font-display font-bold">{formatMoney(subtotal, sym)}</div></div>
          <div><div className="text-xs text-ink-500">TVA</div><div className="font-display font-bold">{applyTax ? formatMoney(tax, sym) : '—'}</div></div>
          <div><div className="text-xs text-ink-500">Total {applyTax ? 'TTC' : 'HT'}</div><div className="font-display font-bold text-brand-600">{formatMoney(subtotal + tax, sym)}</div></div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, remarques…" />
        </div>
      </div>
    </Modal>
  );
}

function ConvertDropdown({ doc, onConvert }: { doc: SalesDocument; onConvert: (d: SalesDocument, t: SalesDocumentType) => void }) {
  const [open, setOpen] = useState(false);
  const options = CONVERT_OPTIONS[doc.type] || [];
  if (options.length === 0) return null;

  return (
    <div className="relative">
      <button
        className="btn-primary flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
      >
        <ArrowRight size={15} /> Convertir <ChevronDown size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-pop dark:border-ink-800 dark:bg-ink-900">
          {options.map((t) => (
            <button
              key={t}
              onClick={() => { setOpen(false); onConvert(doc, t); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              <FileText size={14} className="text-brand-500" />
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentDetail({ doc, onClose, onConvert, onStatus, sym, settings, onReload }: {
  doc: SalesDocument;
  onClose: () => void;
  onConvert: (d: SalesDocument, t: SalesDocumentType) => void;
  onStatus: (d: SalesDocument, s: string) => void;
  sym: string;
  settings: any;
  onReload: () => void;
}) {
  const [lines, setLines] = useState<SalesLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    supabase.from('sales_lines').select('*, product:products(*)').eq('document_id', doc.id).then(({ data }) => {
      setLines((data as SalesLine[]) || []);
      setLoading(false);
    });
  }, [doc.id]);

  const remaining = doc.total - doc.paid_amount;

  const recordPayment = async (amount: number, method: string) => {
    const prefix = settings?.payment_prefix || 'REG';
    const year = new Date().getFullYear();
    const { data: existing } = await supabase.from('payments').select('number').like('number', `${prefix}-${year}-%`);
    const num = `${prefix}-${year}-${String((existing?.length || 0) + 1).padStart(4, '0')}`;
    const newPaid = doc.paid_amount + amount;
    const status = newPaid >= doc.total ? 'paid' : 'partial';
    await supabase.from('payments').insert({ number: num, direction: 'inbound', party_type: 'customer', party_id: doc.customer_id, document_id: doc.id, amount, method, date: new Date().toISOString().slice(0, 10), reference: num });
    await supabase.from('sales_documents').update({ paid_amount: newPaid, status }).eq('id', doc.id);
    if (doc.customer_id) {
      const { data: cust } = await supabase.from('customers').select('balance').eq('id', doc.customer_id).single();
      if (cust) await supabase.from('customers').update({ balance: Math.max(0, cust.balance - amount) }).eq('id', doc.customer_id);
    }
    await supabase.from('activities').insert({ type: 'payment', title: `Paiement ${num} encaissé`, description: `${formatMoney(amount, sym)} - ${doc.number}`, icon: 'CreditCard' });
    toast('Paiement enregistré');
    setShowPayment(false);
    onReload();
    onClose();
  };

  const buildDocHTML = () => generateDocumentHTML(
    {
      number: doc.number,
      typeLabel: TYPE_LABELS[doc.type],
      date: doc.date,
      due_date: doc.due_date,
      subtotal: doc.subtotal,
      tax_amount: doc.tax_amount,
      total: doc.total,
      paid_amount: doc.paid_amount,
      discount_amount: doc.discount_amount,
      notes: doc.notes,
    },
    lines.map((l) => ({ description: l.description || l.product?.name, qty: l.qty, unit_price: l.unit_price, tax_rate: l.tax_rate, line_total: l.line_total })),
    {
      name: doc.customer?.name || '—',
      email: doc.customer?.email,
      phone: doc.customer?.phone,
      address: [doc.customer?.address, doc.customer?.city, doc.customer?.country].filter(Boolean).join(', '),
      tax_id: doc.customer?.tax_id,
    },
    'Client',
    settings || {},
    sym,
  );

  const handlePrint = () => openPrintWindow(buildDocHTML());

  const handleDownload = () => {
    downloadDocument(buildDocHTML(), `${doc.number}.html`);
  };

  const handleSendEmail = async () => {
    const email = doc.customer?.email || '';
    const subject = encodeURIComponent(`${TYPE_LABELS[doc.type]} ${doc.number}`);
    const body = encodeURIComponent(
      `Bonjour ${doc.customer?.name || ''},\n\nVeuillez trouver votre ${TYPE_LABELS[doc.type].toLowerCase()} n° ${doc.number} d'un montant de ${formatMoney(doc.total, sym)}.\n\nCordialement,\n${settings?.company_name || ''}`
    );
    window.location.href = email ? `mailto:${email}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
    if (doc.status === 'draft') await onStatus(doc, 'sent');
    toast('Messagerie email ouverte', 'success');
    setShowShare(false);
  };

  const handleSendWhatsApp = async () => {
    const rawPhone = (doc.customer?.phone || '').replace(/\s/g, '').replace(/^0/, '212');
    const text = encodeURIComponent(
      `Bonjour ${doc.customer?.name || ''},\n\nVeuillez trouver votre ${TYPE_LABELS[doc.type].toLowerCase()} n° ${doc.number} d'un montant de ${formatMoney(doc.total, sym)}.\n\nCordialement,\n${settings?.company_name || ''}`
    );
    const url = rawPhone.length >= 10
      ? `https://wa.me/${rawPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (doc.status === 'draft') await onStatus(doc, 'sent');
    toast('WhatsApp ouvert', 'success');
    setShowShare(false);
  };

  const [showSignature, setShowSignature] = useState(false);

  return (
    <Modal open onClose={onClose} title={`${TYPE_LABELS[doc.type]} ${doc.number}`} size="xl" footer={
      <div className="flex w-full items-center justify-between">
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={handlePrint}><Printer size={15} /> Imprimer</button>
          <button className="btn-ghost" onClick={handleDownload}><Download size={15} /> PDF</button>
          <button className="btn-ghost" onClick={() => setShowShare(true)}><Send size={15} /> Partager</button>
          <button className="btn-ghost" onClick={() => setShowSignature(true)}><FileSignature size={15} /> Signature</button>
        </div>
        <div className="flex gap-2">
          {doc.status === 'draft' && <button className="btn-secondary" onClick={() => onStatus(doc, 'sent')}><Send size={15} /> Envoyer</button>}
          <ConvertDropdown doc={doc} onConvert={onConvert} />
          {doc.type === 'invoice' && remaining > 0 && <button className="btn-primary" onClick={() => setShowPayment(true)}><CreditCard size={15} /> Encaisser</button>}
        </div>
      </div>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="text-xs text-ink-500">Client</div>
            <div className="mt-1 font-medium">{doc.customer?.name || '—'}</div>
            <div className="text-xs text-ink-400">{doc.customer?.email || ''}</div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div><div className="text-xs text-ink-500">Date</div><div className="mt-1 font-medium">{formatDate(doc.date)}</div></div>
              <div className="text-right"><div className="text-xs text-ink-500">Échéance</div><div className="mt-1 font-medium">{formatDate(doc.due_date)}</div></div>
            </div>
          </div>
        </div>

        {loading ? <div className="flex justify-center py-6"><Spinner className="h-5 w-5 text-brand-600" /></div> : (
          <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-800/50">
                <tr className="text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2 font-medium">Désignation</th>
                  <th className="px-3 py-2 text-right font-medium">Qté</th>
                  <th className="px-3 py-2 text-right font-medium">P.U.</th>
                  <th className="px-3 py-2 text-right font-medium">TVA</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-ink-50 dark:border-ink-800/50">
                    <td className="px-3 py-2">{l.description || l.product?.name}</td>
                    <td className="px-3 py-2 text-right">{l.qty}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(l.unit_price, sym)}</td>
                    <td className="px-3 py-2 text-right">{l.tax_rate}%</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(l.line_total, sym)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-ink-500">Sous-total HT</span><span className="font-medium">{formatMoney(doc.subtotal, sym)}</span></div>
          <div className="flex justify-between"><span className="text-ink-500">TVA</span><span className="font-medium">{formatMoney(doc.tax_amount, sym)}</span></div>
          {doc.discount_amount > 0 && <div className="flex justify-between"><span className="text-ink-500">Remise</span><span className="font-medium">-{formatMoney(doc.discount_amount, sym)}</span></div>}
          <div className="flex justify-between border-t border-ink-100 pt-1.5 dark:border-ink-800"><span className="font-semibold">Total TTC</span><span className="font-display text-lg font-bold text-brand-600">{formatMoney(doc.total, sym)}</span></div>
          {doc.paid_amount > 0 && <div className="flex justify-between text-emerald-600"><span>Payé</span><span className="font-medium">{formatMoney(doc.paid_amount, sym)}</span></div>}
          {remaining > 0 && doc.type === 'invoice' && <div className="flex justify-between text-red-600"><span>Reste à payer</span><span className="font-medium">{formatMoney(remaining, sym)}</span></div>}
        </div>
      </div>

      {showPayment && <PaymentModal total={remaining} onClose={() => setShowPayment(false)} onPay={recordPayment} sym={sym} />}
      {showShare && (
        <ShareModal
          doc={doc}
          sym={sym}
          onClose={() => setShowShare(false)}
          onEmail={handleSendEmail}
          onWhatsApp={handleSendWhatsApp}
        />
      )}
      {showSignature && <SignatureModal doc={doc} onClose={() => setShowSignature(false)} onSigned={async (dataUrl) => {
        await supabase.from('activities').insert({
          type: 'sale',
          title: `Signature électronique — ${doc.number}`,
          description: `Signé par le client`,
          icon: 'FileSignature',
        });
        if (doc.status === 'draft' || doc.status === 'sent') {
          await onStatus(doc, 'validated');
        }
        setShowSignature(false);
        toast('Document signé avec succès', 'success');
        onReload();
        void dataUrl;
      }} />}
    </Modal>
  );
}

function PaymentModal({ total, onClose, onPay, sym }: { total: number; onClose: () => void; onPay: (amount: number, method: string) => void; sym: string }) {
  const [amount, setAmount] = useState(total);
  const [method, setMethod] = useState('cash');
  return (
    <Modal open onClose={onClose} title="Encaissement" size="sm" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={() => onPay(amount, method)}>Valider</button></>}>
      <div className="space-y-3">
        <div><label className="label">Montant à encaisser</label><input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} /></div>
        <div><label className="label">Mode de paiement</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Espèces</option>
            <option value="card">Carte bancaire</option>
            <option value="check">Chèque</option>
            <option value="transfer">Virement</option>
            <option value="mobile_money">Mobile Money</option>
          </select>
        </div>
        <div className="rounded-lg bg-ink-50 p-3 text-sm dark:bg-ink-800/50">Reste à payer: <span className="font-bold">{formatMoney(total, sym)}</span></div>
      </div>
    </Modal>
  );
}

function ShareModal({
  doc, sym, onClose, onEmail, onWhatsApp,
}: {
  doc: SalesDocument; sym: string; onClose: () => void; onEmail: () => void; onWhatsApp: () => void;
}) {
  const hasEmail = !!doc.customer?.email;
  const hasPhone = !!doc.customer?.phone;
  return (
    <Modal open onClose={onClose} title="Partager le document" size="sm" footer={
      <button className="btn-secondary" onClick={onClose}>Fermer</button>
    }>
      <div className="space-y-3">
        <div className="rounded-lg bg-ink-50 p-3 text-sm dark:bg-ink-800/50">
          <span className="font-medium">{TYPE_LABELS[doc.type]} {doc.number}</span>
          <span className="mx-2 text-ink-400">·</span>
          <span className="text-ink-500">{doc.customer?.name || '—'}</span>
        </div>
        <button
          onClick={onEmail}
          className="flex w-full items-center gap-4 rounded-xl border border-ink-100 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-800 dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50">
            <Mail size={20} />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Email</div>
            <div className="text-xs text-ink-500">
              {hasEmail ? doc.customer!.email : 'Aucun email enregistré — vous pourrez le saisir'}
            </div>
          </div>
          {!hasEmail && <span className="text-xs text-amber-500">Manuel</span>}
        </button>
        <button
          onClick={onWhatsApp}
          className="flex w-full items-center gap-4 rounded-xl border border-ink-100 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-ink-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
            <MessageCircle size={20} />
          </div>
          <div className="flex-1">
            <div className="font-semibold">WhatsApp</div>
            <div className="text-xs text-ink-500">
              {hasPhone ? doc.customer!.phone : 'Aucun téléphone — ouvrira WhatsApp Web'}
            </div>
          </div>
          {!hasPhone && <span className="text-xs text-amber-500">Manuel</span>}
        </button>
      </div>
    </Modal>
  );
}

function SignatureModal({
  doc, onClose, onSigned,
}: {
  doc: SalesDocument; onClose: () => void; onSigned: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); setDrawing(true); lastPos.current = getPos(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current?.x ?? pos.x, lastPos.current?.y ?? pos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  };

  const stopDraw = () => { setDrawing(false); lastPos.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  return (
    <Modal open onClose={onClose} title="Signature électronique" size="md" footer={
      <>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-ghost" onClick={clearCanvas}><Eraser size={15} /> Effacer</button>
        <button className="btn-primary" disabled={!hasSignature} onClick={() => { const canvas = canvasRef.current; if (canvas) onSigned(canvas.toDataURL('image/png')); }}>
          <Check size={15} /> Signer le document
        </button>
      </>
    }>
      <div className="space-y-4">
        <div className="rounded-lg bg-ink-50 p-3 text-sm dark:bg-ink-800/50">
          <span className="text-ink-500">Document : </span>
          <span className="font-semibold">{TYPE_LABELS[doc.type]} {doc.number}</span>
          <span className="ml-2 text-ink-400">— {doc.customer?.name || '—'}</span>
        </div>
        <div>
          <p className="mb-2 text-xs text-ink-500">Signez dans le cadre ci-dessous avec votre souris ou votre doigt</p>
          <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-ink-200 bg-white dark:border-ink-700 dark:bg-ink-900">
            <canvas
              ref={canvasRef}
              width={560}
              height={200}
              className="w-full cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!hasSignature && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-ink-300 dark:text-ink-600">Signez ici…</p>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-ink-400">
          En signant ce document, vous acceptez son contenu et confirmez son authenticité.
          Date : {new Date().toLocaleDateString('fr-FR')}
        </p>
      </div>
    </Modal>
  );
}
