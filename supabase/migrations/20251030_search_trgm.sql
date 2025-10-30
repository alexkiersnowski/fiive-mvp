-- Enable pg_trgm extension idempotently
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional base filter index to aid scans on active rows
CREATE INDEX IF NOT EXISTS requests_conn_not_deleted_idx
  ON public.requests (connection_id)
  WHERE deleted_at IS NULL;

-- Trigram indexes for fast ILIKE on title and type (case-insensitive ILIKE supported)
CREATE INDEX IF NOT EXISTS requests_title_trgm_idx
  ON public.requests USING gin (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS requests_type_trgm_idx
  ON public.requests USING gin (type gin_trgm_ops)
  WHERE deleted_at IS NULL;


