-- ============================================================
-- InvoiceAI Dashboard – initial schema
-- Czech market: IČO, DIČ, DUZP, DPH, variabilní symbol, CZK
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------
-- PROFILES  (extends Supabase auth.users)
-- ----------------------------------------------------------
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  company_name TEXT,
  ico         TEXT,                          -- IČO firmy klienta
  dic         TEXT,                          -- DIČ firmy klienta
  plan        TEXT NOT NULL DEFAULT 'starter', -- starter | pro | enterprise
  invoices_this_month INT NOT NULL DEFAULT 0,
  invoices_limit      INT NOT NULL DEFAULT 50,  -- limit per billing cycle
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own profile"  ON profiles FOR ALL USING (auth.uid() = id);

-- ----------------------------------------------------------
-- EMAIL CONNECTIONS
-- ----------------------------------------------------------
CREATE TABLE email_connections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider       TEXT NOT NULL,        -- gmail | imap | outlook | seznam
  email_address  TEXT NOT NULL,
  -- OAuth tokens (Gmail / Outlook)
  access_token   TEXT,                 -- store encrypted in production
  refresh_token  TEXT,
  token_expiry   TIMESTAMPTZ,
  -- IMAP credentials (Seznam, custom hosting)
  imap_host      TEXT,
  imap_port      INT,
  imap_username  TEXT,
  imap_password  TEXT,                 -- store encrypted in production
  imap_use_ssl   BOOLEAN DEFAULT TRUE,
  -- State
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  last_checked_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own email connections"
  ON email_connections FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------
-- CRM / ACCOUNTING CONNECTIONS
-- ----------------------------------------------------------
CREATE TABLE crm_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Type: pohoda | fakturoid | idoklad | money_s3 | raynet
  crm_type        TEXT NOT NULL,
  display_name    TEXT,
  -- Generic API credentials
  api_key         TEXT,                -- encrypted
  api_url         TEXT,
  api_secret      TEXT,                -- encrypted (some CRMs need key+secret)
  -- Pohoda specific
  pohoda_version  TEXT,                -- 'xml' | 'mserver'
  pohoda_xml_import_path TEXT,         -- local path for XML drop
  pohoda_ico      TEXT,                -- IČO of the Pohoda company database
  -- Fakturoid specific
  fakturoid_slug  TEXT,                -- account slug in URL
  -- iDoklad specific
  idoklad_client_id TEXT,
  -- Money S3/S5 specific
  money_export_format TEXT,            -- 'xml' | 'csv'
  -- State
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own CRM connections"
  ON crm_connections FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------
-- INVOICES  (core table – all Czech-specific fields)
-- ----------------------------------------------------------
CREATE TABLE invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email_connection_id UUID REFERENCES email_connections(id) ON DELETE SET NULL,
  crm_connection_id   UUID REFERENCES crm_connections(id) ON DELETE SET NULL,

  -- Source email metadata
  email_message_id    TEXT,            -- RFC 2822 Message-ID (dedup)
  email_subject       TEXT,
  email_from          TEXT,
  email_received_at   TIMESTAMPTZ,
  attachment_filename TEXT,
  attachment_type     TEXT,            -- pdf | jpg | png | tiff | isdoc

  -- ── Supplier (Dodavatel) ──────────────────────────────
  supplier_name       TEXT,
  supplier_ico        TEXT,            -- IČO: 8 digits
  supplier_dic        TEXT,            -- DIČ: CZ + 8-10 digits
  supplier_address    TEXT,
  supplier_city       TEXT,
  supplier_zip        TEXT,

  -- ── Invoice header ───────────────────────────────────
  invoice_number      TEXT,
  invoice_date        DATE,            -- Datum vystavení
  duzp                DATE,            -- Datum uskutečnění zdanitelného plnění (≠ invoice_date!)
  due_date            DATE,            -- Datum splatnosti

  -- ── Amounts ─────────────────────────────────────────
  currency            TEXT NOT NULL DEFAULT 'CZK',
  amount_without_vat  NUMERIC(14,2),   -- Základ DPH
  vat_amount          NUMERIC(14,2),   -- DPH celkem
  amount_total        NUMERIC(14,2),   -- Celková částka včetně DPH

  -- DPH breakdown (Czech has multiple rates on one invoice)
  dph_lines           JSONB,           -- [{base, rate, vat_amount}, ...] e.g. 21%, 12%, 0%

  -- ── Payment info ─────────────────────────────────────
  variable_symbol     TEXT,            -- Variabilní symbol (VS)
  constant_symbol     TEXT,            -- Konstantní symbol (KS)
  specific_symbol     TEXT,            -- Specifický symbol (SS)
  bank_account_cz     TEXT,            -- Czech format: 123456789/0800
  iban                TEXT,
  swift               TEXT,
  payment_method      TEXT,            -- prevod | hotovost | karta

  -- ── ARES validation ──────────────────────────────────
  ares_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  ares_company_name   TEXT,            -- Name returned by ARES
  ares_address        TEXT,
  ares_dic            TEXT,
  ares_data           JSONB,           -- Full ARES API response

  -- ── Raw AI extraction ────────────────────────────────
  raw_extraction      JSONB,           -- Full GPT response before mapping
  extraction_model    TEXT,            -- gpt-4o | gpt-4o-mini
  extraction_tokens   INT,

  -- ── CRM sync ─────────────────────────────────────────
  crm_record_id       TEXT,            -- ID of created record in CRM
  crm_synced_at       TIMESTAMPTZ,

  -- ── Status ───────────────────────────────────────────
  -- pending | processing | extracted | ares_checked | crm_sent | error | ignored
  status              TEXT NOT NULL DEFAULT 'pending',
  error_message       TEXT,
  retry_count         INT NOT NULL DEFAULT 0,

  processed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own invoices"
  ON invoices FOR ALL USING (auth.uid() = user_id);

-- Prevent duplicate processing of the same email attachment
CREATE UNIQUE INDEX invoices_email_dedup
  ON invoices (user_id, email_message_id, attachment_filename)
  WHERE email_message_id IS NOT NULL;

-- ----------------------------------------------------------
-- PROCESSING LOGS  (audit trail)
-- ----------------------------------------------------------
CREATE TABLE processing_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_id  UUID REFERENCES invoices(id) ON DELETE CASCADE,
  -- Action types:
  -- email_received | extraction_started | extraction_done
  -- ares_lookup | ares_verified | crm_push | crm_success | error | retry
  action      TEXT NOT NULL,
  status      TEXT NOT NULL,   -- success | error | info | warning
  message     TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own logs"
  ON processing_logs FOR ALL USING (auth.uid() = user_id);

CREATE INDEX logs_invoice_idx ON processing_logs (invoice_id);
CREATE INDEX logs_user_idx    ON processing_logs (user_id, created_at DESC);

-- ----------------------------------------------------------
-- HELPER: auto-update updated_at
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------
-- HELPER: auto-create profile after signup
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
