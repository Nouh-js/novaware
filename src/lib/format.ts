export function formatMoney(value: number, symbol = 'DH'): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}

export function formatNumber(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString('fr-FR');
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  return `il y a ${days} j`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function belowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7) {
    return u === 1 ? 'soixante-et-onze' : `soixante-${UNITS[10 + u]}`;
  }
  if (t === 9) {
    return u === 0 ? 'quatre-vingt-dix' : `quatre-vingt-${UNITS[10 + u]}`;
  }
  const ten = TENS[t];
  if (u === 0) return t === 8 ? 'quatre-vingts' : ten;
  if (u === 1 && t !== 8) return `${ten}-et-un`;
  return `${ten}-${UNITS[u]}`;
}

function intToWords(n: number): string {
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;
  if (billions > 0) parts.push(`${billions === 1 ? 'un' : belowThousand(billions)} milliard${billions > 1 ? 's' : ''}`);
  if (millions > 0) parts.push(`${millions === 1 ? 'un' : belowThousand(millions)} million${millions > 1 ? 's' : ''}`);
  if (thousands > 0) parts.push(`${thousands === 1 ? 'mille' : `${belowThousand(thousands)} mille`}`);
  if (remainder > 0) {
    const h = Math.floor(remainder / 100);
    const rest = remainder % 100;
    if (h > 0) {
      parts.push(h === 1 ? `cent${rest > 0 ? '' : 's'}` : `${UNITS[h]} cent${rest > 0 ? '' : 's'}`);
    }
    if (rest > 0) parts.push(belowThousand(rest));
  }
  return parts.join(' ');
}

export function numberToWords(amount: number, currencyLabel = 'Dirhams', centsLabel = 'Centimes'): string {
  const n = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(n / 100);
  const cents = n % 100;
  const negative = amount < 0 ? 'moins ' : '';
  let result = `${negative}${intToWords(whole)} ${currencyLabel}`;
  if (cents > 0) result += ` et ${intToWords(cents)} ${centsLabel}`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}
