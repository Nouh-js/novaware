import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatDate, initials } from '../lib/format';
import { Card, Badge, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import { Truck, Plus, Search, Pencil, Trash2, Mail, Phone, MapPin, FileText } from 'lucide-react';
import type { Supplier, PurchaseDocument } from '../lib/types';

export function Suppliers({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Supplier | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('suppliers').select('*').is('archived_at', null).order('name');
    setSuppliers((data as Supplier[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return suppliers.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
  }, [suppliers, search]);

  const handleSave = async (data: Partial<Supplier>, id?: string) => {
    if (id) {
      const { error } = await supabase.from('suppliers').update(data).eq('id', id);
      if (error) { toast('Erreur', 'error'); return; }
      toast('Fournisseur modifié');
    } else {
      const { error } = await supabase.from('suppliers').insert(data);
      if (error) { toast('Erreur', 'error'); return; }
      toast('Fournisseur créé');
    }
    setShowForm(false); setEditing(null); load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('suppliers').update({ archived_at: new Date().toISOString() }).eq('id', deleteId);
    if (error) { toast('Erreur', 'error'); return; }
    toast('Fournisseur archivé'); setDeleteId(null); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Fournisseurs</h1>
          <p className="mt-1 text-sm text-ink-500">{suppliers.length} fournisseurs · {formatMoney(suppliers.reduce((s, x) => s + x.balance, 0), sym)} à payer</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={16} /> Nouveau fournisseur</button>
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
          </div>
          <Badge tone="neutral">{filtered.length}</Badge>
        </div>
        {loading ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div> : filtered.length === 0 ? (
          <EmptyState icon={<Truck size={24} />} title="Aucun fournisseur" action={<button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Ajouter</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Pays</th>
                  <th className="px-4 py-3 text-right font-medium">Solde</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="table-row-hover cursor-pointer border-b border-ink-50 dark:border-ink-800/50" onClick={() => setDetail(s)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-xs font-bold text-white">{initials(s.name)}</div>
                        <div>
                          <div className="font-medium text-ink-800 dark:text-ink-100">{s.name}</div>
                          <div className="text-xs text-ink-400">{s.contact_person || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="text-xs text-ink-500">{s.email || '—'}</div><div className="text-xs text-ink-400">{s.phone || '—'}</div></td>
                    <td className="px-4 py-3 text-ink-500">{s.country}</td>
                    <td className="px-4 py-3 text-right"><span className={s.balance > 0 ? 'font-medium text-red-600' : 'text-ink-500'}>{formatMoney(s.balance, sym)}</span></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditing(s); setShowForm(true); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800"><Pencil size={15} /></button>
                        <button onClick={() => setDeleteId(s.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && <SupplierForm supplier={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSave={handleSave} />}
      {detail && <SupplierDetail supplier={detail} onClose={() => setDetail(null)} sym={sym} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Archiver le fournisseur" message="Le fournisseur sera déplacé dans les archives. Vous pourrez le restaurer depuis la page Archives." confirmLabel="Archiver" danger />
    </div>
  );
}

function SupplierForm({ supplier, onClose, onSave }: { supplier: Supplier | null; onClose: () => void; onSave: (d: Partial<Supplier>, id?: string) => void }) {
  const [form, setForm] = useState<Partial<Supplier>>(supplier || { country: 'Maroc', balance: 0 });
  const set = (k: keyof Supplier, v: any) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open onClose={onClose} title={supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} size="lg" footer={<><button className="btn-secondary" onClick={onClose}>Annuler</button><button className="btn-primary" onClick={() => { if (!form.name) { toast('Nom requis', 'error'); return; } onSave(form, supplier?.id); }}>{supplier ? 'Enregistrer' : 'Créer'}</button></>}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="label">Nom *</label><input className="input" value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className="label">Personne à contacter</label><input className="input" value={form.contact_person || ''} onChange={(e) => set('contact_person', e.target.value)} /></div>
        <div><label className="label">N° fiscal</label><input className="input" value={form.tax_id || ''} onChange={(e) => set('tax_id', e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></div>
        <div><label className="label">Téléphone</label><input className="input" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><label className="label">Ville</label><input className="input" value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
        <div><label className="label">Pays</label><input className="input" value={form.country || ''} onChange={(e) => set('country', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Adresse</label><input className="input" value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Notes</label><textarea className="input min-h-[60px]" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
      </div>
    </Modal>
  );
}

function SupplierDetail({ supplier, onClose, sym }: { supplier: Supplier; onClose: () => void; sym: string }) {
  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('purchase_documents').select('*').eq('supplier_id', supplier.id).order('date', { ascending: false });
      setDocs((data as PurchaseDocument[]) || []);
      setLoading(false);
    })();
  }, [supplier.id]);
  return (
    <Modal open onClose={onClose} title={supplier.name} size="xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-lg font-bold">{initials(supplier.name)}</div>
              <div><div className="font-display font-semibold">{supplier.name}</div><div className="text-xs text-white/80">{supplier.country}</div></div>
            </div>
          </div>
          <div className="card space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm"><Mail size={14} className="text-ink-400" /> {supplier.email || '—'}</div>
            <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-ink-400" /> {supplier.phone || '—'}</div>
            <div className="flex items-center gap-2 text-sm"><MapPin size={14} className="text-ink-400" /> {supplier.address || '—'}, {supplier.city || '—'}</div>
          </div>
          <div className="card p-3"><div className="text-xs text-ink-500">Solde à payer</div><div className="font-display text-lg font-bold text-red-600">{formatMoney(supplier.balance, sym)}</div></div>
        </div>
        <div className="lg:col-span-2">
          <h4 className="mb-2 font-display text-sm font-semibold">Commandes & factures</h4>
          {loading ? <div className="flex justify-center py-8"><Spinner className="h-5 w-5 text-brand-600" /></div> : docs.length === 0 ? <EmptyState icon={<FileText size={20} />} title="Aucun document" /> : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40"><FileText size={14} /></div>
                    <div><div className="text-sm font-medium">{d.number}</div><div className="text-xs text-ink-400">{formatDate(d.date)} · {d.type}</div></div>
                  </div>
                  <div className="text-right"><div className="font-medium">{formatMoney(d.total, sym)}</div><div className="text-xs text-ink-400">{d.status}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
