-- Add additional transaction types that Sleeper uses
-- PostgreSQL requires adding values one at a time to an existing enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'commissioner';
