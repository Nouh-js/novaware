import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatDate, initials } from '../lib/format';
import { Card, Badge, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import {
  Users, Plus, Search, Pencil, Trash2, Mail, Phone, MapPin, CreditCard, Star, FileText,
} from 'lucide-react';
import type { Customer, SalesDocument } from '../lib/types';

export function Customers({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Customer | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').is('archived_at', null).order('name');
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q));
  }, [customers, search]);

  const handleSave = async (data: Partial<Customer>, id?: string) => {
    if (id) {
      const { error } = await supabase.from('customers').update(data).eq('id', id);
      if (error) { toast('Erreur lors de la modification', 'error'); return; }
      toast('Client modifié');
    } else {
      const { error } = await supabase.from('customers').insert(data);
      if (error) { toast('Erreur lors de la création', 'error'); return; }
      toast('Client créé');
    }
    setShowForm(false); setEditing(null); load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('customers').update({ archived_at: new Date().toISOString() }).eq('id', deleteId);
    if (error) { toast('Erreur de suppression', 'error'); return; }
    toast('Client archivé'); setDeleteId(null); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-ink-500">{customers.length} clients · {formatMoney(customers.reduce((s, c) => s + c.balance, 0), sym)} d'encours</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Nouveau client</button>
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client…" className="input pl-9" />
          </div>
          <Badge tone="neutral">{filtered.length}</Badge>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users size={24} />} title="Aucun client" action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Ajouter</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Conditions</th>
                  <th className="px-4 py-3 text-right font-medium">Solde</th>
                  <th className="px-4 py-3 text-right font-medium">Plafond</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="table-row-hover cursor-pointer border-b border-ink-50 dark:border-ink-800/50" onClick={() => setDetail(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">{initials(c.name)}</div>
                        <div>
                          <div className="font-medium text-ink-800 dark:text-ink-100">{c.name}</div>
                          <div className="text-xs text-ink-400">{c.city || '—'} · {c.type === 'entreprise' ? 'Entreprise' : 'Particulier'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-ink-500">{c.email || '—'}</div>
                      <div className="text-xs text-ink-400">{c.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3"><Badge tone="neutral">{c.payment_terms}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <span className={c.balance > 0 ? 'font-medium text-red-600' : 'text-ink-500'}>{formatMoney(c.balance, sym)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-500">{c.credit_limit > 0 ? formatMoney(c.credit_limit, sym) : '—'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(c); setShowForm(true); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800"><Pencil size={15} /></button>
                        <button onClick={() => setDeleteId(c.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && <CustomerForm customer={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} />}
      {detail && <CustomerDetail customer={detail} onClose={() => setDetail(null)} sym={sym} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Archiver le client" message="Le client sera déplacé dans les archives. Vous pourrez le restaurer depuis la page Archives." confirmLabel="Archiver" danger />
    </div>
  );
}

function CustomerForm({ customer, onClose, onSave }: { customer: Customer | null; onClose: () => void; onSave: (d: Partial<Customer>, id?: string) => void }) {
  const [form, setForm] = useState<Partial<Customer>>(customer || { type: 'particulier', country: 'Maroc', payment_terms: '30 jours', credit_limit: 0, loyalty_points: 0, balance: 0 });
  const set = (k: keyof Customer, v: any) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open onClose={onClose} title={customer ? 'Modifier le client' : 'Nouveau client'} size="lg" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={() => { if (!form.name) { toast('Nom requis', 'error'); return; } onSave(form, customer?.id); }}>{customer ? 'Enregistrer' : 'Créer'}</button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nom / Raison sociale *</label>
          <input className="input" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.type || 'particulier'} onChange={(e) => set('type', e.target.value)}>
            <option value="particulier">Particulier</option>
            <option value="entreprise">Entreprise</option>
          </select>
        </div>
        <div>
          <label className="label">N° fiscal (ICE)</label>
          <input className="input" value={form.tax_id || ''} onChange={(e) => set('tax_id', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input className="input" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Ville</label>
          <input className="input" value={form.city || ''} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div>
          <label className="label">Pays</label>
          <input className="input" value={form.country || ''} onChange={(e) => set('country', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Adresse</label>
          <input className="input" value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div>
          <label className="label">Conditions de paiement</label>
          <select className="input" value={form.payment_terms || '30 jours'} onChange={(e) => set('payment_terms', e.target.value)}>
            <option>Comptant</option><option>15 jours</option><option>30 jours</option><option>60 jours</option>
          </select>
        </div>
        <div>
          <label className="label">Plafond de crédit</label>
          <input type="number" step="0.01" className="input" value={form.credit_limit ?? 0} onChange={(e) => set('credit_limit', parseFloat(e.target.value) || 0)} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input min-h-[60px]" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function CustomerDetail({ customer, onClose, sym }: { customer: Customer; onClose: () => void; sym: string }) {
  const [docs, setDocs] = useState<SalesDocument[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('sales_documents').select('*').eq('customer_id', customer.id).order('date', { ascending: false });
      setDocs((data as SalesDocument[]) || []);
      setLoading(false);
    })();
  }, [customer.id]);
  const totalSpent = docs.filter((d) => d.type === 'invoice').reduce((s, d) => s + d.total, 0);
  return (
    <Modal open onClose={onClose} title={customer.name} size="xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-1">
          <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold">{initials(customer.name)}</div>
              <div>
                <div className="font-display font-semibold">{customer.name}</div>
                <div className="text-xs text-white/80">{customer.type === 'entreprise' ? 'Entreprise' : 'Particulier'}</div>
              </div>
            </div>
          </div>
          <div className="card space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm"><Mail size={14} className="text-ink-400" /> {customer.email || '—'}</div>
            <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-ink-400" /> {customer.phone || '—'}</div>
            <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-ink-400" /> {customer.address || '—'}, {customer.city || '—'}</div>
            <div className="flex items-center gap-2 text-sm"><CreditCard size={14} className="text-ink-400" /> {customer.payment_terms}</div>
            <div className="flex items-center gap-2 text-sm"><Star size={14} className="text-ink-400" /> {customer.loyalty_points} points fidélité</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-3"><div className="text-xs text-ink-500">Solde dû</div><div className="font-display text-lg font-bold text-red-600">{formatMoney(customer.balance, sym)}</div></div>
            <div className="card p-3"><div className="text-xs text-ink-500">Plafond</div><div className="font-display text-lg font-bold">{formatMoney(customer.credit_limit, sym)}</div></div>
            <div className="card p-3"><div className="text-xs text-ink-500">Total facturé</div><div className="font-display text-lg font-bold">{formatMoney(totalSpent, sym)}</div></div>
            <div className="card p-3"><div className="text-xs text-ink-500">Documents</div><div className="font-display text-lg font-bold">{docs.length}</div></div>
          </div>
        </div>
        <div className="lg:col-span-2">
          <h4 className="mb-2 font-display text-sm font-semibold">Historique des documents</h4>
          {loading ? <div className="flex justify-center py-8"><Spinner className="h-5 w-5 text-brand-600" /></div> : docs.length === 0 ? (
            <EmptyState icon={<FileText size={20} />} title="Aucun document" />
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60"><FileText size={14} /></div>
                    <div>
                      <div className="text-sm font-medium">{d.number}</div>
                      <div className="text-xs text-ink-400">{formatDate(d.date)} · {d.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatMoney(d.total, sym)}</div>
                    <div className="text-xs text-ink-400">{d.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
