-- ZKAEDI Legal Clause Classifier — D1 Schema
-- Run: wrangler d1 execute legal-clauses-db --file=schema.sql

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  upload_date TEXT NOT NULL,
  labeled_by TEXT,
  label_status TEXT DEFAULT 'pending',
  clause_count INTEGER DEFAULT 0
);

-- Clauses table (the actual training data)
CREATE TABLE IF NOT EXISTS clauses (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  clause_text TEXT NOT NULL,
  clause_type TEXT NOT NULL,
  risk_severity TEXT NOT NULL,
  market_standard BOOLEAN DEFAULT true,
  negotiability TEXT DEFAULT 'medium',
  missing_protections TEXT,
  drafting_style TEXT,
  h0_base_energy REAL,
  energy_amplification_factor REAL,
  lyapunov_exponent REAL,
  energy_at_trigger REAL,
  jurisdiction TEXT,
  labeled_by TEXT NOT NULL,
  confidence REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

-- Labeler accounts
CREATE TABLE IF NOT EXISTS labelers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  clauses_labeled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Export history
CREATE TABLE IF NOT EXISTS exports (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  row_count INTEGER,
  created_at TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_clauses_contract_id ON clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_clauses_clause_type ON clauses(clause_type);
CREATE INDEX IF NOT EXISTS idx_clauses_labeled_by ON clauses(labeled_by);
CREATE INDEX IF NOT EXISTS idx_clauses_created_at ON clauses(created_at);
CREATE INDEX IF NOT EXISTS idx_contracts_label_status ON contracts(label_status);
