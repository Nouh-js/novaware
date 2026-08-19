export type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
};

export const PRODUCT_CATEGORIES = [
  'Cahier',
  'Livre',
  'Fourniture',
  'Papeterie',
  'Informatique',
  'Accessoires',
  'Agenda',
  'Autre',
] as const;

export const DEFAULT_CATEGORY = 'Autre';

export type Brand = {
  id: string;
  name: string;
  country: string | null;
  created_at: string;
};

export const SCHOOL_LEVELS = [
  'Tous',
  'Maternelle',
  'Primaire',
  'Collège',
  'Lycée',
  'Université',
] as const;

export type SchoolLevel = (typeof SCHOOL_LEVELS)[number];

export type DiscountType = 'none' | 'percent' | 'fixed';

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  brand_id: string | null;
  description: string | null;
  cost_price: number;
  sale_price: number;
  tax_rate: number;
  unit: string;
  stock_qty: number;
  min_stock: number;
  max_stock: number;
  valuation_method: string;
  location: string | null;
  expiry_date: string | null;
  active: boolean;
  image_url: string | null;
  school_level: SchoolLevel;
  discount_type: DiscountType;
  discount_value: number;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  brand?: Brand | null;
};

export function finalPrice(p: { sale_price: number; discount_type: DiscountType; discount_value: number }): number {
  if (p.discount_type === 'percent') {
    return Math.max(0, p.sale_price * (1 - p.discount_value / 100));
  }
  if (p.discount_type === 'fixed') {
    return Math.max(0, p.sale_price - p.discount_value);
  }
  return p.sale_price;
}

export type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  active: boolean;
  tax_enabled: boolean;
  tax_rate: number;
  created_at: string;
  updated_at: string;
};

export const SERVICE_CATEGORIES = [
  'Reprographie',
  'Reliure',
  'Administratif',
  'Saisie',
  'Autre',
] as const;

export type Customer = {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  tax_id: string | null;
  balance: number;
  credit_limit: number;
  payment_terms: string;
  loyalty_points: number;
  notes: string | null;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  tax_id: string | null;
  balance: number;
  contact_person: string | null;
  notes: string | null;
  created_at: string;
};

export type SalesDocumentType =
  | 'quote'
  | 'order'
  | 'delivery'
  | 'invoice'
  | 'proforma'
  | 'credit_note';

export type SalesDocumentStatus =
  | 'draft'
  | 'sent'
  | 'validated'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'cancelled';

export type SalesLine = {
  id: string;
  document_id: string;
  product_id: string | null;
  description: string | null;
  qty: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  line_total: number;
  product?: Product | null;
};

export type SalesDocument = {
  id: string;
  number: string;
  type: SalesDocumentType;
  status: SalesDocumentStatus;
  customer_id: string | null;
  date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  parent_id: string | null;
  created_at: string;
  customer?: Customer | null;
  lines?: SalesLine[];
};

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'check'
  | 'transfer'
  | 'mobile_money';

export type Payment = {
  id: string;
  number: string;
  direction: string;
  party_type: string;
  party_id: string | null;
  document_id: string | null;
  amount: number;
  method: PaymentMethod;
  date: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export type PurchaseDocument = {
  id: string;
  number: string;
  type: string;
  status: string;
  supplier_id: string | null;
  date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  supplier?: Supplier | null;
  lines?: PurchaseLine[];
};

export type PurchaseLine = {
  id: string;
  document_id: string;
  product_id: string | null;
  description: string | null;
  qty: number;
  unit_cost: number;
  tax_rate: number;
  line_total: number;
  product?: Product | null;
};

export type StockMovement = {
  id: string;
  product_id: string;
  type: string;
  qty: number;
  unit_cost: number;
  reason: string | null;
  reference: string | null;
  created_at: string;
  product?: Product | null;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  severity: string;
  read: boolean;
  link: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  icon: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  role: import('./auth').UserRole;
  avatar_url: string | null;
  created_at: string;
};

export type Settings = {
  id: number;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_address: string;
  company_logo: string | null;
  company_letterhead: string | null;
  company_website: string | null;
  company_rc: string | null;
  company_ice: string | null;
  company_if: string | null;
  company_patente: string | null;
  company_cnss: string | null;
  company_rib: string | null;
  company_iban: string | null;
  company_bank_name: string | null;
  company_signature: string | null;
  company_stamp: string | null;
  doc_template: string;
  currency: string;
  currency_symbol: string;
  default_tax_rate: number;
  invoice_prefix: string;
  quote_prefix: string;
  order_prefix: string;
  delivery_prefix: string;
  payment_prefix: string;
  language: string;
  theme: string;
};
