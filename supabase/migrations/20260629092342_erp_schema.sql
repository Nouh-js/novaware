/*
# ERP Commercial SaaS - Core Schema

## Overview
Single-tenant ERP schema for a commercial business application. No sign-in screen
in this build, so all policies are scoped to `anon, authenticated` and data is
intentionally shared within the tenant.

## New Tables
1. `categories` - product categories (name, description)
2. `brands` - product brands
3. `products` - products with SKU, barcode, pricing, stock levels, valuation method
4. `stock_movements` - inventory movements (in/out/adjust), FIFO/LIFO/CMUP audit trail
5. `customers` - customers with balance, credit limit, payment terms
6. `suppliers` - suppliers with balance, contact info
7. `sales_documents` - quotes, orders, delivery notes, invoices, proforma, credit notes
8. `sales_lines` - line items for sales documents
9. `payments` - customer/supplier payments (cash, card, check, transfer, mobile money)
10. `purchase_documents` - supplier purchase orders, receipts, invoices, credit notes
11. `purchase_lines` - line items for purchase documents
12. `notifications` - internal notifications/alerts
13. `activities` - recent activity feed
14. `settings` - key/value company settings (singleton row)

## Security
- RLS enabled on every table.
- All policies `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
  because this is a single-tenant app with no sign-in screen and the data is
  intentionally shared within the tenant.

## Notes
1. Money is stored as numeric(14,2) to avoid float drift.
2. `sales_documents` uses a `type` enum-like text + `status` for the conversion flow:
   quote -> order -> delivery -> invoice -> paid.
3. `stock_movements` keeps a running valuation snapshot for FIFO/LIFO/CMUP reporting.
4. `settings` is a single-row table enforced by a unique constraint on `id`.
*/

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_categories" ON categories;
CREATE POLICY "anon_crud_categories" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_categories" ON categories;
CREATE POLICY "anon_ins_categories" ON categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_categories" ON categories;
CREATE POLICY "anon_upd_categories" ON categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_categories" ON categories;
CREATE POLICY "anon_del_categories" ON categories FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- BRANDS
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_brands" ON brands;
CREATE POLICY "anon_sel_brands" ON brands FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_brands" ON brands;
CREATE POLICY "anon_ins_brands" ON brands FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_brands" ON brands;
CREATE POLICY "anon_upd_brands" ON brands FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_brands" ON brands;
CREATE POLICY "anon_del_brands" ON brands FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE NOT NULL,
  barcode text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  description text,
  cost_price numeric(14,2) DEFAULT 0,
  sale_price numeric(14,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 20.00,
  unit text DEFAULT 'pièce',
  stock_qty numeric(14,2) DEFAULT 0,
  min_stock numeric(14,2) DEFAULT 5,
  max_stock numeric(14,2) DEFAULT 100,
  valuation_method text DEFAULT 'CMUP', -- FIFO | LIFO | CMUP
  location text,
  expiry_date date,
  active boolean DEFAULT true,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_products" ON products;
CREATE POLICY "anon_sel_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_products" ON products;
CREATE POLICY "anon_ins_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_products" ON products;
CREATE POLICY "anon_upd_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_products" ON products;
CREATE POLICY "anon_del_products" ON products FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- in | out | adjust | transfer
  qty numeric(14,2) NOT NULL,
  unit_cost numeric(14,2) DEFAULT 0,
  reason text,
  reference text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_sm" ON stock_movements;
CREATE POLICY "anon_sel_sm" ON stock_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_sm" ON stock_movements;
CREATE POLICY "anon_ins_sm" ON stock_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_sm" ON stock_movements;
CREATE POLICY "anon_upd_sm" ON stock_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_sm" ON stock_movements;
CREATE POLICY "anon_del_sm" ON stock_movements FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'particulier', -- particulier | entreprise
  email text,
  phone text,
  address text,
  city text,
  country text DEFAULT 'Maroc',
  tax_id text,
  balance numeric(14,2) DEFAULT 0,
  credit_limit numeric(14,2) DEFAULT 0,
  payment_terms text DEFAULT '30 jours',
  loyalty_points integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_customers" ON customers;
CREATE POLICY "anon_sel_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_customers" ON customers;
CREATE POLICY "anon_ins_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_customers" ON customers;
CREATE POLICY "anon_upd_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_customers" ON customers;
CREATE POLICY "anon_del_customers" ON customers FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  country text DEFAULT 'Maroc',
  tax_id text,
  balance numeric(14,2) DEFAULT 0,
  contact_person text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_suppliers" ON suppliers;
CREATE POLICY "anon_sel_suppliers" ON suppliers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_suppliers" ON suppliers;
CREATE POLICY "anon_ins_suppliers" ON suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_suppliers" ON suppliers;
CREATE POLICY "anon_upd_suppliers" ON suppliers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_suppliers" ON suppliers;
CREATE POLICY "anon_del_suppliers" ON suppliers FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- SALES DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  type text NOT NULL, -- quote | order | delivery | invoice | proforma | credit_note
  status text DEFAULT 'draft', -- draft | sent | validated | paid | partial | overdue | cancelled
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(14,2) DEFAULT 0,
  tax_amount numeric(14,2) DEFAULT 0,
  discount_amount numeric(14,2) DEFAULT 0,
  total numeric(14,2) DEFAULT 0,
  paid_amount numeric(14,2) DEFAULT 0,
  notes text,
  parent_id uuid REFERENCES sales_documents(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_sd" ON sales_documents;
CREATE POLICY "anon_sel_sd" ON sales_documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_sd" ON sales_documents;
CREATE POLICY "anon_ins_sd" ON sales_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_sd" ON sales_documents;
CREATE POLICY "anon_upd_sd" ON sales_documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_sd" ON sales_documents;
CREATE POLICY "anon_del_sd" ON sales_documents FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- SALES LINES
-- ============================================================
CREATE TABLE IF NOT EXISTS sales_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES sales_documents(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text,
  qty numeric(14,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 20.00,
  line_total numeric(14,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sales_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_sl" ON sales_lines;
CREATE POLICY "anon_sel_sl" ON sales_lines FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_sl" ON sales_lines;
CREATE POLICY "anon_ins_sl" ON sales_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_sl" ON sales_lines;
CREATE POLICY "anon_upd_sl" ON sales_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_sl" ON sales_lines;
CREATE POLICY "anon_del_sl" ON sales_lines FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  direction text NOT NULL, -- inbound | outbound
  party_type text NOT NULL, -- customer | supplier
  party_id uuid,
  document_id uuid REFERENCES sales_documents(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  method text NOT NULL, -- cash | card | check | transfer | mobile_money
  date date NOT NULL DEFAULT CURRENT_DATE,
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_pay" ON payments;
CREATE POLICY "anon_sel_pay" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_pay" ON payments;
CREATE POLICY "anon_ins_pay" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_pay" ON payments;
CREATE POLICY "anon_upd_pay" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_pay" ON payments;
CREATE POLICY "anon_del_pay" ON payments FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- PURCHASE DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  type text NOT NULL, -- order | receipt | invoice | credit_note | quote_request
  status text DEFAULT 'draft', -- draft | sent | received | paid | partial | cancelled
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric(14,2) DEFAULT 0,
  tax_amount numeric(14,2) DEFAULT 0,
  total numeric(14,2) DEFAULT 0,
  paid_amount numeric(14,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchase_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_pd" ON purchase_documents;
CREATE POLICY "anon_sel_pd" ON purchase_documents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_pd" ON purchase_documents;
CREATE POLICY "anon_ins_pd" ON purchase_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_pd" ON purchase_documents;
CREATE POLICY "anon_upd_pd" ON purchase_documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_pd" ON purchase_documents;
CREATE POLICY "anon_del_pd" ON purchase_documents FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- PURCHASE LINES
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES purchase_documents(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text,
  qty numeric(14,2) NOT NULL DEFAULT 1,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 20.00,
  line_total numeric(14,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchase_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_pl" ON purchase_lines;
CREATE POLICY "anon_sel_pl" ON purchase_lines FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_pl" ON purchase_lines;
CREATE POLICY "anon_ins_pl" ON purchase_lines FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_pl" ON purchase_lines;
CREATE POLICY "anon_upd_pl" ON purchase_lines FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_pl" ON purchase_lines;
CREATE POLICY "anon_del_pl" ON purchase_lines FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- stock_low | payment_late | expiry | new_subscription | info
  title text NOT NULL,
  message text,
  severity text DEFAULT 'info', -- info | warning | error | success
  read boolean DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_notif" ON notifications;
CREATE POLICY "anon_sel_notif" ON notifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_notif" ON notifications;
CREATE POLICY "anon_ins_notif" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_notif" ON notifications;
CREATE POLICY "anon_upd_notif" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_notif" ON notifications;
CREATE POLICY "anon_del_notif" ON notifications FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- sale | purchase | payment | stock | customer | product | system
  title text NOT NULL,
  description text,
  icon text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_act" ON activities;
CREATE POLICY "anon_sel_act" ON activities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_act" ON activities;
CREATE POLICY "anon_ins_act" ON activities FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_act" ON activities;
CREATE POLICY "anon_upd_act" ON activities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_act" ON activities;
CREATE POLICY "anon_del_act" ON activities FOR DELETE TO anon, authenticated USING (true);

-- ============================================================
-- SETTINGS (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text DEFAULT 'Ma Société',
  company_email text DEFAULT 'contact@societe.com',
  company_phone text DEFAULT '+212 5 22 00 00 00',
  company_address text DEFAULT 'Casablanca, Maroc',
  company_logo text,
  currency text DEFAULT 'MAD',
  currency_symbol text DEFAULT 'DH',
  default_tax_rate numeric(5,2) DEFAULT 20.00,
  invoice_prefix text DEFAULT 'FAC',
  quote_prefix text DEFAULT 'DEV',
  order_prefix text DEFAULT 'BC',
  delivery_prefix text DEFAULT 'BL',
  payment_prefix text DEFAULT 'REG',
  language text DEFAULT 'fr',
  theme text DEFAULT 'light',
  CONSTRAINT settings_singleton CHECK (id = 1)
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_settings" ON settings;
CREATE POLICY "anon_sel_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_settings" ON settings;
CREATE POLICY "anon_ins_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_settings" ON settings;
CREATE POLICY "anon_upd_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_settings" ON settings;
CREATE POLICY "anon_del_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_sd_customer ON sales_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_sd_type_status ON sales_documents(type, status);
CREATE INDEX IF NOT EXISTS idx_sd_date ON sales_documents(date);
CREATE INDEX IF NOT EXISTS idx_sl_document ON sales_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_pd_supplier ON purchase_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pl_document ON purchase_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_sm_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_pay_party ON payments(party_id);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_act_created ON activities(created_at DESC);