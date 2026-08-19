import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, formatNumber } from '../lib/format';
import { Card } from '../components/ui';
import {
  Sparkles, Send, Bot, User, Lightbulb, TrendingUp, Package, Users, Receipt, AlertTriangle,
} from 'lucide-react';
import type { Product, Customer, SalesDocument, SalesLine } from '../lib/types';

type Msg = { role: 'user' | 'assistant'; content: string; actions?: { label: string; icon: any }[] };

export function AIAssistant({ settings, onNavigate }: { settings: any; onNavigate: (id: string) => void }) {
  const sym = settings?.currency_symbol || 'DH';
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Je suis votre assistant IA. Je peux vous aider a analyser vos ventes, retrouver un produit ou un client, creer un devis, suggerer des reapprovisionnements et plus encore. Posez-moi une question ou choisissez une suggestion ci-dessous.",
      actions: [
        { label: 'Analyser mes ventes', icon: TrendingUp },
        { label: 'Produits a reapprovisionner', icon: Package },
        { label: 'Top clients', icon: Users },
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<SalesDocument[]>([]);
  const [salesLines, setSalesLines] = useState<SalesLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [p, c, i, lines] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('sales_documents').select('*, customer:customers(*)'),
        supabase.from('sales_lines').select('*, product:products(*)'),
      ]);
      setProducts((p.data as Product[]) || []);
      setCustomers((c.data as Customer[]) || []);
      setInvoices((i.data as SalesDocument[]) || []);
      setSalesLines((lines.data as SalesLine[]) || []);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const respond = async (query: string) => {
    setThinking(true);
    await new Promise((r) => setTimeout(r, 700));
    const q = query.toLowerCase();
    let answer = '';

    if (q.includes('vente') || q.includes('chiffre') || q.includes('analy')) {
      const total = invoices.filter((i) => i.type === 'invoice').reduce((s, i) => s + i.total, 0);
      const paid = invoices.filter((i) => i.type === 'invoice').reduce((s, i) => s + i.paid_amount, 0);
      const overdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.total, 0);
      answer = `Analyse des ventes :\n- Chiffre d'affaires total : ${formatMoney(total, sym)}\n- Encaisse : ${formatMoney(paid, sym)} (${Math.round((paid / (total || 1)) * 100)}%)\n- Factures impayees : ${formatMoney(total - paid, sym)}\n- Factures en retard : ${formatMoney(overdue, sym)}\n\nRecommandation : relancez les clients avec des factures en retard pour ameliorer votre tresorerie.`;
    } else if (q.includes('reappro') || q.includes('stock') || q.includes('faible')) {
      const low = products.filter((p) => p.stock_qty <= p.min_stock);
      answer = low.length === 0 ? 'Tous vos stocks sont au-dessus du minimum. Aucun reapprovisionnement necessaire.' : `${low.length} produit(s) a reapprovisionner :\n${low.map((p) => `- ${p.name} - ${formatNumber(p.stock_qty)} en stock (min: ${formatNumber(p.min_stock)})`).join('\n')}\n\nSuggestion : passez une commande fournisseur pour ces produits des maintenant.`;
    } else if (q.includes('client') || q.includes('top')) {
      const top = customers.slice(0, 5).map((c, i) => `${i + 1}. ${c.name} - ${formatMoney(c.balance, sym)} de solde, ${c.loyalty_points} pts`);
      answer = `Top clients par activite :\n${top.join('\n')}`;
    } else if (q.includes('produit') || q.includes('trouv')) {
      answer = `Vous avez ${products.length} produits. Les plus vendus :\n${products.slice(0, 5).map((p) => `- ${p.name} (${p.sku}) - ${formatMoney(p.sale_price, sym)}`).join('\n')}`;
    } else if (q.includes('devis') || q.includes('facture')) {
      answer = `Pour creer un ${q.includes('devis') ? 'devis' : 'facture'}, rendez-vous dans le module Ventes et cliquez sur "Nouveau document". Je peux pre-remplir les informations si vous me donnez le nom du client et les produits.`;
    } else if (q.includes('marge')) {
      const invoiceIds = new Set(invoices.filter((i) => i.type === 'invoice').map((i) => i.id));
      const invoiceLines = salesLines.filter((l) => invoiceIds.has(l.document_id));
      const revenue = invoiceLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
      const cost = invoiceLines.reduce((s, l) => s + (l.product?.cost_price ?? 0) * l.qty, 0);
      const margin = revenue - cost;
      const rate = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
      answer = `Marge brute HT : ${formatMoney(margin, sym)} (taux ${rate}%).\n- Chiffre d'affaires HT : ${formatMoney(revenue, sym)}\n- Cout des marchandises HT : ${formatMoney(cost, sym)}\nPour ameliorer la marge, negociez vos couts d'achat ou ajustez vos prix de vente.`;
    } else if (q.includes('bonjour') || q.includes('salut')) {
      answer = 'Bonjour ! Comment puis-je vous aider aujourd\'hui ? Vous pouvez me demander d\'analyser vos ventes, trouver un produit ou un client, ou suggerer des reapprovisionnements.';
    } else {
      answer = `Je peux vous aider avec :\n- L'analyse des ventes et de la marge\n- La recherche de produits et clients\n- Les suggestions de reapprovisionnement\n- La creation de devis et factures\n\nPosez-moi une question plus precise ou choisissez une suggestion.`;
    }

    setThinking(false);
    setMessages((m) => [...m, { role: 'assistant', content: answer }]);
  };

  const send = (text?: string) => {
    const content = (text || input).trim();
    if (!content) return;
    setMessages((m) => [...m, { role: 'user', content }]);
    setInput('');
    respond(content);
  };

  const suggestions = [
    { label: 'Analyser mes ventes', icon: TrendingUp },
    { label: 'Produits a reapprovisionner', icon: Package },
    { label: 'Top clients', icon: Users },
    { label: 'Calculer ma marge', icon: Receipt },
  ];

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 flex flex-col">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Sparkles size={20} /></div>
          <div><h1 className="font-display text-xl font-bold tracking-tight">Assistant IA</h1><p className="text-xs text-ink-500">Analyse, recommandations et actions</p></div>
        </div>

        <Card padding={false} className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.role === 'user' ? 'bg-ink-100 text-ink-600 dark:bg-ink-800' : 'bg-gradient-to-br from-brand-500 to-violet-600 text-white'}`}>
                  {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-100'}`}>
                  <p className="whitespace-pre-line">{m.content}</p>
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 text-white"><Bot size={15} /></div>
                <div className="flex items-center gap-1 rounded-2xl bg-ink-100 px-4 py-3 dark:bg-ink-800">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-ink-100 p-3 dark:border-ink-800">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s.label} onClick={() => send(s.label)} className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-brand-950/60">
                  <s.icon size={12} /> {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Posez votre question..."
                className="input"
              />
              <button onClick={() => send()} className="btn-primary" disabled={!input.trim()}><Send size={16} /></button>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <div className="mb-3 flex items-center gap-2"><Lightbulb size={18} className="text-amber-500" /><h3 className="font-display font-semibold">Actions intelligentes</h3></div>
          <div className="space-y-2">
            <ActionCard icon={TrendingUp} title="Analyser les ventes" desc="Vue d'ensemble du CA" onClick={() => send('Analyser mes ventes')} />
            <ActionCard icon={Package} title="Reapprovisionnement" desc="Produits en stock faible" onClick={() => send('Produits a reapprovisionner')} />
            <ActionCard icon={Users} title="Top clients" desc="Classement par CA" onClick={() => send('Top clients')} />
            <ActionCard icon={AlertTriangle} title="Factures en retard" desc="Relances a envoyer" onClick={() => send('Factures en retard')} />
          </div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2"><Sparkles size={18} className="text-brand-500" /><h3 className="font-display font-semibold">Insights</h3></div>
          <div className="space-y-2 text-sm">
            <Insight label="Produit le plus rentable" value={products.sort((a, b) => (b.sale_price - b.cost_price) - (a.sale_price - a.cost_price))[0]?.name || '-'} />
            <Insight label="Client a relancer" value={customers.find((c) => c.balance > 0)?.name || 'Aucun'} />
            <Insight label="Valeur du stock" value={formatMoney(products.reduce((s, p) => s + p.stock_qty * p.cost_price, 0), sym)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, desc, onClick }: { icon: any; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg border border-ink-100 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-brand-950/30">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60"><Icon size={15} /></div>
      <div><div className="text-sm font-medium">{title}</div><div className="text-xs text-ink-500">{desc}</div></div>
    </button>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-ink-500">{label}</span><span className="font-medium">{value}</span></div>;
}
