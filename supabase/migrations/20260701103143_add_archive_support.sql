-- Add archived_at column to all main tables for soft-delete (archive) support

ALTER TABLE products ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
ALTER TABLE sales_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;
ALTER TABLE purchase_documents ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- Add letterhead column to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS company_letterhead text DEFAULT NULL;
