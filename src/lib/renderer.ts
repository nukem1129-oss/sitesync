// ============================================================
// SiteSync v2 — HTML renderer
// Assembles a full HTML page from section rows
// ============================================================

import type { SectionRow, PageRow, ThemeConfig } from '@/types/site'

interface RenderPageArgs {
  page: PageRow
  sections: SectionRow[]
  theme: ThemeConfig
  siteName: string
  allPages: PageRow[]
  updateEmail: string
}

export function renderPage({
  sections,
  theme,
  siteName,
  allPages,
  updateEmail,
}: RenderPageArgs): string {
  const primaryColor = theme?.primaryColor || '#6c63ff'
  const secondaryColor = theme?.secondaryColor || '#4a47a3'
  const fontFamily = theme?.fontFamily || 'Inter, sans-serif'

  // ── Navigation ────────────────────────────────────────────
  const navLinks = allPages
    .filter((p) => p.published)
    .sort((a, b) => a.nav_order - b.nav_order)
    .map(
      (p) =>
        `<a href="${p.is_homepage ? './' : p.slug}" style="text-decoration:none;color:#333;font-weight:500;font-size:0.95rem;">${esc(p.nav_label)}</a>`
    )
    .join('')

  // ── Collect per-section CSS / JS ──────────────────────────
  const sectionStyles = sections
    .map((s) => s.section_css || '')
    .filter(Boolean)
    .join('\n')

  const sectionScripts = sections
    .map((s) => s.section_js || '')
    .filter(Boolean)
    .join('\n')

  // ── Render sections ───────────────────────────────────────
  const sectionsHtml = sections
    .filter((s) => s.published)
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => {
      const html = (s.content as { html?: string })?.html || ''
      return html
    })
    .join('\n')

  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: ${primaryColor};
      --secondary: ${secondaryColor};
      --font: ${fontFamily};
    }
    html { scroll-behavior: smooth; }
    body { font-family: var(--font); line-height: 1.6; color: #222; }
    img { max-width: 100%; height: auto; display: block; }
    a { color: inherit; }
    button, .btn {
      cursor: pointer;
      border: none;
      padding: 0.75rem 1.75rem;
      border-radius: 6px;
      font-family: var(--font);
      font-weight: 600;
      font-size: 1rem;
      background: var(--primary);
      color: #fff;
      transition: opacity 0.2s;
    }
    button:hover, .btn:hover { opacity: 0.85; }
    section { width: 100%; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
    ${sectionStyles}
  </style>
</head>
<body>

  <!-- ── Navigation ── -->
  <nav style="
    position: sticky; top: 0; z-index: 999;
    background: #fff; border-bottom: 1px solid #e5e7eb;
    padding: 0 2rem; height: 64px;
    display: flex; align-items: center; justify-content: space-between;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  ">
    <a href="./" style="font-weight:800;font-size:1.25rem;text-decoration:none;color:var(--primary);">
      ${esc(siteName)}
    </a>
    <div style="display:flex;gap:2rem;align-items:center;">
      ${navLinks}
    </div>
  </nav>

  <!-- ── Page sections ── -->
  ${sectionsHtml}

  <!-- ── Footer ── -->
  <footer style="
    background: #111827; color: #9ca3af;
    text-align: center; padding: 3rem 1.5rem;
    font-size: 0.875rem;
  ">
    <p style="font-weight:700;color:#f9fafb;font-size:1rem;margin-bottom:0.5rem;">
      ${esc(siteName)}
    </p>
    <p>&copy; ${year} ${esc(siteName)}. All rights reserved.</p>
    <p style="margin-top:1rem;font-size:0.75rem;color:#6b7280;">
      Powered by <a href="https://www.sceneengineering.com" style="color:var(--primary);text-decoration:none;">SiteSync</a>
      &mdash; update this site by emailing
      <a href="mailto:${updateEmail}" style="color:var(--primary);text-decoration:none;">${updateEmail}</a>
    </p>
  </footer>

  ${sectionScripts ? `<script>\n${sectionScripts}\n</script>` : ''}
</body>
</html>`
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
