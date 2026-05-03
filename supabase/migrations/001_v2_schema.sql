-- ============================================================
-- SiteSync v2 Schema Migration
-- Run this in the Supabase SQL editor
-- ============================================================

-- Drop old table (migrate scene-engineering content after)
DROP TABLE IF EXISTS authorized_editors CASCADE;
DROP TABLE IF EXISTS websites CASCADE;

-- ── SITES ────────────────────────────────────────────────────
CREATE TABLE sites (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL REFERENCES auth.users(id),
  subdomain            text NOT NULL UNIQUE,
  custom_domain        text UNIQUE,
  name                 text NOT NULL,
  theme                jsonb NOT NULL DEFAULT '{}',
  authorized_senders   text[] NOT NULL DEFAULT '{}',
  update_email         text,
  form_recipient_email text,
  tier                 text NOT NULL DEFAULT 'starter'
                       CHECK (tier IN ('starter', 'professional', 'elite')),
  status               text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'suspended', 'building')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── PAGES ────────────────────────────────────────────────────
CREATE TABLE pages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slug             text NOT NULL,
  title            text NOT NULL,
  nav_label        text,
  nav_order        int  NOT NULL DEFAULT 0,
  is_homepage      boolean NOT NULL DEFAULT false,
  page_css         text,
  page_js          text,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  published        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug)
);

-- ── SECTIONS ─────────────────────────────────────────────────
CREATE TABLE sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type        text NOT NULL,
  order_index int  NOT NULL DEFAULT 0,
  label       text,
  content     jsonb NOT NULL DEFAULT '{}',
  section_css text,
  section_js  text,
  published   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── ASSETS ───────────────────────────────────────────────────
CREATE TABLE assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  owner_id     uuid NOT NULL REFERENCES auth.users(id),
  type         text NOT NULL CHECK (type IN ('image','logo','font','document','favicon')),
  label        text NOT NULL,
  filename     text NOT NULL,
  storage_path text NOT NULL,
  public_url   text NOT NULL,
  width        int,
  height       int,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── VERSIONS ─────────────────────────────────────────────────
CREATE TABLE versions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id              uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id              uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  sections_snapshot    jsonb NOT NULL,
  trigger              text NOT NULL CHECK (trigger IN ('email_update','manual_edit','initial_generation')),
  triggered_by         text,
  update_instructions  text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── FORM SUBMISSIONS ─────────────────────────────────────────
CREATE TABLE form_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id          uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  section_id       uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  data             jsonb NOT NULL,
  signature_data   text,
  submitter_ip     text,
  submitter_email  text,
  email_sent       boolean NOT NULL DEFAULT false,
  email_sent_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── AUTHORIZED EDITORS ───────────────────────────────────────
CREATE TABLE authorized_editors (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id  uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email    text NOT NULL,
  label    text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, email)
);

-- ── UPDATED_AT TRIGGERS ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sites_updated_at    BEFORE UPDATE ON sites    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pages_updated_at    BEFORE UPDATE ON pages    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sections_updated_at BEFORE UPDATE ON sections FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_sites_owner        ON sites(owner_id);
CREATE INDEX idx_sites_subdomain    ON sites(subdomain);
CREATE INDEX idx_pages_site         ON pages(site_id);
CREATE INDEX idx_sections_page      ON sections(page_id, order_index);
CREATE INDEX idx_sections_site      ON sections(site_id);
CREATE INDEX idx_assets_site        ON assets(site_id);
CREATE INDEX idx_versions_page      ON versions(page_id, created_at DESC);
CREATE INDEX idx_submissions_site   ON form_submissions(site_id, created_at DESC);
CREATE INDEX idx_editors_site_email ON authorized_editors(site_id, email);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE sites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections           ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_editors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner" ON sites              USING (owner_id = auth.uid());
CREATE POLICY "owner" ON pages              USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));
CREATE POLICY "owner" ON sections           USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));
CREATE POLICY "owner" ON assets             USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));
CREATE POLICY "owner" ON versions           USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));
CREATE POLICY "owner" ON form_submissions   USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));
CREATE POLICY "owner" ON authorized_editors USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));

-- Public read for form_submissions insert (needed for site visitors submitting forms)
CREATE POLICY "public_insert" ON form_submissions FOR INSERT WITH CHECK (true);

-- ── HTML CACHE ────────────────────────────────────────────────
-- Stores the rendered HTML for each site for fast serving by the middleware
CREATE TABLE site_html_cache (
  site_id      uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  subdomain    text NOT NULL UNIQUE,
  html_content text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_html_cache_subdomain ON site_html_cache(subdomain);

-- Service role can read/write; no user-level RLS needed (server-only)
ALTER TABLE site_html_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON site_html_cache USING (false); -- only service_role key bypasses this

-- ── HTML CACHE ────────────────────────────────────────────────
-- Stores rendered HTML per site for fast serving by the middleware.
-- Written by /api/generate and /api/email-update after every render.
CREATE TABLE site_html_cache (
  site_id      uuid PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  subdomain    text NOT NULL UNIQUE,
  html_content text NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_html_cache_subdomain ON site_html_cache(subdomain);

-- Service role bypasses RLS; anonymous users cannot read/write directly
ALTER TABLE site_html_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON site_html_cache USING (false);
