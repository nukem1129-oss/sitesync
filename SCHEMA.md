# SiteSync v2 — Full Database Schema

## Overview

Content is stored as structured JSON, never as raw HTML. The renderer
combines content + theme + templates to produce HTML on demand. Claude
only ever sees and writes to the section(s) being updated — never the
full site.

---

## Tables

### `sites`
The top-level record for each client website.

```sql
CREATE TABLE sites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES auth.users(id),
  subdomain       text NOT NULL UNIQUE,
  custom_domain   text UNIQUE,
  name            text NOT NULL,

  -- Branding & theme (global, applies to all pages)
  theme           jsonb NOT NULL DEFAULT '{}',
  -- theme shape:
  -- {
  --   colors: { primary, secondary, accent, background, text, muted },
  --   fonts:  { heading, body, mono },
  --   spacing: { section_padding, container_max_width },
  --   global_css: "/* custom overrides */"
  -- }

  -- Email update config
  authorized_senders  text[] NOT NULL DEFAULT '{}',
  update_email        text,   -- e.g. update+my-business@mg.sceneengineering.com

  -- Form submission recipient (defaults to owner email if null)
  form_recipient_email text,

  -- Tier controls what features are available
  tier            text NOT NULL DEFAULT 'starter'
                  CHECK (tier IN ('starter', 'professional', 'elite')),

  -- Status
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended', 'building')),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

---

### `pages`
Each site has one or more pages. Starter = 1 page max, Professional = 5, Elite = unlimited.

```sql
CREATE TABLE pages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slug        text NOT NULL,   -- 'home', 'about', 'services', 'contact', etc.
  title       text NOT NULL,   -- used in <title> and nav
  nav_label   text,            -- label shown in navigation (if null, uses title)
  nav_order   int  NOT NULL DEFAULT 0,
  is_homepage boolean NOT NULL DEFAULT false,

  -- Page-level CSS scoped to this page only
  page_css    text,

  -- Page-level JS (runs on this page only)
  page_js     text,

  -- SEO
  meta_title       text,
  meta_description text,
  og_image_url     text,

  -- Visibility
  published   boolean NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (site_id, slug)
);
```

---

### `sections`
Each page is made of ordered sections. This is where all content lives.

```sql
CREATE TABLE sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id     uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  -- Section identity
  type        text NOT NULL,
  -- Allowed types:
  --   hero | nav | services | about | team | testimonials |
  --   gallery | pricing | faq | cta | contact_info |
  --   form | text_block | image_block | video_embed |
  --   map | hours | custom

  order_index int NOT NULL DEFAULT 0,
  label       text,   -- internal label, e.g. "Main Hero", "Quote Form"

  -- All section content as structured JSON (type-specific shape)
  content     jsonb NOT NULL DEFAULT '{}',

  -- Scoped styles & behavior
  section_css text,
  section_js  text,

  -- Visibility
  published   boolean NOT NULL DEFAULT true,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

#### Section content shapes by type

**hero**
```json
{
  "headline": "Your business deserves a professional website.",
  "subheadline": "Live within 24 hours.",
  "cta_primary":   { "label": "Get Started", "href": "#contact" },
  "cta_secondary": { "label": "See Our Work", "href": "#services" },
  "background_image_asset_id": "uuid | null",
  "overlay_opacity": 0.5
}
```

**services**
```json
{
  "heading": "What We Offer",
  "subheading": "...",
  "items": [
    {
      "title": "Emergency Repairs",
      "description": "...",
      "icon": "wrench",
      "image_asset_id": "uuid | null"
    }
  ]
}
```

**form**
```json
{
  "heading": "Get In Touch",
  "subheading": "We'll get back to you within 24 hours.",
  "recipient_email": "owner@example.com",
  "reply_to_field": "email",
  "submit_label": "Send Message",
  "success_message": "Thanks! We'll be in touch shortly.",
  "fields": [
    { "id": "name",      "type": "text",      "label": "Full Name",     "required": true  },
    { "id": "email",     "type": "email",     "label": "Email Address", "required": true  },
    { "id": "phone",     "type": "tel",       "label": "Phone Number",  "required": false },
    { "id": "service",   "type": "select",    "label": "Service",       "required": true,
      "options": ["Repair", "Installation", "Consultation"] },
    { "id": "message",   "type": "textarea",  "label": "Message",       "required": true  },
    { "id": "signature", "type": "signature", "label": "Signature",     "required": false },
    { "id": "agree",     "type": "checkbox",  "label": "I agree to the terms", "required": true }
  ],
  "honeypot_field": "website",
  "store_submissions": true
}
```

**testimonials**
```json
{
  "heading": "What Our Clients Say",
  "items": [
    {
      "name": "Jane Smith",
      "company": "Smith Hardware",
      "quote": "...",
      "rating": 5,
      "avatar_asset_id": "uuid | null"
    }
  ]
}
```

**hours**
```json
{
  "heading": "Business Hours",
  "timezone": "America/Chicago",
  "hours": {
    "monday":    { "open": "09:00", "close": "17:00", "closed": false },
    "tuesday":   { "open": "09:00", "close": "17:00", "closed": false },
    "wednesday": { "open": "09:00", "close": "17:00", "closed": false },
    "thursday":  { "open": "09:00", "close": "17:00", "closed": false },
    "friday":    { "open": "09:00", "close": "17:00", "closed": false },
    "saturday":  { "open": "10:00", "close": "14:00", "closed": false },
    "sunday":    { "open": null,    "close": null,    "closed": true  }
  },
  "holiday_note": "Closed Thanksgiving and Christmas Day"
}
```

---

### `assets`
Images, logos, fonts, and documents uploaded for a site.

```sql
CREATE TABLE assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES auth.users(id),

  type          text NOT NULL
                CHECK (type IN ('image', 'logo', 'font', 'document', 'favicon')),

  label         text NOT NULL,   -- "Company Logo", "Hero Background", etc.
  filename      text NOT NULL,   -- original filename
  storage_path  text NOT NULL,   -- path in Supabase Storage bucket
  public_url    text NOT NULL,   -- CDN URL used in HTML/CSS

  -- Image metadata
  width         int,
  height        int,
  mime_type     text,
  size_bytes    bigint,

  created_at    timestamptz NOT NULL DEFAULT now()
);
```

---

### `versions`
Snapshot of all sections for a page before any update. Enables rollback.

```sql
CREATE TABLE versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id       uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,

  -- Snapshot of sections array at time of version
  sections_snapshot  jsonb NOT NULL,

  -- What triggered this version
  trigger       text NOT NULL
                CHECK (trigger IN ('email_update', 'manual_edit', 'initial_generation')),
  triggered_by  text,   -- email address or user id

  -- Update instructions that produced this change (for audit trail)
  update_instructions text,

  created_at    timestamptz NOT NULL DEFAULT now()
);
```

---

### `form_submissions`
Stores form submissions for clients on Professional/Elite tiers.

```sql
CREATE TABLE form_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id       uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  section_id    uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,

  -- Submitted field values (keyed by field id)
  data          jsonb NOT NULL,

  -- Signature stored as base64 data URL if present
  signature_data text,

  -- Submitter info
  submitter_ip    text,
  submitter_email text,   -- pulled from whichever field is reply_to_field

  -- Email delivery
  email_sent      boolean NOT NULL DEFAULT false,
  email_sent_at   timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

### `authorized_editors`
People (beyond the owner) who can trigger email updates for a site.

```sql
CREATE TABLE authorized_editors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  email       text NOT NULL,
  label       text,   -- "Marketing Manager", "Office Admin", etc.
  added_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (site_id, email)
);
```

---

## RLS Policies

```sql
-- Sites: owner access only
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON sites
  USING (owner_id = auth.uid());

-- Pages, sections, assets, versions, submissions: via site ownership
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON pages
  USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON sections
  USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON assets
  USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));

ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON versions
  USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON form_submissions
  USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));

ALTER TABLE authorized_editors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON authorized_editors
  USING (site_id IN (SELECT id FROM sites WHERE owner_id = auth.uid()));
```

---

## Supabase Storage Buckets

```
site-assets/
  {site_id}/
    images/
    logos/
    fonts/
    documents/
    favicon/
```

Bucket policy: authenticated upload (owner only), public read.

---

## How generation works (v2)

1. User fills out new site form (business name, description, pages wanted, tone)
2. `/api/generate` sends a compact prompt to Claude asking for structured JSON output
3. Claude returns a full site JSON: theme + array of pages, each with ordered sections
4. System saves: one `sites` row, N `pages` rows, M `sections` rows per page
5. Renderer builds HTML on demand from sections + theme — no HTML stored anywhere
6. Initial version snapshot saved to `versions`

## How updates work (v2)

1. Authorized email arrives at Mailgun → `/api/email-update`
2. System identifies which page(s) and section(s) the instruction affects
3. Fetches ONLY those sections from Supabase (50-200 tokens of context)
4. Sends Claude: current section JSON + update instruction
5. Claude returns updated section JSON
6. System saves version snapshot, then updates the section row
7. Confirmation email sent to sender
