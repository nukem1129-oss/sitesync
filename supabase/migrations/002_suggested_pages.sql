-- Add suggested_pages to sites table
-- Stores AI-suggested sub-pages from initial generation so they
-- persist across browser sessions until the user acts on them.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS suggested_pages JSONB DEFAULT '[]';
