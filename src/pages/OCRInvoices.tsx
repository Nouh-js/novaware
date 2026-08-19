import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/format';
import { toast } from '../lib/toast';
import { Card, Badge, Spinner } from '../components/ui';
import {
  Upload,
  ScanLine,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Building2,
  Hash,
  Calendar,
  Package,
  Percent,
  RefreshCw,
  AlertCircle,
  Zap,
  Trash2,
  Plus,
  Eye,
  History,
  Gauge,
  TrendingUp,
  Clock,
} from 'lucide-react';
import type { Product } from '../lib/types';

const DAILY_QUOTA = 10;

type ExtractedLine = {
  reference: string;
  description: string;
  qty: number;
  unit: string;
  unit_cost: number;
  tax_rate: number;
  discount: number;
  line_total: number;
  product_id?: string;
  isNew?: boolean;
};

type ExtractedInvoice = {
  supplier_name: string | null;
  supplier_tax_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string;
  lines: ExtractedLine[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  notes: string | null;
};

type Stage = 'upload' | 'analyzing' | 'review' | 'error' | 'history';

type ScannedInvoice = {
  id: string;
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  total_ttc: number;
  status: string;
  created_at: string;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function extractTextFromPDFBytes(bytes: Uint8Array): string {
  let raw = '';
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  const textParts: string[] = [];
  const btEt = /BT([\s\S]*?)ET/g;
  let m: RegExpExecArray | null;
  while ((m = btEt.exec(raw)) !== null) {
    const block = m[1];
    const tjRe = /\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g;
    let t: RegExpExecArray | null;
    while ((t = tjRe.exec(block)) !== null) {
      const chunk = (t[1] ?? t[2] ?? '')
        .replace(/\\(\d{3})/g, (_: string, oct: string) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ');
      if (/[\w\d\s,./:@-]/.test(chunk)) textParts.push(chunk);
    }
  }
  const hexRe = /<([0-9A-Fa-f]{4,})>/g;
  let h: RegExpExecArray | null;
  while ((h = hexRe.exec(raw)) !== null) {
    const hex = h[1];
    let decoded = '';
    for (let i = 0; i + 1 < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      if (code > 31 && code < 128) decoded += String.fromCharCode(code);
    }
    if (decoded.length > 2 && /[\w\d]/.test(decoded)) textParts.push(decoded);
  }
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

async function extractPDFContent(file: File): Promise<{ type: 'text' | 'image'; data: string; mimeType: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const text = extractTextFromPDFBytes(bytes);
  if (text.length > 80) {
    return { type: 'text', data: text, mimeType: 'text/plain' };
  }
  try {
    const pdfjsLib = await (Function('return import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs")')() as Promise<any>);
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let fullText = '';
    const pageCount = Math.min(pdf.numPages, 4);
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.filter((item: any) => 'str' in item).map((item: any) => item.str).join(' ') + '\n';
    }
    if (fullText.trim().length > 80) {
      return { type: 'text', data: fullText.trim(), mimeType: 'text/plain' };
    }
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    return { type: 'image', data: b64, mimeType: 'image/png' };
  } catch {
    const b64 = await fileToBase64(file);
    return { type: 'image', data: b64, mimeType: 'application/pdf' };
  }
}

export function OCRInvoices({ settings }: { settings: any }) {
  const sym = settings?.currency_symbol || 'DH';
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedInvoice | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [history, setHistory] = useState<ScannedInvoice[]>([]);
  const [selectedScanned, setSelectedScanned] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [prodsRes, quotaRes, historyRes] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('ocr_quota').select('count').eq('date', today).maybeSingle(),
      supabase.from('scanned_invoices').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setProducts((prodsRes.data as Product[]) || []);
    setQuotaUsed(quotaRes.data?.count || 0);
    setHistory((historyRes.data as ScannedInvoice[]) || []);
  };

  const handleFile = useCallback((f: File) => {
    if (!f.type.match(/^(image\/(png|jpeg|jpg|webp|tiff)|application\/pdf)$/)) {
      toast('Formats acceptes: PDF, PNG, JPG, WEBP, TIFF', 'error');
      return;
    }
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
    runAnalysis(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const runAnalysis = async (f: File) => {
    if (quotaUsed >= DAILY_QUOTA) {
      toast('Quota journalier atteint (10 factures/jour)', 'error');
      return;
    }

    setStage('analyzing');
    setAnalysisError(null);

    try {
      let type: 'image' | 'text';
      let data: string;
      let mimeType = f.type;

      if (f.type === 'application/pdf') {
        const extracted = await extractPDFContent(f);
        type = extracted.type;
        data = extracted.data;
        mimeType = extracted.mimeType;
      } else {
        type = 'image';
        data = await fileToBase64(f);
      }

      const { data: apiResult, error: fnError } = await supabase.functions.invoke('ocr-invoice', {
        body: { type, data, mimeType },
      });

      if (fnError) throw new Error(fnError.message || 'Erreur de connexion au service OCR');
      if (apiResult?.error) throw new Error(apiResult.error);
      if (!apiResult) throw new Error('Aucune donnee retournee par le service OCR');

      // Mark lines with product matching
      const linesWithMatch = (apiResult.lines || []).map((l: any) => {
        const existingProduct = products.find((p) => p.sku === String(l.reference || ''));
        return {
          reference: String(l.reference ?? ''),
          description: String(l.description ?? ''),
          qty: Number(l.qty) || 0,
          unit: String(l.unit ?? 'piece'),
          unit_cost: Number(l.unit_cost) || 0,
          tax_rate: Number(l.tax_rate) || 20,
          discount: Number(l.discount) || 0,
          line_total: Number(l.line_total) || 0,
          product_id: existingProduct?.id,
          isNew: !existingProduct,
        };
      });

      const extracted: ExtractedInvoice = {
        supplier_name: apiResult.supplier_name ?? null,
        supplier_tax_id: apiResult.supplier_tax_id ?? null,
        invoice_number: apiResult.invoice_number ?? null,
        invoice_date: apiResult.invoice_date ?? null,
        due_date: apiResult.due_date ?? null,
        currency: apiResult.currency ?? 'MAD',
        lines: linesWithMatch,
        total_ht: Number(apiResult.total_ht) || 0,
        total_tva: Number(apiResult.total_tva) || 0,
        total_ttc: Number(apiResult.total_ttc) || 0,
        notes: apiResult.notes ?? null,
      };

      setResult(extracted);
      setStage('review');

      // Increment quota
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('ocr_quota').upsert(
        { date: today, count: quotaUsed + 1 },
        { onConflict: 'user_id,date' }
      );
      setQuotaUsed((q) => q + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnalysisError(msg);
      setStage('error');
    }
  };

  const updateField = (field: keyof ExtractedInvoice, value: any) => {
    setResult((r) => (r ? { ...r, [field]: value } : r));
  };

  const updateLine = (index: number, patch: Partial<ExtractedLine>) => {
    setResult((r) => {
      if (!r) return r;
      const lines = [...r.lines];
      lines[index] = { ...lines[index], ...patch };
      return { ...r, lines };
    });
  };

  const recalcTotals = () => {
    setResult((r) => {
      if (!r) return r;
      const lines = r.lines.map((l) => ({
        ...l,
        line_total: Math.round(l.qty * l.unit_cost * (1 - l.discount / 100) * 100) / 100,
      }));
      const totalHT = lines.reduce((s, l) => s + l.line_total, 0);
      const totalTVA = lines.reduce((s, l) => s + l.line_total * (l.tax_rate / 100), 0);
      return {
        ...r,
        lines,
        total_ht: Math.round(totalHT * 100) / 100,
        total_tva: Math.round(totalTVA * 100) / 100,
        total_ttc: Math.round((totalHT + totalTVA) * 100) / 100,
      };
    });
  };

  const addNewProduct = async (lineIndex: number) => {
    const line = result?.lines[lineIndex];
    if (!line) return;

    const { data: newProd, error } = await supabase
      .from('products')
      .insert({
        name: line.description,
        sku: line.reference,
        cost_price: line.unit_cost,
        sale_price: line.unit_cost * 1.4,
        tax_rate: line.tax_rate,
        stock_qty: 0,
        min_stock: 5,
        max_stock: 50,
        valuation_method: 'CMUP',
        active: true,
      })
      .select()
      .maybeSingle();

    if (error) {
      toast('Erreur creation produit: ' + error.message, 'error');
      return;
    }

    if (newProd) {
      updateLine(lineIndex, { product_id: newProd.id, isNew: false });
      setProducts((p) => [...p, newProd as Product]);
      toast(`Produit "${line.description}" cree`, 'success');
    }
  };

  const saveInvoice = async () => {
    if (!result) return;

    // Save scanned invoice
    const { data: scanned, error: scanErr } = await supabase
      .from('scanned_invoices')
      .insert({
        supplier_name: result.supplier_name,
        supplier_tax_id: result.supplier_tax_id,
        invoice_number: result.invoice_number,
        invoice_date: result.invoice_date,
        due_date: result.due_date,
        currency: result.currency,
        total_ht: result.total_ht,
        total_tva: result.total_tva,
        total_ttc: result.total_ttc,
        notes: result.notes,
        file_name: file?.name,
        file_type: file?.type,
        raw_response: result,
        status: 'processed',
      })
      .select()
      .maybeSingle();

    if (scanErr) {
      toast('Erreur sauvegarde: ' + scanErr.message, 'error');
      return;
    }

    // Save lines
    if (scanned && result.lines.length > 0) {
      await supabase.from('scanned_invoice_lines').insert(
        result.lines.map((l) => ({
          scanned_invoice_id: scanned.id,
          reference: l.reference,
          description: l.description,
          qty: l.qty,
          unit: l.unit,
          unit_cost: l.unit_cost,
          tax_rate: l.tax_rate,
          discount: l.discount,
          line_total: l.line_total,
          product_id: l.product_id,
        }))
      );
    }

    toast('Facture sauvegardee avec succes', 'success');
    loadData();
    resetState();
  };

  const resetState = () => {
    setStage('upload');
    setFile(null);
    setFilePreview(null);
    setResult(null);
    setAnalysisError(null);
  };

  const deleteScanned = async (id: string) => {
    const { error } = await supabase.from('scanned_invoices').delete().eq('id', id);
    if (error) {
      toast('Erreur suppression: ' + error.message, 'error');
      return;
    }
    toast('Facture supprimee', 'success');
    loadData();
  };

  const quotaRemaining = DAILY_QUOTA - quotaUsed;
  const quotaPercent = (quotaUsed / DAILY_QUOTA) * 100;

  return (
    <div className="space-y-6">
      {/* Header with Quota */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-soft">
            <ScanLine size={22} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">OCR Factures</h1>
            <p className="text-xs text-ink-500">Extraction automatique via Google Gemini</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Quota Card */}
          <Card className="flex items-center gap-3 py-2 px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60">
              <Gauge size={16} />
            </div>
            <div className="min-w-[100px]">
              <div className="text-xs text-ink-500">Quota journalier</div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-brand-600">{quotaRemaining}</span>
                <span className="text-xs text-ink-400">/ {DAILY_QUOTA}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-ink-100 dark:bg-ink-800">
                <div
                  className={`h-full rounded-full transition ${quotaPercent > 80 ? 'bg-red-500' : quotaPercent > 50 ? 'bg-amber-500' : 'bg-brand-500'}`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
            </div>
          </Card>

          {/* History Button */}
          <button onClick={() => setStage('history')} className="btn-secondary">
            <History size={16} /> Historique
          </button>
        </div>
      </div>

      {/* Main Content */}
      {stage === 'history' ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-semibold">Factures scannees</h3>
            <button onClick={resetState} className="btn-secondary">
              <Plus size={16} /> Nouvelle facture
            </button>
          </div>
          {history.length === 0 ? (
            <div className="py-12 text-center text-ink-500">
              <FileText size={40} className="mx-auto mb-3 opacity-50" />
              <p>Aucune facture scannee pour le moment</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 dark:bg-ink-800/50">
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-400">
                    <th className="px-4 py-3">Fournisseur</th>
                    <th className="px-4 py-3">N Facture</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total TTC</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-ink-50 dark:border-ink-800/50">
                      <td className="px-4 py-3 font-medium">{h.supplier_name || '-'}</td>
                      <td className="px-4 py-3">{h.invoice_number || '-'}</td>
                      <td className="px-4 py-3">{h.invoice_date || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMoney(h.total_ttc, sym)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={h.status === 'processed' ? 'success' : 'warning'}>
                          {h.status === 'processed' ? 'Traite' : 'En attente'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedScanned(h)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => deleteScanned(h.id)}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                          >
                            <Trash2 size={16} />
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
      ) : (
        <Card>
          {/* Upload Stage */}
          {stage === 'upload' && (
            <div className="space-y-4">
              {quotaUsed >= DAILY_QUOTA && (
                <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertTriangle size={16} className="mr-2 inline" />
                  Quota journalier atteint. Revenez demain pour scanner plus de factures.
                </div>
              )}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onClick={() => quotaUsed < DAILY_QUOTA && fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition ${
                  quotaUsed >= DAILY_QUOTA ? 'cursor-not-allowed opacity-60' :
                  isDragOver
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/20'
                    : 'border-ink-200 bg-ink-50/30 hover:border-brand-400 hover:bg-brand-50/30 dark:border-ink-700 dark:bg-ink-800/30 dark:hover:border-brand-600'
                }`}
              >
                <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition ${
                  isDragOver ? 'bg-brand-100 text-brand-600' : 'bg-ink-100 text-ink-400 dark:bg-ink-800'
                }`}>
                  <Upload size={28} />
                </div>
                <h3 className="font-display text-lg font-semibold">
                  {isDragOver ? 'Deposez le fichier ici' : 'Deposez votre facture'}
                </h3>
                <p className="mt-1 text-sm text-ink-500">ou cliquez pour parcourir vos fichiers</p>
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand-50/60 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                  <Zap size={12} /> Analyse par Google Gemini
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['PDF', 'PNG', 'JPG', 'WEBP', 'TIFF'].map((ext) => (
                    <span key={ext} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-ink-500 shadow-soft dark:bg-ink-800">
                      {ext}
                    </span>
                  ))}
                </div>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { icon: Building2, label: 'Fournisseur', desc: 'Extraction auto' },
                  { icon: Hash, label: 'Reference', desc: 'N facture extrait' },
                  { icon: Package, label: 'Produits', desc: 'Lignes analysees' },
                  { icon: TrendingUp, label: 'Totaux', desc: 'HT, TVA, TTC' },
                ].map((c) => (
                  <div key={c.label} className="flex items-start gap-2 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60">
                      <c.icon size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{c.label}</div>
                      <div className="text-[10px] text-ink-400">{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analyzing Stage */}
          {stage === 'analyzing' && (
            <div className="flex flex-col items-center py-12">
              <div className="relative mb-6">
                <div className="h-20 w-20 animate-spin rounded-full border-4 border-ink-100 border-t-brand-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanLine size={24} className="text-brand-600" />
                </div>
              </div>
              <h3 className="font-display text-lg font-semibold">Analyse en cours...</h3>
              <p className="mt-2 text-sm text-ink-500">Envoi du fichier a Gemini pour extraction</p>
              {file && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-ink-50 px-4 py-2 text-sm text-ink-500 dark:bg-ink-800">
                  <FileText size={15} />
                  <span className="font-medium">{file.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Error Stage */}
          {stage === 'error' && (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-display text-lg font-bold text-red-700 dark:text-red-400">Echec de l'analyse</h3>
              {analysisError && (
                <div className="mt-4 w-full max-w-md rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-left dark:border-red-900/40 dark:bg-red-950/20">
                  <p className="text-sm text-red-700 dark:text-red-300">{analysisError}</p>
                </div>
              )}
              <div className="mt-6 flex gap-3">
                <button onClick={resetState} className="btn-secondary">Annuler</button>
                <button onClick={() => file && runAnalysis(file)} className="btn-primary">
                  <RefreshCw size={15} /> Reessayer
                </button>
              </div>
            </div>
          )}

          {/* Review Stage */}
          {stage === 'review' && result && (
            <div className="space-y-5">
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <Check size={14} className="mr-2 inline" />
                Facture analysee. Verifiez les donnees, ajoutez les nouveaux produits puis sauvegardez.
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Left: Header fields */}
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-semibold text-ink-700 dark:text-ink-200">Informations genereales</h3>
                  <SimpleField icon={<Building2 size={14} />} label="Fournisseur" value={result.supplier_name || ''}
                    onChange={(v) => updateField('supplier_name', v || null)} />
                  <SimpleField icon={<Hash size={14} />} label="N Facture" value={result.invoice_number || ''}
                    onChange={(v) => updateField('invoice_number', v || null)} />
                  <SimpleField icon={<Calendar size={14} />} label="Date" type="date" value={result.invoice_date || ''}
                    onChange={(v) => updateField('invoice_date', v || null)} />
                  <SimpleField icon={<Calendar size={14} />} label="Echeance" type="date" value={result.due_date || ''}
                    onChange={(v) => updateField('due_date', v || null)} />
                </div>

                {/* Right: Totals + Preview */}
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-semibold text-ink-700 dark:text-ink-200">Montants</h3>
                  <div className="rounded-xl border border-ink-100 dark:border-ink-800">
                    <div className="flex items-center justify-between border-b border-ink-50 px-4 py-2.5 dark:border-ink-800/50">
                      <span className="text-sm text-ink-500">Total HT</span>
                      <span className="font-medium">{formatMoney(result.total_ht, sym)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-ink-50 px-4 py-2.5 dark:border-ink-800/50">
                      <span className="text-sm text-ink-500">TVA</span>
                      <span className="font-medium">{formatMoney(result.total_tva, sym)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-ink-50/50 px-4 py-3 dark:bg-ink-800/30">
                      <span className="font-semibold">Total TTC</span>
                      <span className="font-display text-xl font-bold text-brand-600">{formatMoney(result.total_ttc, sym)}</span>
                    </div>
                  </div>
                  {filePreview && (
                    <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
                      <img src={filePreview} alt="Apercu" className="max-h-40 w-full object-contain" />
                    </div>
                  )}
                </div>
              </div>

              {/* Lines Table */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold text-ink-700 dark:text-ink-200">
                    Lignes produits ({result.lines.length})
                  </h3>
                  <button onClick={recalcTotals} className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
                    <RefreshCw size={12} /> Recalculer
                  </button>
                </div>
                <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs uppercase tracking-wider text-ink-400 dark:border-ink-800 dark:bg-ink-800/60">
                        <th className="px-3 py-2.5 font-medium">Ref.</th>
                        <th className="px-3 py-2.5 font-medium">Designation</th>
                        <th className="px-3 py-2.5 text-right font-medium">Qte</th>
                        <th className="px-3 py-2.5 text-right font-medium">P.U. HT</th>
                        <th className="px-3 py-2.5 text-right font-medium">TVA%</th>
                        <th className="px-3 py-2.5 text-right font-medium">Total</th>
                        <th className="px-3 py-2.5 font-medium">Produit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.lines.map((line, idx) => (
                        <tr key={idx} className="border-b border-ink-50 dark:border-ink-800/50">
                          <td className="px-2 py-2">
                            <input className="input py-1 font-mono text-xs w-20"
                              value={line.reference} onChange={(e) => updateLine(idx, { reference: e.target.value })} />
                          </td>
                          <td className="px-2 py-2">
                            <input className="input py-1 text-xs w-full"
                              value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.01" className="input py-1 text-xs w-14 text-right"
                              value={line.qty} onChange={(e) => { updateLine(idx, { qty: parseFloat(e.target.value) || 0 }); recalcTotals(); }} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.01" className="input py-1 text-xs w-16 text-right"
                              value={line.unit_cost} onChange={(e) => { updateLine(idx, { unit_cost: parseFloat(e.target.value) || 0 }); recalcTotals(); }} />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.01" className="input py-1 text-xs w-12 text-right"
                              value={line.tax_rate} onChange={(e) => { updateLine(idx, { tax_rate: parseFloat(e.target.value) || 0 }); recalcTotals(); }} />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-medium">{formatMoney(line.line_total, sym)}</td>
                          <td className="px-2 py-2">
                            {line.isNew ? (
                              <button onClick={() => addNewProduct(idx)} className="btn-secondary py-1 text-xs">
                                <Plus size={12} /> Creer
                              </button>
                            ) : (
                              <Badge tone="success">Existant</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between border-t border-ink-100 pt-4 dark:border-ink-800">
                <button onClick={resetState} className="btn-secondary">
                  <X size={15} /> Annuler
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-ink-500">
                    {result.lines.filter((l) => l.isNew).length} nouveau(x) produit(s)
                  </span>
                  <button onClick={saveInvoice} className="btn-primary">
                    <Check size={15} /> Sauvegarder
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Scanned Invoice Detail Modal */}
      {selectedScanned && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-ink-100 p-4 dark:border-ink-800">
              <h3 className="font-display font-semibold">Detail facture scannee</h3>
              <button onClick={() => setSelectedScanned(null)} className="text-ink-400 hover:text-ink-700">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-ink-500">Fournisseur:</span> <span className="font-medium">{selectedScanned.supplier_name || '-'}</span></div>
                <div><span className="text-ink-500">N Facture:</span> <span className="font-medium">{selectedScanned.invoice_number || '-'}</span></div>
                <div><span className="text-ink-500">Date:</span> <span className="font-medium">{selectedScanned.invoice_date || '-'}</span></div>
                <div><span className="text-ink-500">Total TTC:</span> <span className="font-bold text-brand-600">{formatMoney(selectedScanned.total_ttc, sym)}</span></div>
              </div>
              {selectedScanned.raw_response?.lines && (
                <div className="rounded-lg border border-ink-100 dark:border-ink-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-ink-50 dark:bg-ink-800/50">
                      <tr className="text-left text-xs uppercase text-ink-400">
                        <th className="px-3 py-2">Ref.</th>
                        <th className="px-3 py-2">Designation</th>
                        <th className="px-3 py-2 text-right">Qte</th>
                        <th className="px-3 py-2 text-right">PU HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedScanned.raw_response.lines.map((l: any, i: number) => (
                        <tr key={i} className="border-t border-ink-50 dark:border-ink-800/50">
                          <td className="px-3 py-2 font-mono text-xs">{l.reference}</td>
                          <td className="px-3 py-2">{l.description}</td>
                          <td className="px-3 py-2 text-right">{l.qty}</td>
                          <td className="px-3 py-2 text-right">{formatMoney(l.unit_cost, sym)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SimpleField({
  icon,
  label,
  value,
  type = 'text',
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  type?: 'text' | 'date';
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2.5 dark:border-ink-800">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500 dark:bg-ink-800">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <label className="text-[10px] font-medium uppercase tracking-wider text-ink-400">{label}</label>
        <input type={type} className="input mt-0.5 py-1 text-sm w-full" value={value}
          onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}
