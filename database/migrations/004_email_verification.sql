-- Migration 004: email one-time codes for online bookings. Run once after 003 (safe to run again).
USE civil_registry;

CREATE TABLE IF NOT EXISTS email_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(160) NOT NULL,
  code_hash CHAR(64) NOT NULL,          -- HMAC of the code, never the code itself
  token_hash CHAR(64) NULL,             -- hash of the single-use booking token issued after a correct code
  attempts TINYINT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_created (email, created_at),
  INDEX idx_token (token_hash)
);
