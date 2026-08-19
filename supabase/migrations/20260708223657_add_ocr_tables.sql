-- OCR Quota tracking (per user per day)
CREATE TABLE IF NOT EXISTS ocr_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Scanned invoices storage
CREATE TABLE IF NOT EXISTS scanned_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name TEXT,
  supplier_tax_id TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  currency TEXT DEFAULT 'MAD',
  total_ht DECIMAL(12,2) DEFAULT 0,
  total_tva DECIMAL(12,2) DEFAULT 0,
  total_ttc DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  raw_response JSONB,
  file_name TEXT,
  file_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scanned invoice lines
CREATE TABLE IF NOT EXISTS scanned_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scanned_invoice_id UUID NOT NULL REFERENCES scanned_invoices(id) ON DELETE CASCADE,
  reference TEXT,
  description TEXT,
  qty DECIMAL(10,2) DEFAULT 0,
  unit TEXT,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  discount DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2) DEFAULT 0,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ocr_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanned_invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ocr_quota
CREATE POLICY "select_own_quota" ON ocr_quota FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_quota" ON ocr_quota FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_quota" ON ocr_quota FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS Policies for scanned_invoices
CREATE POLICY "select_own_scanned" ON scanned_invoices FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_scanned" ON scanned_invoices FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_scanned" ON scanned_invoices FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_scanned" ON scanned_invoices FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for scanned_invoice_lines
CREATE POLICY "select_own_lines" ON scanned_invoice_lines FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM scanned_invoices WHERE scanned_invoices.id = scanned_invoice_lines.scanned_invoice_id AND scanned_invoices.user_id = auth.uid())
  );
CREATE POLICY "insert_own_lines" ON scanned_invoice_lines FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM scanned_invoices WHERE scanned_invoices.id = scanned_invoice_lines.scanned_invoice_id AND scanned_invoices.user_id = auth.uid())
  );
CREATE POLICY "update_own_lines" ON scanned_invoice_lines FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM scanned_invoices WHERE scanned_invoices.id = scanned_invoice_lines.scanned_invoice_id AND scanned_invoices.user_id = auth.uid())
  );
CREATE POLICY "delete_own_lines" ON scanned_invoice_lines FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM scanned_invoices WHERE scanned_invoices.id = scanned_invoice_lines.scanned_invoice_id AND scanned_invoices.user_id = auth.uid())
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_ocr_quota_user_date ON ocr_quota(user_id, date);
CREATE INDEX IF NOT EXISTS idx_scanned_invoices_user ON scanned_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_scanned_invoice_lines_invoice ON scanned_invoice_lines(scanned_invoice_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_ocr_quota_updated_at ON ocr_quota;
CREATE TRIGGER update_ocr_quota_updated_at BEFORE UPDATE ON ocr_quota
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scanned_invoices_updated_at ON scanned_invoices;
CREATE TRIGGER update_scanned_invoices_updated_at BEFORE UPDATE ON scanned_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
