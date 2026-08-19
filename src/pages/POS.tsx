import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney, numberToWords } from '../lib/format';
import { Card, Badge, Modal, Spinner } from '../components/ui';
import { toast } from '../lib/toast';
import { Search, Plus, Minus, ShoppingCart, CreditCard, Receipt, X, Store, ScanLine, Printer, ToggleLeft, ToggleRight, Tag, Percent } from 'lucide-react';
import type { Product, Category, Customer, DiscountType } from '../lib/types';
import { PRODUCT_CATEGORIES, finalPrice } from '../lib/types';
import { openPrintWindow } from '../lib/document';

type CartItem = {
  product: Product;
  qty: number;
  discountType: DiscountType;
  discountValue: number;
};

function cartItemPrice(item: CartItem): number {
  const base = item.product.sale_price;
  if (item.discountType === 'percent') return Math.max(0, base * (1 - item.discountValue / 100));
  if (item.discountType === 'fixed') return Math.max(0, base - item.discountValue);
  return base;
}

function cartLineTotal(item: CartItem): number {
  return cartItemPrice(item) * item.qty;
}

function itemDiscountAmount(item: CartItem): number {
  return (item.product.sale_price - cartItemPrice(item)) * item.qty;
}

export function POS({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [applyTax, setApplyTax] = useState(true);
  const defaultTaxRate = settings?.default_tax_rate ?? 20;
  const [globalDiscountType, setGlobalDiscountType] = useState<DiscountType>('none');
  const [globalDiscountValue, setGlobalDiscountValue] = useState(0);

  useEffect(() => {
    (async () => {
      const [p, c, cats] = await Promise.all([
        supabase.from('products').select('*, category:categories(*)').eq('active', true).order('name'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
      ]);
      setProducts((p.data as Product[]) || []);
      setCustomers((c.data as Customer[]) || []);
      setCategories((cats.data as Category[])
        .filter((c) => (PRODUCT_CATEGORIES as readonly string[]).includes(c.name))
        .sort((a, b) => (PRODUCT_CATEGORIES as readonly string[]).indexOf(a.name) - (PRODUCT_CATEGORIES as readonly string[]).indexOf(b.name)) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter((p) => {
      if (category !== 'all' && p.category_id !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').includes(q);
    });
  }, [products, search, category]);

  const addToCart = (product: Product) => {
    if (product.stock_qty <= 0) { toast('Produit en rupture', 'error'); return; }
    setCart((c) => {
      const existing = c.find((i) => i.product.id === product.id);
      if (existing) return c.map((i) => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { product, qty: 1, discountType: product.discount_type || 'none', discountValue: product.discount_value || 0 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((c) => c.map((i) => i.product.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  };
  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.product.id !== id));

  const updateItemDiscount = (id: string, discountType: DiscountType, discountValue: number) => {
    setCart((c) => c.map((i) => i.product.id === id ? { ...i, discountType, discountValue } : i));
  };

  const applyGlobalDiscount = () => {
    if (globalDiscountType === 'none' || globalDiscountValue <= 0) {
      setCart((c) => c.map((i) => ({ ...i, discountType: 'none', discountValue: 0 })));
      return;
    }
    setCart((c) => c.map((i) => ({ ...i, discountType: globalDiscountType, discountValue: globalDiscountValue })));
  };

  const grossSubtotal = cart.reduce((s, i) => s + i.product.sale_price * i.qty, 0);
  const discountTotal = cart.reduce((s, i) => s + itemDiscountAmount(i), 0);
  const subtotal = cart.reduce((s, i) => s + cartLineTotal(i), 0);
  const tax = applyTax ? cart.reduce((s, i) => s + cartLineTotal(i) * ((i.product.tax_rate || defaultTaxRate) / 100), 0) : 0;
  const total = subtotal + tax;

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const checkout = async (method: string, paid: number) => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    try {
      const invPrefix = settings?.invoice_prefix || 'FAC';
      const year = new Date().getFullYear();
      const { data: existingInv } = await supabase.from('sales_documents').select('number').like('number', `${invPrefix}-${year}-%`);
      const invNum = `${invPrefix}-${year}-${String((existingInv?.length || 0) + 1).padStart(4, '0')}`;
      const { data: doc, error } = await supabase.from('sales_documents').insert({
        number: invNum, type: 'invoice', status: 'paid', customer_id: customerId || null,
        date: new Date().toISOString().slice(0, 10),
        subtotal, tax_amount: tax, discount_amount: discountTotal, total, paid_amount: paid, notes: 'Vente POS',
      }).select().single();
      if (error || !doc) { toast(error?.message || 'Erreur lors de la création de la facture', 'error'); return; }

      await supabase.from('sales_lines').insert(
        cart.map((i) => ({
          document_id: doc.id, product_id: i.product.id, description: i.product.name,
          qty: i.qty, unit_price: i.product.sale_price, discount: itemDiscountAmount(i),
          tax_rate: applyTax ? (i.product.tax_rate || defaultTaxRate) : 0,
          line_total: cartLineTotal(i),
        }))
      );

      // Create BL
      const blPrefix = settings?.delivery_prefix || 'BL';
      const { data: existingBl } = await supabase.from('sales_documents').select('number').like('number', `${blPrefix}-${year}-%`);
      const blNum = `${blPrefix}-${year}-${String((existingBl?.length || 0) + 1).padStart(4, '0')}`;
      const { data: blDoc } = await supabase.from('sales_documents').insert({
        number: blNum, type: 'delivery', status: 'validated', customer_id: customerId || null,
        date: new Date().toISOString().slice(0, 10),
        subtotal, tax_amount: tax, total, paid_amount: total, parent_id: doc.id, notes: `BL Vente POS ${invNum}`,
      }).select().single();
      if (blDoc) {
        await supabase.from('sales_lines').insert(
          cart.map((i) => ({
            document_id: blDoc.id, product_id: i.product.id, description: i.product.name,
            qty: i.qty, unit_price: i.product.sale_price, discount: itemDiscountAmount(i),
            tax_rate: applyTax ? (i.product.tax_rate || defaultTaxRate) : 0,
            line_total: cartLineTotal(i),
          }))
        );
      }

      // Update stock
      for (const item of cart) {
        await supabase.from('products').update({ stock_qty: item.product.stock_qty - item.qty }).eq('id', item.product.id);
        await supabase.from('stock_movements').insert({ product_id: item.product.id, type: 'out', qty: -item.qty, unit_cost: item.product.cost_price, reason: `Vente POS ${invNum}`, reference: invNum });
      }

      // Payment record
      const regPrefix = settings?.payment_prefix || 'REG';
      const { data: regExisting } = await supabase.from('payments').select('number').like('number', `${regPrefix}-${year}-%`);
      const regNum = `${regPrefix}-${year}-${String((regExisting?.length || 0) + 1).padStart(4, '0')}`;
      await supabase.from('payments').insert({ number: regNum, direction: 'inbound', party_type: 'customer', party_id: customerId || null, document_id: doc.id, amount: paid, method, date: new Date().toISOString().slice(0, 10), reference: regNum });
      await supabase.from('activities').insert({ type: 'sale', title: `Vente POS ${invNum}`, description: `${formatMoney(total, sym)} - ${cart.length} articles`, icon: 'Store' });

      const customer = customers.find((c) => c.id === customerId);
      setReceipt({
        invoiceNumber: invNum,
        blNumber: blDoc?.number || blNum,
        date: new Date().toLocaleDateString('fr-FR'),
        items: cart.map((i) => ({
          name: i.product.name, qty: i.qty,
          unitPrice: i.product.sale_price,
          discount: itemDiscountAmount(i),
          discountedUnitPrice: cartItemPrice(i),
          total: cartLineTotal(i),
        })),
        grossSubtotal, discountTotal, subtotal, tax, total, paid, method,
        customerName: customer?.name || 'Comptant',
        applyTax, sym,
        companyName: settings?.company_name || '',
        companyAddress: settings?.company_address || '',
        companyPhone: settings?.company_phone || '',
      });
      toast(`Vente ${invNum} encaissée — BL ${blDoc?.number || blNum} créé`);
      setCart([]); setCustomerId(''); setShowCheckout(false);
    } catch (err: any) {
      toast(err?.message || 'Une erreur est survenue. Veuillez réessayer.', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner className="h-6 w-6 text-brand-600" /></div>;

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Products */}
      <div className="lg:col-span-2 flex flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">Point de Vente</h1>
            <Badge tone="brand"><Store size={12} /> Caisse ouverte</Badge>
          </div>
          <button
            onClick={() => setApplyTax((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${applyTax ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-ink-200 bg-white text-ink-500 dark:border-ink-700 dark:bg-ink-900'}`}
          >
            {applyTax ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            TVA {applyTax ? 'activée' : 'désactivée'}
          </button>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Scanner ou rechercher un produit…" className="input pl-9" autoFocus />
          </div>
          <button className="btn-secondary" onClick={() => toast('Scan caméra simulé', 'info')}><ScanLine size={16} /></button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setCategory('all')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${category === 'all' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'}`}>Toutes</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${category === c.id ? 'bg-brand-600 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-800'}`}>{c.name}</button>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const out = p.stock_qty <= 0;
            const low = p.stock_qty > 0 && p.stock_qty <= p.min_stock;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={out}
                className="group relative flex flex-col rounded-xl bg-white p-3 text-left shadow-soft ring-1 ring-ink-200 transition hover:shadow-pop hover:ring-brand-300 disabled:opacity-50 dark:bg-ink-900 dark:ring-ink-800"
              >
                <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-ink-100 to-ink-50 dark:from-ink-800 dark:to-ink-900">
                  <ShoppingCart size={28} className="text-ink-300 dark:text-ink-700" />
                </div>
                <div className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</div>
                <div className="mt-1 flex items-center justify-between">
                  {p.discount_type !== 'none' && p.discount_value > 0 ? (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-ink-400 line-through">{formatMoney(p.sale_price, sym)}</span>
                      <span className="font-display font-bold text-brand-600">{formatMoney(finalPrice(p), sym)}</span>
                    </div>
                  ) : (
                    <span className="font-display font-bold text-brand-600">{formatMoney(p.sale_price, sym)}</span>
                  )}
                  <span className={`text-xs ${out ? 'text-red-500' : low ? 'text-amber-500' : 'text-ink-400'}`}>{p.stock_qty}</span>
                </div>
                {out && <span className="absolute right-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">RUPTURE</span>}
                {p.discount_type !== 'none' && p.discount_value > 0 && (
                  <span className="absolute left-2 top-2 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {p.discount_type === 'percent' ? `-${p.discount_value}%` : `-${p.discount_value} ${sym}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart */}
      <Card padding={false} className="flex flex-col">
        <div className="border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display font-semibold">Panier</h3>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Vider</button>}
          </div>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Client comptant</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="overflow-y-auto p-3" style={{ maxHeight: '55vh' }}>
          {cart.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center text-center text-ink-400">
              <ShoppingCart size={32} className="mb-2" />
              <p className="text-sm">Panier vide</p>
              <p className="text-xs">Cliquez sur un produit pour l'ajouter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((i) => {
                const hasDiscount = i.discountType !== 'none' && i.discountValue > 0;
                return (
                <div key={i.product.id} className="rounded-lg border border-ink-100 p-2 dark:border-ink-800">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{i.product.name}</div>
                      <div className="text-xs text-ink-400">
                        {hasDiscount ? (
                          <span className="flex items-center gap-1">
                            <span className="line-through">{formatMoney(i.product.sale_price, sym)}</span>
                            <span className="text-emerald-600">{formatMoney(cartItemPrice(i), sym)}</span>
                          </span>
                        ) : (
                          formatMoney(i.product.sale_price, sym)
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(i.product.id, -1)} className="rounded-md bg-ink-100 p-1 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300"><Minus size={13} /></button>
                      <span className="w-8 text-center text-sm font-medium">{i.qty}</span>
                      <button onClick={() => updateQty(i.product.id, 1)} className="rounded-md bg-ink-100 p-1 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300"><Plus size={13} /></button>
                    </div>
                    <div className="w-16 text-right text-sm font-medium">{formatMoney(cartLineTotal(i), sym)}</div>
                    <button onClick={() => removeItem(i.product.id)} className="rounded-md p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"><X size={14} /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Tag size={11} className="shrink-0 text-ink-400" />
                    <select
                      value={i.discountType}
                      onChange={(e) => updateItemDiscount(i.product.id, e.target.value as DiscountType, i.discountValue)}
                      className="rounded border border-ink-200 bg-white px-1 py-0.5 text-[11px] text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
                    >
                      <option value="none">Sans remise</option>
                      <option value="percent">% Remise</option>
                      <option value="fixed">{sym} Remise</option>
                    </select>
                    {i.discountType !== 'none' && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={i.discountValue || ''}
                        onChange={(e) => updateItemDiscount(i.product.id, i.discountType, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-14 rounded border border-ink-200 bg-white px-1 py-0.5 text-[11px] text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
                      />
                    )}
                    {hasDiscount && (
                      <span className="ml-auto text-[10px] font-medium text-emerald-600">
                        -{formatMoney(itemDiscountAmount(i), sym)}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-ink-100 p-4 dark:border-ink-800">
          {cart.length > 0 && (
            <div className="mb-3 rounded-lg border border-ink-100 p-2 dark:border-ink-800">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Tag size={12} /> Remise globale sur tous les articles
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={globalDiscountType}
                  onChange={(e) => setGlobalDiscountType(e.target.value as DiscountType)}
                  className="rounded border border-ink-200 bg-white px-1.5 py-1 text-xs text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
                >
                  <option value="none">Aucune</option>
                  <option value="percent">Pourcentage (%)</option>
                  <option value="fixed">Montant fixe ({sym})</option>
                </select>
                {globalDiscountType !== 'none' && (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={globalDiscountValue || ''}
                    onChange={(e) => setGlobalDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 rounded border border-ink-200 bg-white px-1.5 py-1 text-xs text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
                  />
                )}
                <button
                  onClick={applyGlobalDiscount}
                  className="ml-auto rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Appliquer
                </button>
              </div>
            </div>
          )}
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between text-ink-500"><span>Sous-total brut HT</span><span>{formatMoney(grossSubtotal, sym)}</span></div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Remise</span><span>-{formatMoney(discountTotal, sym)}</span></div>
            )}
            <div className="flex justify-between text-ink-500"><span>Sous-total HT</span><span>{formatMoney(subtotal, sym)}</span></div>
            {applyTax && <div className="flex justify-between text-ink-500"><span>TVA ({defaultTaxRate}%)</span><span>{formatMoney(tax, sym)}</span></div>}
            <div className="flex justify-between border-t border-ink-100 pt-1.5 dark:border-ink-800">
              <span className="font-semibold">Total {applyTax ? 'TTC' : 'HT'}</span>
              <span className="font-display text-xl font-bold text-brand-600">{formatMoney(total, sym)}</span>
            </div>
          </div>
          <button onClick={() => setShowCheckout(true)} disabled={cart.length === 0} className="btn-primary w-full py-3 text-base"><CreditCard size={18} /> Encaisser</button>
        </div>
      </Card>

      {showCheckout && (
        <CheckoutModal total={total} onClose={() => setShowCheckout(false)} onPay={checkout} sym={sym} loading={checkoutLoading} />
      )}

      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}

type ReceiptData = {
  invoiceNumber: string;
  blNumber: string;
  date: string;
  items: { name: string; qty: number; unitPrice: number; discount: number; discountedUnitPrice: number; total: number }[];
  grossSubtotal: number;
  discountTotal: number;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  method: string;
  customerName: string;
  applyTax: boolean;
  sym: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
};

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', card: 'Carte bancaire', mobile_money: 'Mobile Money',
};

function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const change = receipt.paid - receipt.total;
  const currencyLabel = receipt.sym === 'DH' ? 'Dirhams' : receipt.sym === '€' ? 'Euros' : receipt.sym === '$' ? 'Dollars' : receipt.sym;
  const amountWords = numberToWords(receipt.total, currencyLabel);

  const buildReceiptHTML = () => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Reçu ${receipt.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;font-size:13px;color:#111827;background:#fff;max-width:360px;margin:0 auto;padding:24px 20px}
    .header{text-align:center;border-bottom:1px dashed #d1d5db;padding-bottom:16px;margin-bottom:16px}
    .company{font-size:16px;font-weight:700}
    .doc-num{font-size:11px;color:#6b7280;margin-top:4px;font-family:monospace}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{text-align:left;font-size:10px;text-transform:uppercase;color:#6b7280;padding:4px 0;border-bottom:1px solid #e5e7eb}
    th:last-child,td:last-child{text-align:right}
    td{padding:6px 0;font-size:12px;border-bottom:1px solid #f3f4f6}
    .totals{border-top:1px dashed #d1d5db;padding-top:10px}
    .total-row{display:flex;justify-content:space-between;font-size:12px;color:#6b7280;padding:2px 0}
    .total-final{display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#1d4ed8;padding:8px 0;border-top:2px solid #1d4ed8;margin-top:6px}
    .words{background:#f0f9ff;border-radius:6px;padding:8px 10px;font-size:10px;color:#0369a1;margin:10px 0;line-height:1.5}
    .footer{text-align:center;font-size:10px;color:#9ca3af;margin-top:16px;padding-top:12px;border-top:1px dashed #d1d5db}
    @media print{@page{margin:0}body{max-width:100%;padding:10mm}}
  </style>
</head>
<body>
  <div class="header">
    <div class="company">${receipt.companyName || 'Caisse'}</div>
    <div class="doc-num">Facture: ${receipt.invoiceNumber} · BL: ${receipt.blNumber}</div>
    <div style="font-size:11px;color:#6b7280;margin-top:3px">Date: ${receipt.date} · Client: ${receipt.customerName}</div>
  </div>
  <table>
    <thead><tr><th>Désignation</th><th>Qté</th><th>P.U.</th><th>Remise</th><th>Total</th></tr></thead>
    <tbody>
      ${receipt.items.map((i) => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${i.unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</td><td style="text-align:right;color:#059669">${i.discount > 0 ? '-' + i.discount.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' ' + receipt.sym : '-'}</td><td>${i.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</td></tr>`).join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Sous-total brut HT</span><span>${receipt.grossSubtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</span></div>
    ${receipt.discountTotal > 0 ? `<div class="total-row" style="color:#059669"><span>Remise</span><span>-${receipt.discountTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</span></div>` : ''}
    <div class="total-row"><span>Sous-total HT</span><span>${receipt.subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</span></div>
    ${receipt.applyTax ? `<div class="total-row"><span>TVA</span><span>${receipt.tax.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</span></div>` : ''}
    <div class="total-final"><span>Total ${receipt.applyTax ? 'TTC' : 'HT'}</span><span>${receipt.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</span></div>
  </div>
  <div class="words">${amountWords}</div>
  <div class="total-row" style="padding:4px 0"><span>Payé (${METHOD_LABELS[receipt.method] || receipt.method})</span><span>${receipt.paid.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</span></div>
  ${change > 0.001 ? `<div class="total-row" style="color:#059669;font-weight:600;padding:4px 0"><span>Rendu monnaie</span><span>${change.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${receipt.sym}</span></div>` : ''}
  <div class="footer">
    Merci pour votre achat !<br>
    ${receipt.companyName}
  </div>
</body>
</html>`;

  useEffect(() => {
    const t = setTimeout(() => openPrintWindow(buildReceiptHTML()), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal open onClose={onClose} title="Reçu de vente" size="md" footer={
      <div className="flex w-full justify-between">
        <button className="btn-ghost" onClick={() => openPrintWindow(buildReceiptHTML())}>
          <Printer size={15} /> Imprimer le reçu
        </button>
        <button className="btn-primary" onClick={onClose}>Fermer</button>
      </div>
    }>
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Receipt size={18} />
            <span className="font-semibold">Vente encaissée avec succès</span>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-emerald-600 dark:text-emerald-400">
            <span>Facture: <strong>{receipt.invoiceNumber}</strong></span>
            <span>BL: <strong>{receipt.blNumber}</strong></span>
          </div>
        </div>

        <div className="rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-800/50">
              <tr className="text-left text-xs uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2 font-medium">Désignation</th>
                <th className="px-3 py-2 text-center font-medium">Qté</th>
                <th className="px-3 py-2 text-right font-medium">P.U.</th>
                <th className="px-3 py-2 text-right font-medium">Remise</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, i) => (
                <tr key={i} className="border-t border-ink-50 dark:border-ink-800/50">
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 text-center">{item.qty}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(item.unitPrice, receipt.sym)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{item.discount > 0 ? `-${formatMoney(item.discount, receipt.sym)}` : '-'}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(item.total, receipt.sym)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-500"><span>Sous-total brut HT</span><span>{formatMoney(receipt.grossSubtotal, receipt.sym)}</span></div>
          {receipt.discountTotal > 0 && (
            <div className="flex justify-between text-emerald-600"><span>Remise</span><span>-{formatMoney(receipt.discountTotal, receipt.sym)}</span></div>
          )}
          <div className="flex justify-between text-ink-500"><span>Sous-total HT</span><span>{formatMoney(receipt.subtotal, receipt.sym)}</span></div>
          {receipt.applyTax && <div className="flex justify-between text-ink-500"><span>TVA</span><span>{formatMoney(receipt.tax, receipt.sym)}</span></div>}
          <div className="flex justify-between border-t border-ink-100 pt-2 dark:border-ink-800">
            <span className="font-semibold">Total {receipt.applyTax ? 'TTC' : 'HT'}</span>
            <span className="font-display text-xl font-bold text-brand-600">{formatMoney(receipt.total, receipt.sym)}</span>
          </div>
          <div className="flex justify-between text-emerald-600">
            <span>Payé ({METHOD_LABELS[receipt.method] || receipt.method})</span>
            <span className="font-medium">{formatMoney(receipt.paid, receipt.sym)}</span>
          </div>
          {receipt.paid - receipt.total > 0.001 && (
            <div className="flex justify-between font-semibold text-emerald-600">
              <span>Rendu monnaie</span>
              <span>{formatMoney(receipt.paid - receipt.total, receipt.sym)}</span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
          <strong>Montant en toutes lettres :</strong><br />
          {numberToWords(receipt.total, receipt.sym === 'DH' ? 'Dirhams' : receipt.sym)} TTC
        </div>
      </div>
    </Modal>
  );
}

function CheckoutModal({ total, onClose, onPay, sym, loading }: { total: number; onClose: () => void; onPay: (method: string, paid: number) => void; sym: string; loading?: boolean }) {
  const [method, setMethod] = useState('cash');
  const [paid, setPaid] = useState(total);
  const change = paid - total;
  const methods = [
    { id: 'cash', label: 'Espèces', icon: Receipt },
    { id: 'card', label: 'Carte', icon: CreditCard },
    { id: 'mobile_money', label: 'Mobile Money', icon: ScanLine },
  ];
  return (
    <Modal open onClose={onClose} title="Encaissement" size="md" footer={<><button className="btn-secondary" onClick={onClose} disabled={loading}>Annuler</button><button className="btn-primary" onClick={() => onPay(method, paid)} disabled={loading}>{loading ? <Spinner className="h-4 w-4" /> : <Receipt size={15} />} Valider la vente</button></>}>
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
          <div className="text-xs text-white/80">Total à payer</div>
          <div className="font-display text-3xl font-bold">{formatMoney(total, sym)}</div>
        </div>
        <div>
          <label className="label">Mode de paiement</label>
          <div className="grid grid-cols-3 gap-2">
            {methods.map((m) => (
              <button key={m.id} onClick={() => setMethod(m.id)} className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-sm font-medium transition ${method === m.id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300' : 'border-ink-200 text-ink-500 dark:border-ink-700'}`}>
                <m.icon size={18} /> {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Montant reçu</label>
          <input type="number" step="0.01" className="input text-lg font-medium" value={paid} onChange={(e) => setPaid(parseFloat(e.target.value) || 0)} />
        </div>
        {change > 0 && method === 'cash' && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
            <span className="text-emerald-700 dark:text-emerald-400">Rendu monnaie: </span>
            <span className="font-bold">{formatMoney(change, sym)}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
