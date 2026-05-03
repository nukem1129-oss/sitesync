## Architecture enforcement

### Import rules (enforced strictly)
```
pages/components  →  may import: hooks, components/ui, types, constants
hooks             →  may import: services, other hooks, types, constants
services          →  may import: lib clients, other services, types, constants
lib/              →  may import: types, constants, npm packages only
repositories/     →  may import: lib/supabase*, types, constants
```

No circular dependencies. If A imports B, B must not import A.

### Naming conventions
| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `website-repository.ts` |
| Components | PascalCase | `SiteCard.tsx` |
| Hooks | camelCase + `use` prefix | `useGenerateSite.ts` |
| Services | camelCase + `Service` suffix | `generateService.ts` |
| Repositories | camelCase + `Repository` suffix | `websiteRepository.ts` |
| Types/Interfaces | PascalCase | `Website`, `GenerateRequest` |
| Constants | UPPER_SNAKE_CASE | `MAX_HTML_SIZE` |

### Directory structure to grow into
```
src/
  app/              — Next.js App Router pages and API routes (thin)
  components/
    ui/             — Reusable primitives (Button, Input, Card, etc.)
    features/       — Feature-specific components (NewSiteForm, SiteCard, etc.)
  hooks/            — Custom React hooks (useGenerateSite, useWebsites, etc.)
  services/         — Business logic (generateService, emailUpdateService, etc.)
  repositories/     — Supabase queries (websiteRepository, userRepository, etc.)
  lib/              — Shared clients and utilities (supabase.ts, supabase-server.ts, mailgunWebhook.ts)
  types/            — Shared TypeScript types (website.ts, api.ts, etc.)
```

### Testing requirements
- Every new API route must have at least one integration test
- Bug fixes must include a regression test
- Tests live in `tests/` at the project root (Playwright for e2e, Vitest for unit)

### Supabase RLS policy requirements
Every table must have RLS enabled. The `websites` table policy:
- `SELECT`: `owner_id = auth.uid()`
- `INSERT`: `owner_id = auth.uid()`
- `UPDATE`: `owner_id = auth.uid()`
- `DELETE`: `owner_id = auth.uid()`

Service role key bypasses RLS and is only used in server-side routes that need to act on behalf of any user (e.g., Mailgun webhook handling inbound email updates).
