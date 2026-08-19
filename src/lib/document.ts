import { formatMoney, formatDate, numberToWords } from './format';

type DocLine = {
  description?: string | null;
  qty: number;
  unit_price?: number;
  unit_cost?: number;
  tax_rate: number;
  line_total: number;
};

type PartyInfo = {
  name: string;
  email?: string | null;
  address?: string | null;
  phone?: string | null;
  tax_id?: string | null;
};

type DocInfo = {
  number: string;
  typeLabel: string;
  date: string;
  due_date?: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  paid_amount?: number;
  discount_amount?: number;
  notes?: string | null;
};

type CompanySettings = {
  company_name?: string;
  company_address?: string;
  company_email?: string;
  company_phone?: string;
  company_logo?: string | null;
  company_letterhead?: string | null;
  company_website?: string | null;
  company_rc?: string | null;
  company_ice?: string | null;
  company_if?: string | null;
  company_patente?: string | null;
  company_cnss?: string | null;
  company_rib?: string | null;
  company_iban?: string | null;
  company_bank_name?: string | null;
  company_signature?: string | null;
  company_stamp?: string | null;
  doc_template?: string;
  currency_symbol?: string;
};

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;font-size:13px;color:#1a1f29;background:#fff;padding:40px 40px 120px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
  .meta-box{border:1px solid #eef0f4;border-radius:10px;padding:14px}
  .meta-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9aa3b5;font-weight:600;margin-bottom:5px}
  .meta-value{font-size:14px;font-weight:600;color:#1a1f29}
  .meta-sub{font-size:11px;color:#717c93;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  thead tr{background:#f7f8fa}
  thead th{padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#717c93;font-weight:600;border-bottom:2px solid #eef0f4}
  thead th:not(:first-child){text-align:right}
  tbody tr{border-bottom:1px solid #f0f2f5}
  tbody tr:last-child{border-bottom:none}
  tbody td{padding:10px 12px;font-size:13px;color:#1a1f29}
  tbody td:not(:first-child){text-align:right}
  .totals{margin-left:auto;width:280px;margin-bottom:16px}
  .totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#717c93;border-bottom:1px solid #f0f2f5}
  .totals-row span:last-child{font-weight:500;color:#1a1f29}
  .totals-final{display:flex;justify-content:space-between;padding:12px 16px;font-size:15px;font-weight:700;color:#1e40af;background:#eff6ff;border-radius:8px;margin-top:8px}
  .paid-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#059669}
  .due-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#dc2626;font-weight:600}
  .amount-words{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#0369a1;line-height:1.5}
  .amount-words strong{color:#075985}
  .notes{margin-top:20px;padding:12px 16px;background:#f7f8fa;border-radius:8px;font-size:12px;color:#717c93;line-height:1.6}
  .notes strong{color:#4a5263}
  .legal-ids{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
  .legal-id{font-size:10px;color:#6b7280;background:#f3f4f6;border-radius:4px;padding:2px 6px;font-family:monospace}
  .bank-info{font-size:11px;color:#6b7280;line-height:1.7;border-top:1px solid #eef0f4;padding-top:8px;margin-top:8px}
  .stamp-area{display:flex;justify-content:flex-end;gap:32px;margin-top:28px}
  .stamp-box{text-align:center;width:120px}
  .stamp-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#9aa3b5;margin-bottom:6px}
  .stamp-img{height:80px;width:100%;object-fit:contain}
  .page-footer{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:2px solid #eef0f4;padding:10px 40px;font-size:10px;color:#6b7280}
  .page-footer-inner{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
  .page-footer-ids{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .page-footer-id{font-family:monospace;font-size:10px;color:#374151}
  .page-footer-id strong{color:#111827}
  .page-footer-doc{font-size:10px;color:#9ca3af;text-align:right}
  .watermark{position:fixed;bottom:50px;right:40px;font-size:10px;color:#c2c8d4;text-transform:uppercase;letter-spacing:.1em}
  @media print{
    @page{margin:0}
    body{padding:15mm 15mm 35mm}
    .page-footer{position:fixed;bottom:0;left:0;right:0}
    .watermark{display:none}
  }
`;

function buildLegalIds(_company: CompanySettings): string {
  return '';
}

function buildPageFooter(company: CompanySettings, _doc: DocInfo): string {
  const ids: string[] = [];
  if (company.company_if) ids.push(`<span class="page-footer-id"><strong>IF:</strong> ${company.company_if}</span>`);
  if (company.company_rc) ids.push(`<span class="page-footer-id"><strong>RC:</strong> ${company.company_rc}</span>`);
  if (company.company_patente) ids.push(`<span class="page-footer-id"><strong>Patente:</strong> ${company.company_patente}</span>`);
  if (company.company_ice) ids.push(`<span class="page-footer-id"><strong>ICE:</strong> ${company.company_ice}</span>`);

  if (!ids.length && !company.company_name) return '';

  return `
  <div class="page-footer">
    <div class="page-footer-inner">
      <div>
        <div style="font-weight:600;color:#111827;margin-bottom:3px">${company.company_name || ''}</div>
        ${ids.length ? `<div class="page-footer-ids">${ids.join('')}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function buildHeader(company: CompanySettings, doc: DocInfo): string {
  const tpl = company.doc_template || 'classic';
  const legalIds = buildLegalIds(company);

  const logoEl = company.company_logo
    ? `<img src="${company.company_logo}" style="height:44px;width:auto;object-fit:contain" />`
    : `<div style="width:44px;height:44px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700">${(company.company_name || 'E').charAt(0)}</div>`;

  if (tpl === 'modern') {
    return `
      <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:24px 32px;margin:-40px -40px 28px;display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:14px">
          ${company.company_logo ? `<div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:4px">${logoEl}</div>` : logoEl}
          <div>
            <div style="font-size:20px;font-weight:700;color:#fff">${company.company_name || 'Mon Entreprise'}</div>
            <div style="color:rgba(255,255,255,0.7);font-size:11px;margin-top:2px">${[company.company_address, company.company_email, company.company_phone].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:24px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#fff">${doc.typeLabel}</div>
          <div style="background:rgba(255,255,255,0.2);color:#fff;border-radius:6px;padding:3px 10px;font-size:12px;margin-top:5px;font-family:monospace">${doc.number}</div>
          <div style="color:rgba(255,255,255,0.6);font-size:11px;margin-top:4px">Émis le ${formatDate(doc.date)}</div>
        </div>
      </div>
      ${legalIds ? `<div style="margin-bottom:20px">${legalIds}</div>` : ''}`;
  }

  if (tpl === 'minimal') {
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:28px">
        <div>
          ${company.company_logo ? `<img src="${company.company_logo}" style="height:32px;width:auto;object-fit:contain;margin-bottom:6px;display:block" />` : ''}
          <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em">${company.company_name || 'Mon Entreprise'}</div>
          <div style="color:#9ca3af;font-size:11px;margin-top:3px">${[company.company_address, company.company_email, company.company_phone, company.company_website].filter(Boolean).join(' · ')}</div>
          ${legalIds}
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af">${doc.typeLabel}</div>
          <div style="font-size:22px;font-weight:700;color:#111827;font-family:monospace">${doc.number}</div>
          <div style="color:#9ca3af;font-size:11px">Émis le ${formatDate(doc.date)}</div>
        </div>
      </div>`;
  }

  if (tpl === 'elegant') {
    return `
      <div style="border:2px solid #d97706;border-radius:12px;overflow:hidden;margin-bottom:28px">
        <div style="padding:20px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #fde68a">
          <div style="display:flex;align-items:center;gap:14px">
            ${company.company_logo ? `<img src="${company.company_logo}" style="height:48px;width:auto;object-fit:contain" />` : `<div style="width:48px;height:48px;background:linear-gradient(135deg,#d97706,#f59e0b);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700">${(company.company_name || 'E').charAt(0)}</div>`}
            <div>
              <div style="font-size:18px;font-weight:700;color:#92400e;font-family:Georgia,serif">${company.company_name || 'Mon Entreprise'}</div>
              <div style="color:#b45309;font-size:11px;margin-top:2px">${[company.company_email, company.company_phone].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.15em;color:#b45309;font-family:Georgia,serif">Document commercial</div>
            <div style="font-size:22px;font-weight:700;color:#78350f;font-family:Georgia,serif">${doc.typeLabel}</div>
            <div style="font-family:monospace;color:#92400e;font-size:13px">${doc.number}</div>
          </div>
        </div>
        ${legalIds ? `<div style="padding:8px 24px;background:#fffbeb">${legalIds}</div>` : ''}
      </div>`;
  }

  if (tpl === 'dark') {
    return `
      <div style="background:#111827;border-radius:12px;overflow:hidden;margin-bottom:28px">
        <div style="padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;align-items:center;gap:14px">
            ${company.company_logo ? `<img src="${company.company_logo}" style="height:44px;width:auto;object-fit:contain;filter:brightness(0) invert(1)" />` : `<div style="width:44px;height:44px;background:#3b82f6;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700">${(company.company_name || 'E').charAt(0)}</div>`}
            <div>
              <div style="font-size:18px;font-weight:700;color:#f9fafb">${company.company_name || 'Mon Entreprise'}</div>
              <div style="color:#9ca3af;font-size:11px;margin-top:2px">${[company.company_address, company.company_email, company.company_phone].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:24px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#3b82f6">${doc.typeLabel}</div>
            <div style="color:#6b7280;font-family:monospace;font-size:12px">${doc.number}</div>
            <div style="color:#6b7280;font-size:11px;margin-top:2px">Émis le ${formatDate(doc.date)}</div>
          </div>
        </div>
        ${legalIds ? `<div style="padding:6px 24px;background:#1f2937">${legalIds}</div>` : ''}
      </div>`;
  }

  // Default: classic
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:2px solid #eef0f4">
      <div style="display:flex;align-items:center;gap:12px">
        ${logoEl}
        <div>
          <div style="font-size:18px;font-weight:700;color:#1e40af">${company.company_name || 'Mon Entreprise'}</div>
          <div style="font-size:11px;color:#717c93;margin-top:3px;line-height:1.6">
            ${company.company_address ? company.company_address + '<br>' : ''}
            ${company.company_email || ''} ${company.company_phone ? '· ' + company.company_phone : ''}
            ${company.company_website ? '<br>' + company.company_website : ''}
          </div>
          ${legalIds}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#1e40af">${doc.typeLabel}</div>
        <div style="font-size:12px;color:#717c93;margin-top:3px;font-family:monospace">${doc.number}</div>
        <div style="display:inline-block;background:#eff6ff;color:#1d4ed8;border-radius:6px;padding:2px 8px;font-size:11px;font-weight:600;margin-top:6px">Émis le ${formatDate(doc.date)}</div>
      </div>
    </div>`;
}

export function generateDocumentHTML(
  doc: DocInfo,
  lines: DocLine[],
  party: PartyInfo,
  partyLabel: string,
  company: CompanySettings,
  sym: string,
): string {
  const hasLetterhead = !!company.company_letterhead;
  const linesHtml = lines.map((l) => {
    const price = l.unit_price ?? l.unit_cost ?? 0;
    return `<tr>
      <td>${l.description || ''}</td>
      <td>${l.qty}</td>
      <td>${formatMoney(price, sym)}</td>
      <td>${l.tax_rate}%</td>
      <td style="font-weight:600">${formatMoney(l.line_total, sym)}</td>
    </tr>`;
  }).join('');

  const remaining = doc.total - (doc.paid_amount ?? 0);

  // With letterhead: render it as full-page background image for first page,
  // show minimal doc title/number overlay, suppress footer company info
  const letterheadStyles = hasLetterhead ? `
    .letterhead-bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none}
    .letterhead-bg img{width:100%;height:100%;object-fit:contain;object-position:top}
    body{padding-top:180px}
    @media print{.letterhead-bg{display:block}}
  ` : '';

  const letterheadEl = hasLetterhead ? `
    <div class="letterhead-bg">
      <img src="${company.company_letterhead}" alt="En-tête" />
    </div>
    <!-- Document title overlay for letterhead mode -->
    <div style="position:fixed;top:16px;right:40px;text-align:right;z-index:10">
      <div style="font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#1e40af">${doc.typeLabel}</div>
      <div style="font-size:12px;color:#6b7280;font-family:monospace">${doc.number}</div>
      <div style="font-size:11px;color:#9ca3af">Émis le ${formatDate(doc.date)}</div>
    </div>
  ` : '';

  // Only show page footer with legal IDs when there's no letterhead
  const pageFooter = hasLetterhead ? '' : buildPageFooter(company, doc);
  const header = hasLetterhead ? '' : buildHeader(company, doc);

  const currencyLabel = sym === 'DH' ? 'Dirhams' : sym === '€' ? 'Euros' : sym === '$' ? 'Dollars' : sym;
  const amountWords = numberToWords(doc.total, currencyLabel);

  const bankInfo = (company.company_rib || company.company_iban || company.company_bank_name)
    ? `<div class="bank-info">
        <strong>Coordonnées bancaires :</strong>
        ${company.company_bank_name ? ` ${company.company_bank_name}` : ''}
        ${company.company_rib ? ` · RIB : <span style="font-family:monospace">${company.company_rib}</span>` : ''}
        ${company.company_iban ? ` · IBAN : <span style="font-family:monospace">${company.company_iban}</span>` : ''}
      </div>`
    : '';

  const stampsHtml = (company.company_signature || company.company_stamp)
    ? `<div class="stamp-area">
        ${company.company_signature ? `<div class="stamp-box"><div class="stamp-label">Signature</div><img src="${company.company_signature}" class="stamp-img" /></div>` : ''}
        ${company.company_stamp ? `<div class="stamp-box"><div class="stamp-label">Cachet</div><img src="${company.company_stamp}" class="stamp-img" /></div>` : ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${doc.typeLabel} ${doc.number}</title>
  <style>${BASE_STYLES}${letterheadStyles}</style>
</head>
<body>
  ${pageFooter}
  ${letterheadEl}
  ${header}

  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">${partyLabel}</div>
      <div class="meta-value">${party.name}</div>
      ${party.email ? `<div class="meta-sub">${party.email}</div>` : ''}
      ${party.address ? `<div class="meta-sub">${party.address}</div>` : ''}
      ${party.phone ? `<div class="meta-sub">${party.phone}</div>` : ''}
      ${party.tax_id ? `<div class="meta-sub" style="margin-top:4px;padding:3px 8px;background:#f0f9ff;border-radius:4px;font-family:monospace;font-size:11px;color:#0369a1"><strong>ICE :</strong> ${party.tax_id}</div>` : ''}
    </div>
    <div class="meta-box">
      <div class="meta-label">Informations document</div>
      <div class="meta-value">N° ${doc.number}</div>
      <div class="meta-sub">Date: ${formatDate(doc.date)}</div>
      ${doc.due_date ? `<div class="meta-sub">Échéance: ${formatDate(doc.due_date)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Désignation</th>
        <th>Qté</th>
        <th>P.U. HT</th>
        <th>TVA</th>
        <th>Total HT</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Sous-total HT</span><span>${formatMoney(doc.subtotal, sym)}</span></div>
    <div class="totals-row"><span>TVA</span><span>${formatMoney(doc.tax_amount, sym)}</span></div>
    ${(doc.discount_amount ?? 0) > 0 ? `<div class="totals-row"><span>Remise</span><span>-${formatMoney(doc.discount_amount!, sym)}</span></div>` : ''}
    <div class="totals-final"><span>Total TTC</span><span>${formatMoney(doc.total, sym)}</span></div>
    ${(doc.paid_amount ?? 0) > 0 ? `<div class="paid-row"><span>Montant payé</span><span>${formatMoney(doc.paid_amount!, sym)}</span></div>` : ''}
    ${remaining > 0.01 ? `<div class="due-row"><span>Reste à payer</span><span>${formatMoney(remaining, sym)}</span></div>` : ''}
  </div>

  <div class="amount-words">
    <strong>Arrêté le présent document à la somme de :</strong><br>
    ${amountWords} TTC
  </div>

  ${doc.notes ? `<div class="notes"><strong>Notes :</strong> ${doc.notes}</div>` : ''}

  ${stampsHtml}

  ${bankInfo ? `<div style="margin-top:20px">${bankInfo}</div>` : ''}

  <div class="watermark">Nexus ERP</div>
</body>
</html>`;
}

export function openPrintWindow(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('style', 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:0;visibility:hidden');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    alert('Impression impossible. Veuillez réessayer.');
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  iframe.addEventListener('load', () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }, 60000);
    }
  });
}

export function downloadDocument(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
