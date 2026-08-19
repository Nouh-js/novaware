import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { Card, Badge, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/ui';
import { toast } from '../lib/toast';
import {
  Briefcase, Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Check,
} from 'lucide-react';
import type { Service } from '../lib/types';
import { SERVICE_CATEGORIES } from '../lib/types';

export function Services({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('services').select('*').order('name');
    setServices((data as Service[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return services.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
    });
  }, [services, search, categoryFilter]);

  const toggleActive = async (svc: Service) => {
    const { error } = await supabase.from('services').update({ active: !svc.active }).eq('id', svc.id);
    if (error) { toast('Erreur', 'error'); return; }
    toast(svc.active ? 'Service désactivé' : 'Service activé');
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('services').delete().eq('id', deleteId);
    if (error) { toast('Erreur lors de la suppression', 'error'); return; }
    toast('Service supprimé');
    setDeleteId(null);
    load();
  };

  const categories = ['all', ...SERVICE_CATEGORIES];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-ink-500">Gérez et vendez des services séparément des produits physiques</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditService(null); setShowForm(true); }}>
          <Plus size={16} /> Nouveau service
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
            <Briefcase size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500">Total services</div>
            <div className="font-display text-xl font-bold">{services.length}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Check size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500">Actifs</div>
            <div className="font-display text-xl font-bold">{services.filter((s) => s.active).length}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
            <ToggleLeft size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500">Inactifs</div>
            <div className="font-display text-xl font-bold">{services.filter((s) => !s.active).length}</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Briefcase size={20} />
          </div>
          <div>
            <div className="text-xs text-ink-500">Catégories</div>
            <div className="font-display text-xl font-bold">{new Set(services.map((s) => s.category)).size}</div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              categoryFilter === c ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'
            }`}
          >
            {c === 'all' ? 'Toutes' : c}
          </button>
        ))}
      </div>

      <Card padding={false}>
        <div className="flex items-center gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un service…" className="input pl-9" />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={24} />}
            title="Aucun service"
            description="Ajoutez votre premier service pour commencer."
            action={<button className="btn-primary" onClick={() => { setEditService(null); setShowForm(true); }}><Plus size={16} /> Nouveau service</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Catégorie</th>
                  <th className="px-4 py-3 text-right font-medium">Prix</th>
                  <th className="px-4 py-3 text-center font-medium">TVA</th>
                  <th className="px-4 py-3 text-center font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                          <Briefcase size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-ink-800 dark:text-ink-100">{s.name}</div>
                          {s.description && <div className="truncate text-xs text-ink-400">{s.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone="neutral">{s.category}</Badge></td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(s.price, sym)}</td>
                    <td className="px-4 py-3 text-center">
                      {s.tax_enabled ? (
                        <span className="text-xs font-medium text-ink-600 dark:text-ink-300">{s.tax_rate}%</span>
                      ) : (
                        <span className="text-xs text-ink-400">Excl.</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(s)} className="inline-flex items-center gap-1 text-xs font-medium transition">
                        {s.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <ToggleRight size={14} /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                            <ToggleLeft size={14} /> Inactif
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setEditService(s); setShowForm(true); }}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-ink-800"
                          title="Modifier"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <ServiceForm
          service={editService}
          onClose={() => { setShowForm(false); setEditService(null); }}
          onSaved={() => { setShowForm(false); setEditService(null); load(); }}
          sym={sym}
        />
      )}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le service"
        message="Cette action est irréversible. Le service sera définitivement supprimé."
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}

function ServiceForm({ service, onClose, onSaved, sym }: { service: Service | null; onClose: () => void; onSaved: () => void; sym: string }) {
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price || 0);
  const [category, setCategory] = useState(service?.category || 'Autre');
  const [active, setActive] = useState(service?.active ?? true);
  const [taxEnabled, setTaxEnabled] = useState(service?.tax_enabled ?? true);
  const [taxRate, setTaxRate] = useState(service?.tax_rate ?? 20);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast('Nom du service requis', 'error'); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price,
      category,
      active,
      tax_enabled: taxEnabled,
      tax_rate: taxEnabled ? taxRate : 0,
    };
    if (service) {
      const { error } = await supabase.from('services').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', service.id);
      setSaving(false);
      if (error) { toast('Erreur lors de la modification', 'error'); return; }
      toast('Service modifié');
    } else {
      const { error } = await supabase.from('services').insert(payload);
      setSaving(false);
      if (error) { toast('Erreur lors de la création', 'error'); return; }
      toast('Service créé');
    }
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={service ? 'Modifier le service' : 'Nouveau service'}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Annuler</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Check size={15} />} {service ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Nom du service *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Photocopie" autoFocus />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description du service…" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Prix de vente ({sym})</label>
            <input type="number" step="0.01" min="0" className="input" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="rounded-lg border border-ink-100 p-3 dark:border-ink-800">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Statut</span>
            <button
              onClick={() => setActive((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-900'
              }`}
            >
              {active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              {active ? 'Actif' : 'Inactif'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">TVA applicable</span>
            <button
              onClick={() => setTaxEnabled((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                taxEnabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-900'
              }`}
            >
              {taxEnabled ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              {taxEnabled ? 'Avec TVA' : 'Sans TVA'}
            </button>
          </div>
          {taxEnabled && (
            <div className="mt-3">
              <label className="label">Taux de TVA (%)</label>
              <input type="number" step="0.01" min="0" max="100" className="input" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
