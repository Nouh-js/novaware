-- Extend settings table with full company legal + bank info and document template fields
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS company_rc text,
  ADD COLUMN IF NOT EXISTS company_ice text,
  ADD COLUMN IF NOT EXISTS company_if text,
  ADD COLUMN IF NOT EXISTS company_patente text,
  ADD COLUMN IF NOT EXISTS company_cnss text,
  ADD COLUMN IF NOT EXISTS company_rib text,
  ADD COLUMN IF NOT EXISTS company_iban text,
  ADD COLUMN IF NOT EXISTS company_bank_name text,
  ADD COLUMN IF NOT EXISTS company_signature text,
  ADD COLUMN IF NOT EXISTS company_stamp text,
  ADD COLUMN IF NOT EXISTS doc_template text DEFAULT 'classic';
