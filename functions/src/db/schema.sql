-- Equipment Rental CRM - Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment catalog
CREATE TABLE IF NOT EXISTS equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100) DEFAULT 'general',
  quantity INTEGER DEFAULT 1,
  price_per_day DECIMAL(10,2) DEFAULT 0,
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  shelf_location VARCHAR(100) DEFAULT '',
  shelf_row VARCHAR(100) DEFAULT '',
  damaged_qty INTEGER DEFAULT 0,
  wp_product_id INTEGER,
  last_synced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255) DEFAULT '',
  email VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name VARCHAR(255) DEFAULT '',
  event_name VARCHAR(255) DEFAULT '',
  location TEXT DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  payment_method VARCHAR(100) DEFAULT '',
  discount_type VARCHAR(20) DEFAULT 'percent',
  discount_value DECIMAL(10,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items (equipment lines in an order)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL,
  equipment_name VARCHAR(255) NOT NULL,
  equipment_sku VARCHAR(100) DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  price_per_day DECIMAL(10,2) NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_dates ON orders(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_equipment_id ON order_items(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_sku ON equipment(sku);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON equipment
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fixed (recurring) expenses
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  frequency VARCHAR(20) DEFAULT 'monthly',  -- monthly | quarterly | annual
  category VARCHAR(100) DEFAULT 'כללי',
  notes TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variable (one-time) expenses
CREATE TABLE IF NOT EXISTS variable_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  category VARCHAR(100) DEFAULT 'כללי',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Return logs — saved when a return form is submitted
CREATE TABLE IF NOT EXISTS return_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_number VARCHAR(50),
  client_name  VARCHAR(255),
  equipment_name VARCHAR(255),
  ordered_qty INTEGER,
  returned_qty INTEGER,
  condition VARCHAR(50) DEFAULT 'ok',  -- ok | damaged | missing
  notes TEXT DEFAULT '',
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON fixed_expenses(active);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_date ON variable_expenses(date);
CREATE INDEX IF NOT EXISTS idx_return_logs_order ON return_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_return_logs_condition ON return_logs(condition);

DO $$ BEGIN
  CREATE TRIGGER trg_fixed_expenses_updated_at BEFORE UPDATE ON fixed_expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Imported finance workbook data
CREATE TABLE IF NOT EXISTS finance_income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row INTEGER NOT NULL UNIQUE,
  delivery_date DATE,
  payment_date DATE,
  client_name VARCHAR(255) DEFAULT '',
  amount_before_vat DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  payment_type VARCHAR(255) DEFAULT '',
  return_status VARCHAR(100) DEFAULT '',
  notes TEXT DEFAULT '',
  linked_expenses TEXT DEFAULT '',
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_open_payment_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row INTEGER NOT NULL UNIQUE,
  entry_date DATE,
  entry_date_raw VARCHAR(50) DEFAULT '',
  client_name VARCHAR(255) DEFAULT '',
  amount_before_vat DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  payment_type VARCHAR(255) DEFAULT '',
  return_status VARCHAR(100) DEFAULT '',
  notes TEXT DEFAULT '',
  linked_expenses TEXT DEFAULT '',
  balance DECIMAL(12,2) DEFAULT 0,
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_shortage_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row INTEGER NOT NULL UNIQUE,
  entry_date DATE,
  entry_date_raw VARCHAR(50) DEFAULT '',
  client_name VARCHAR(255) DEFAULT '',
  amount_before_vat DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  payment_type VARCHAR(255) DEFAULT '',
  return_status VARCHAR(100) DEFAULT '',
  notes TEXT DEFAULT '',
  linked_expenses TEXT DEFAULT '',
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_fixed_expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row INTEGER NOT NULL,
  month_date DATE NOT NULL,
  month_label VARCHAR(100) NOT NULL,
  category VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_row, category)
);

CREATE TABLE IF NOT EXISTS finance_variable_expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row INTEGER NOT NULL UNIQUE,
  entry_date DATE,
  category VARCHAR(255) DEFAULT '',
  name VARCHAR(255) DEFAULT '',
  amount DECIMAL(12,2) DEFAULT 0,
  amount_after_vat DECIMAL(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_year INTEGER NOT NULL,
  summary_month INTEGER NOT NULL,
  month_label VARCHAR(100) NOT NULL,
  revenue DECIMAL(12,2) DEFAULT 0,
  fixed_expenses DECIMAL(12,2) DEFAULT 0,
  variable_expenses DECIMAL(12,2) DEFAULT 0,
  profit DECIMAL(12,2) DEFAULT 0,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (summary_year, summary_month)
);

CREATE INDEX IF NOT EXISTS idx_finance_income_payment_date ON finance_income_entries(payment_date);
CREATE INDEX IF NOT EXISTS idx_finance_income_delivery_date ON finance_income_entries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_finance_open_payments_date ON finance_open_payment_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_shortages_date ON finance_shortage_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_fixed_expense_month ON finance_fixed_expense_entries(month_date);
CREATE INDEX IF NOT EXISTS idx_finance_variable_expense_date ON finance_variable_expense_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_monthly_summaries_year_month ON finance_monthly_summaries(summary_year, summary_month);

ALTER TABLE finance_open_payment_entries ADD COLUMN IF NOT EXISTS entry_date_raw VARCHAR(50) DEFAULT '';
ALTER TABLE finance_shortage_entries ADD COLUMN IF NOT EXISTS entry_date_raw VARCHAR(50) DEFAULT '';
