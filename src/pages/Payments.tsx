import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatDate } from '../lib/format';
import { Card, Badge, Spinner, EmptyState } from '../components/ui';
import { CreditCard, ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import type { Payment } from '../lib/types';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', card: 'Carte', check: 'Chèque', transfer: 'Virement', mobile_money: 'Mobile Money',
};

export function Payments({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('payments').select('*').order('date', { ascending: false });
      setPayments((data as Payment[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => payments.filter((p) => filter === 'all' || p.direction === filter), [payments, filter]);
  const inbound = payments.filter((p) => p.direction === 'inbound').reduce((s, p) => s + p.amount, 0);
  const outbound = payments.filter((p) => p.direction === 'outbound').reduce((s, p) => s + p.amount, 0);
  const net = inbound - outbound;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Paiements</h1>
        <p className="mt-1 text-sm text-ink-500">Encaissements, décaissements et rapprochement</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50"><ArrowUpRight size={20} /></div><div><div className="text-xs text-ink-500">Encaissements</div><div className="font-display text-xl font-bold text-emerald-600">{formatMoney(inbound, sym)}</div></div></Card>
        <Card className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50"><ArrowDownRight size={20} /></div><div><div className="text-xs text-ink-500">Décaissements</div><div className="font-display text-xl font-bold text-red-600">{formatMoney(outbound, sym)}</div></div></Card>
        <Card className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60"><Wallet size={20} /></div><div><div className="text-xs text-ink-500">Solde net</div><div className="font-display text-xl font-bold">{formatMoney(net, sym)}</div></div></Card>
      </div>

      <div className="flex gap-2">
        {(['all', 'inbound', 'outbound'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filter === f ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'}`}>
            {f === 'all' ? 'Tous' : f === 'inbound' ? 'Encaissements' : 'Décaissements'}
          </button>
        ))}
      </div>

      <Card padding={false}>
        {loading ? <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-600" /></div> : filtered.length === 0 ? (
          <EmptyState icon={<CreditCard size={24} />} title="Aucun paiement" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800">
                <th className="px-4 py-3 font-medium">Numéro</th><th className="px-4 py-3 font-medium">Sens</th><th className="px-4 py-3 font-medium">Mode</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Référence</th><th className="px-4 py-3 text-right font-medium">Montant</th>
              </tr></thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="table-row-hover border-b border-ink-50 dark:border-ink-800/50">
                    <td className="px-4 py-3 font-mono text-xs">{p.number}</td>
                    <td className="px-4 py-3">{p.direction === 'inbound' ? <Badge tone="success"><ArrowUpRight size={12} /> Entrant</Badge> : <Badge tone="danger"><ArrowDownRight size={12} /> Sortant</Badge>}</td>
                    <td className="px-4 py-3"><Badge tone="neutral">{METHOD_LABELS[p.method] || p.method}</Badge></td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(p.date)}</td>
                    <td className="px-4 py-3 text-ink-500">{p.reference || '—'}</td>
                    <td className={`px-4 py-3 text-right font-medium ${p.direction === 'inbound' ? 'text-emerald-600' : 'text-red-600'}`}>{p.direction === 'inbound' ? '+' : '-'}{formatMoney(p.amount, sym)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
