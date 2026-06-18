-- ============================================================
-- MedChain Healthcare System — Database Schema
-- SHA-256 integrity + chained audit trail
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(150) UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           VARCHAR(20) NOT NULL CHECK (role IN ('patient','doctor','admin')),
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- ── Health Records ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  record_data    JSONB NOT NULL,       -- encrypted/serialized record
  record_hash    TEXT NOT NULL,        -- SHA-256 of record_data
  created_by     UUID REFERENCES users(id),
  is_verified    BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- ── Chained Audit Logs ─────────────────────────────────────
-- Each entry hashes itself + the previous entry's hash,
-- creating a tamper-evident chain (like a mini blockchain).
CREATE TABLE IF NOT EXISTS audit_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id),
  action             VARCHAR(60) NOT NULL,
  record_id          UUID,
  ip_address         VARCHAR(60),
  previous_log_hash  TEXT NOT NULL,   -- hash of previous log entry
  current_log_hash   TEXT NOT NULL,   -- SHA-256(this entry + previous hash)
  metadata           JSONB,
  timestamp          TIMESTAMP DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_records_patient  ON health_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_records_created  ON health_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp  ON audit_logs(timestamp DESC);
