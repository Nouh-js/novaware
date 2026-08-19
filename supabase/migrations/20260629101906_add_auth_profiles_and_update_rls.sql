/*
# Add Authentication: Profiles Table + Update RLS Policies

## Overview
Adds user authentication support to the ERP. This migration:
1. Creates a `profiles` table linked to Supabase Auth users
2. Creates a trigger to auto-create a profile when a new user signs up (first user gets 'admin', others get 'sales')
3. Updates ALL existing table policies from `TO anon, authenticated` → `TO authenticated`
   so only signed-in users can access company data

## New Tables
- `profiles`
  - `id` (uuid, PK, references auth.users)
  - `full_name` (text)
  - `role` (text, one of: admin | manager | sales | accountant | cashier | warehouse)
  - `avatar_url` (text, nullable)
  - `created_at` (timestamptz)

## Modified Tables
All 14 existing tables have their RLS policies updated to require authentication:
categories, brands, products, stock_movements, customers, suppliers,
sales_documents, sales_lines, payments, purchase_documents, purchase_lines,
notifications, activities, settings

## Security
- RLS enabled on profiles table
- Authenticated users can read all profiles (shared company context)
- Users can only insert/update/delete their own profile
- All existing tables now require authentication (anon access removed)
- New trigger: `on_auth_user_created` auto-creates profile row; first user = admin

## Important Notes
1. After this migration, the frontend MUST have a sign-in screen — unauthenticated
   requests will return no data from any table.
2. The first user to register via Supabase Auth will automatically receive the 'admin' role.
3. Subsequent users default to 'sales' role and can be promoted by an admin.
4. All policies use USING (true) / WITH CHECK (true) because this is a single-tenant app
   where all authenticated users share the company's data (no per-row ownership needed).
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'sales'
    CHECK (role IN ('admin', 'manager', 'sales', 'accountant', 'cashier', 'warehouse')),
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_sel_profiles" ON profiles;
CREATE POLICY "auth_sel_profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_ins_profiles" ON profiles;
CREATE POLICY "auth_ins_profiles" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "auth_upd_profiles" ON profiles;
CREATE POLICY "auth_upd_profiles" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "auth_del_profiles" ON profiles;
CREATE POLICY "auth_del_profiles" ON profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- ============================================================
-- TRIGGER: auto-create profile on new auth user
-- First user → admin; all others → sales
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'admin' ELSE 'sales' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- UPDATE RLS: CATEGORIES (anon → authenticated)
-- ============================================================
DROP POLICY IF EXISTS "anon_crud_categories" ON categories;
DROP POLICY IF EXISTS "anon_ins_categories" ON categories;
DROP POLICY IF EXISTS "anon_upd_categories" ON categories;
DROP POLICY IF EXISTS "anon_del_categories" ON categories;

CREATE POLICY "auth_sel_categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_categories" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_categories" ON categories FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: BRANDS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_brands" ON brands;
DROP POLICY IF EXISTS "anon_ins_brands" ON brands;
DROP POLICY IF EXISTS "anon_upd_brands" ON brands;
DROP POLICY IF EXISTS "anon_del_brands" ON brands;

CREATE POLICY "auth_sel_brands" ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_brands" ON brands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_brands" ON brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_brands" ON brands FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: PRODUCTS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_products" ON products;
DROP POLICY IF EXISTS "anon_ins_products" ON products;
DROP POLICY IF EXISTS "anon_upd_products" ON products;
DROP POLICY IF EXISTS "anon_del_products" ON products;

CREATE POLICY "auth_sel_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_products" ON products FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: STOCK_MOVEMENTS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "anon_ins_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "anon_upd_stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "anon_del_stock_movements" ON stock_movements;

CREATE POLICY "auth_sel_stock_mvt" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_stock_mvt" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_stock_mvt" ON stock_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_stock_mvt" ON stock_movements FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: CUSTOMERS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_customers" ON customers;
DROP POLICY IF EXISTS "anon_ins_customers" ON customers;
DROP POLICY IF EXISTS "anon_upd_customers" ON customers;
DROP POLICY IF EXISTS "anon_del_customers" ON customers;

CREATE POLICY "auth_sel_customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_customers" ON customers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: SUPPLIERS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_suppliers" ON suppliers;
DROP POLICY IF EXISTS "anon_ins_suppliers" ON suppliers;
DROP POLICY IF EXISTS "anon_upd_suppliers" ON suppliers;
DROP POLICY IF EXISTS "anon_del_suppliers" ON suppliers;

CREATE POLICY "auth_sel_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_suppliers" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_suppliers" ON suppliers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: SALES_DOCUMENTS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_sales_documents" ON sales_documents;
DROP POLICY IF EXISTS "anon_ins_sales_documents" ON sales_documents;
DROP POLICY IF EXISTS "anon_upd_sales_documents" ON sales_documents;
DROP POLICY IF EXISTS "anon_del_sales_documents" ON sales_documents;

CREATE POLICY "auth_sel_sales_docs" ON sales_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_sales_docs" ON sales_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_sales_docs" ON sales_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_sales_docs" ON sales_documents FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: SALES_LINES
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_sales_lines" ON sales_lines;
DROP POLICY IF EXISTS "anon_ins_sales_lines" ON sales_lines;
DROP POLICY IF EXISTS "anon_upd_sales_lines" ON sales_lines;
DROP POLICY IF EXISTS "anon_del_sales_lines" ON sales_lines;

CREATE POLICY "auth_sel_sales_lines" ON sales_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_sales_lines" ON sales_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_sales_lines" ON sales_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_sales_lines" ON sales_lines FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: PAYMENTS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_payments" ON payments;
DROP POLICY IF EXISTS "anon_ins_payments" ON payments;
DROP POLICY IF EXISTS "anon_upd_payments" ON payments;
DROP POLICY IF EXISTS "anon_del_payments" ON payments;

CREATE POLICY "auth_sel_payments" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_payments" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_payments" ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_payments" ON payments FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: PURCHASE_DOCUMENTS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_purchase_documents" ON purchase_documents;
DROP POLICY IF EXISTS "anon_ins_purchase_documents" ON purchase_documents;
DROP POLICY IF EXISTS "anon_upd_purchase_documents" ON purchase_documents;
DROP POLICY IF EXISTS "anon_del_purchase_documents" ON purchase_documents;

CREATE POLICY "auth_sel_purchase_docs" ON purchase_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_purchase_docs" ON purchase_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_purchase_docs" ON purchase_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_purchase_docs" ON purchase_documents FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: PURCHASE_LINES
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_purchase_lines" ON purchase_lines;
DROP POLICY IF EXISTS "anon_ins_purchase_lines" ON purchase_lines;
DROP POLICY IF EXISTS "anon_upd_purchase_lines" ON purchase_lines;
DROP POLICY IF EXISTS "anon_del_purchase_lines" ON purchase_lines;

CREATE POLICY "auth_sel_purchase_lines" ON purchase_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_purchase_lines" ON purchase_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_purchase_lines" ON purchase_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_purchase_lines" ON purchase_lines FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: NOTIFICATIONS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_ins_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_upd_notifications" ON notifications;
DROP POLICY IF EXISTS "anon_del_notifications" ON notifications;

CREATE POLICY "auth_sel_notifications" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_notifications" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_notifications" ON notifications FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: ACTIVITIES
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_activities" ON activities;
DROP POLICY IF EXISTS "anon_ins_activities" ON activities;
DROP POLICY IF EXISTS "anon_upd_activities" ON activities;
DROP POLICY IF EXISTS "anon_del_activities" ON activities;

CREATE POLICY "auth_sel_activities" ON activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_activities" ON activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_activities" ON activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_activities" ON activities FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATE RLS: SETTINGS
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_settings" ON settings;
DROP POLICY IF EXISTS "anon_ins_settings" ON settings;
DROP POLICY IF EXISTS "anon_upd_settings" ON settings;
DROP POLICY IF EXISTS "anon_del_settings" ON settings;

CREATE POLICY "auth_sel_settings" ON settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_ins_settings" ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_upd_settings" ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_del_settings" ON settings FOR DELETE TO authenticated USING (true);
