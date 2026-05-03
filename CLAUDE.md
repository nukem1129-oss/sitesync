# SiteSync

SiteSync is a Next.js 16 application that serves as both a dashboard for managing client websites and a dynamic hosting platform. Client websites are stored as raw HTML in Supabase and served via subdomain routing.

## Critical rules

### File size limits
- **No file may exceed 300 lines.** If a file approaches 250 lines, proactively split it.
- Components: one component per file, max 150 lines. Extract hooks, utils, and sub-components.
- API routes/endpoints: one route handler per file, max 200 lines. Extract service logic.
- Utility files: max 200 lines. Group by domain, not by type.

### Architecture enforcement
- **Layered architecture required:**
  - Components import from hooks only (never direct API calls in components)
  - Hooks manage UI state and call services
  - Services compose API calls (stateless, pure logic)
  - API layer wraps transport and returns typed data
- **No god files.** No utils.ts, no helpers.ts, no constants.ts that catches everything. Name files by what they do: `dateFormatting.ts`, `priceCalculation.ts`, `validationRules.ts`.
- **One export focus per file.** A file named `UserCard.tsx` exports `UserCard`. If it needs a skeleton loader, that goes in `UserCardSkeleton.tsx`.

### Code style
- TypeScript strict mode. No `any` types. No `// @ts-ignore`.
- Async/await everywhere. No raw promises with `.then()` chains.
- Named exports over default exports (except page/layout components if Next.js requires it).
- Destructure props. No `props.` access patterns.
- Early returns over nested conditionals.

### Before every change
1. Check if the file you're about to edit is over 200 lines. If so, refactor first.
2. Check if similar logic exists elsewhere. Don't duplicate — extract and share.
3. If creating a new file, verify it has a clear single responsibility.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| AI | Anthropic Claude SDK (`@anthropic-ai/sdk`) |
| Email | Mailgun (via REST API) |
| Hosting | Vercel |

## Directory structure

```
src/
  app/
    api/
      contact/route.ts        — Contact form submissions → Mailgun email
      email-update/route.ts   — Authorized email → Claude → Supabase HTML update
      generate/route.ts       — AI website generation endpoint
    auth/
      callback/route.ts       — Supabase OAuth callback
      login/page.tsx          — Login page
      signup/page.tsx         — Signup page
    dashboard/
      page.tsx                — Main dashboard (lists client sites)
      new/page.tsx            — Create new site form (218 lines — needs splitting)
    sites/
      [subdomain]/page.tsx    — Dynamic site serving from Supabase HTML
    globals.css
    layout.tsx
    page.tsx                  — Marketing/root page (redirects to dashboard)
  lib/
    supabase.ts               — Browser Supabase client
    supabase-server.ts        — Server-side Supabase client (uses cookies)
  middleware.ts               — Subdomain routing + auth guards
```

## Database schema (Supabase)

### `websites` table
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| subdomain | text | Unique, used for routing |
| html_content | text | Full raw HTML of the client site |
| owner_id | uuid | FK to auth.users |
| authorized_senders | text[] | Emails allowed to trigger updates |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## Key architectural patterns

### Subdomain routing (`middleware.ts`)
Requests to `*.sceneengineering.com` are matched and rewritten to `/sites/[subdomain]`. Requests to `sceneengineering.com` itself are routed to the Next.js app normally. `/api/*` routes are always passed through.

### AI website generation (`/api/generate`)
Sends a prompt to Claude Sonnet with business details and receives a full HTML page as output. The HTML is stored directly in the `websites.html_content` column.

### Email-triggered updates (`/api/email-update`)
Mailgun webhook posts inbound email to this endpoint. The sender is checked against `websites.authorized_senders`. If authorized, the email body is sent to Claude with the current site HTML and an instruction to apply the requested changes. The updated HTML is written back to Supabase.

### Contact form (`/api/contact`)
Standard form POST. Sends a formatted email via Mailgun REST API to `info@sceneengineering.com`. Includes name, email, phone, business, plan interest, and message.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase publishable key
SUPABASE_SERVICE_ROLE_KEY=        # Server-only: bypasses RLS
ANTHROPIC_API_KEY=                # Claude API key
MAILGUN_API_KEY=                  # Mailgun private API key
MAILGUN_DOMAIN=                   # e.g. mg.sceneengineering.com
MAILGUN_WEBHOOK_SIGNING_KEY=      # For validating inbound email webhooks
```

## Running the project

```bash
# Development
npm run dev          # Starts on http://localhost:3000

# Build
npm run build

# Lint
npm run lint
```

## Known issues / technical debt
- `dashboard/new/page.tsx` is 218 lines — approaching the hard limit; AI generation logic should be extracted to a service
- `api/email-update/route.ts` is 199 lines — at the limit; Claude interaction logic should move to a service file
- No tests exist yet — the e2e-tester agent should be used to add coverage for the auth and site-creation flows
