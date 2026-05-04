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

// ── HTML escaping ─────────────────────────────────────────────
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Option helper: handles both "string" and {value, label} ──
type OptionItem = string | { value: string; label: string }
function renderOption(o: OptionItem): string {
  if (typeof o === 'string') return `<option value="${esc(o)}">${esc(o)}</option>`
  const val = String((o as { value?: string }).value ?? '')
  const lbl = String((o as { label?: string }).label ?? val)
  return `<option value="${esc(val)}">${esc(lbl)}</option>`
}

// ── Form field renderer ───────────────────────────────────────
interface FormField {
  type: string
  name: string
  label: string
  placeholder?: string
  required?: boolean
  options?: OptionItem[]
}

function renderFormField(field: FormField, sid: string): string {
  const req = field.required ? ' required' : ''
  const ph = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : ''
  const base = 'padding:0.65rem 0.9rem;border:1.5px solid #e5e7eb;border-radius:6px;font-family:inherit;font-size:1rem;width:100%;box-sizing:border-box;outline:none;'
  const lbl = `<label style="font-weight:500;font-size:0.9rem;color:#374151;">${esc(field.label)}${field.required ? ' *' : ''}</label>`

  switch (field.type) {
    case 'textarea':
      return `<div style="display:flex;flex-direction:column;gap:0.4rem;">${lbl}<textarea name="${esc(field.name)}"${ph}${req} rows="4" style="${base}resize:vertical;"></textarea></div>`
    case 'select': {
      const opts = (field.options ?? []).map(renderOption).join('')
      return `<div style="display:flex;flex-direction:column;gap:0.4rem;">${lbl}<select name="${esc(field.name)}"${req} style="${base}"><option value="">Select…</option>${opts}</select></div>`
    }
    case 'checkbox':
      return `<div style="display:flex;align-items:center;gap:0.5rem;"><input type="checkbox" name="${esc(field.name)}" id="chk_${esc(field.name)}_${sid}"${req} style="width:1rem;height:1rem;"/><label for="chk_${esc(field.name)}_${sid}" style="font-size:0.9rem;color:#374151;">${esc(field.label)}</label></div>`
    default:
      return `<div style="display:flex;flex-direction:column;gap:0.4rem;">${lbl}<input type="${esc(field.type)}" name="${esc(field.name)}"${ph}${req} style="${base}"/></div>`
  }
}

// ── Section type renderers ────────────────────────────────────

function renderHero(c: Record<string, unknown>, t: ThemeConfig): string {
  const bg = String(c.backgroundValue ?? `linear-gradient(135deg,${t.primaryColor} 0%,${t.secondaryColor ?? t.primaryColor} 100%)`)
  return `<section style="background:${bg};padding:6rem 1.5rem;text-align:center;color:#fff;">
  <div style="max-width:800px;margin:0 auto;">
    <h1 style="font-size:clamp(2rem,5vw,3.5rem);font-weight:800;line-height:1.1;margin-bottom:1.5rem;">${esc(String(c.headline ?? ''))}</h1>
    ${c.subheadline ? `<p style="font-size:1.2rem;opacity:0.9;margin-bottom:2.5rem;">${esc(String(c.subheadline))}</p>` : ''}
    ${c.ctaText ? `<a href="${esc(String(c.ctaLink ?? '#contact'))}" style="display:inline-block;background:#fff;color:${esc(t.primaryColor)};padding:0.9rem 2.5rem;border-radius:6px;font-weight:700;font-size:1.05rem;text-decoration:none;">${esc(String(c.ctaText))}</a>` : ''}
  </div>
</section>`
}

function renderAbout(c: Record<string, unknown>, t: ThemeConfig): string {
  const stats = Array.isArray(c.stats) ? (c.stats as Array<Record<string, unknown>>) : []
  return `<section style="padding:5rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;text-align:center;">
    <h2 style="font-size:2.25rem;font-weight:700;margin-bottom:1.5rem;">${esc(String(c.heading ?? 'About Us'))}</h2>
    ${c.body ? `<p style="max-width:700px;margin:0 auto 3rem;color:#4b5563;font-size:1.1rem;line-height:1.8;">${esc(String(c.body))}</p>` : ''}
    ${stats.length ? `<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:3rem;">
      ${stats.map(s => `<div><div style="font-size:2.5rem;font-weight:800;color:${esc(t.primaryColor)};">${esc(String(s.value ?? ''))}</div><div style="color:#6b7280;">${esc(String(s.label ?? ''))}</div></div>`).join('')}
    </div>` : ''}
  </div>
</section>`
}

function renderServices(c: Record<string, unknown>, t: ThemeConfig): string {
  const svcs = Array.isArray(c.services) ? (c.services as Array<Record<string, unknown>>) : []
  return `<section style="padding:5rem 1.5rem;background:#f9fafb;">
  <div style="max-width:1100px;margin:0 auto;">
    <h2 style="text-align:center;font-size:2.25rem;font-weight:700;margin-bottom:${c.subheading ? '0.75rem' : '3rem'};">${esc(String(c.heading ?? 'Our Services'))}</h2>
    ${c.subheading ? `<p style="text-align:center;color:#6b7280;font-size:1.1rem;margin-bottom:3rem;">${esc(String(c.subheading))}</p>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
      ${svcs.map(s => `<div style="background:#fff;border-radius:8px;padding:2rem;box-shadow:0 1px 4px rgba(0,0,0,0.07);">
        ${s.icon ? `<div style="font-size:2.5rem;margin-bottom:1rem;">${String(s.icon)}</div>` : ''}
        <h3 style="font-size:1.2rem;font-weight:700;color:${esc(t.primaryColor)};margin-bottom:0.75rem;">${esc(String(s.title ?? ''))}</h3>
        <p style="color:#4b5563;line-height:1.7;">${esc(String(s.description ?? ''))}</p>
        ${s.price ? `<p style="margin-top:1rem;font-weight:600;color:${esc(t.primaryColor)};">${esc(String(s.price))}</p>` : ''}
      </div>`).join('')}
    </div>
  </div>
</section>`
}

function renderTeam(c: Record<string, unknown>, t: ThemeConfig): string {
  const members = Array.isArray(c.members) ? (c.members as Array<Record<string, unknown>>) : []
  return `<section style="padding:5rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;">
    <h2 style="text-align:center;font-size:2.25rem;font-weight:700;margin-bottom:3rem;">${esc(String(c.heading ?? 'Our Team'))}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:2rem;">
      ${members.map(m => {
        const name = String(m.name ?? '?')
        return `<div style="text-align:center;padding:2rem;">
          <div style="width:80px;height:80px;border-radius:50%;background:${esc(t.primaryColor)};margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.75rem;font-weight:700;">${esc(name[0])}</div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.25rem;">${esc(name)}</h3>
          <p style="color:${esc(t.primaryColor)};font-weight:500;font-size:0.9rem;margin-bottom:0.5rem;">${esc(String(m.role ?? ''))}</p>
          ${m.bio ? `<p style="color:#6b7280;font-size:0.9rem;">${esc(String(m.bio))}</p>` : ''}
        </div>`
      }).join('')}
    </div>
  </div>
</section>`
}

function renderTestimonials(c: Record<string, unknown>): string {
  const tms = Array.isArray(c.testimonials) ? (c.testimonials as Array<Record<string, unknown>>) : []
  return `<section style="padding:5rem 1.5rem;background:#f9fafb;">
  <div style="max-width:1100px;margin:0 auto;">
    <h2 style="text-align:center;font-size:2.25rem;font-weight:700;margin-bottom:3rem;">${esc(String(c.heading ?? 'What Our Clients Say'))}</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;">
      ${tms.map(t => `<div style="background:#fff;border-radius:8px;padding:2rem;box-shadow:0 1px 4px rgba(0,0,0,0.07);">
        ${t.rating ? `<div style="color:#f59e0b;margin-bottom:1rem;">${'★'.repeat(Number(t.rating))}</div>` : ''}
        <p style="color:#374151;line-height:1.75;font-style:italic;margin-bottom:1.5rem;">"${esc(String(t.quote ?? ''))}"</p>
        <div style="font-weight:700;">${esc(String(t.author ?? ''))}</div>
        ${(t.role || t.company) ? `<div style="font-size:0.85rem;color:#6b7280;">${[t.role, t.company].filter(Boolean).map(x => esc(String(x))).join(', ')}</div>` : ''}
      </div>`).join('')}
    </div>
  </div>
</section>`
}

function renderContact(c: Record<string, unknown>, sid: string, t: ThemeConfig): string {
  const fields = Array.isArray(c.formFields) ? (c.formFields as FormField[]) : [
    { type: 'text', name: 'name', label: 'Full Name', required: true },
    { type: 'email', name: 'email', label: 'Email', required: true },
    { type: 'textarea', name: 'message', label: 'Message', required: true },
  ]
  const submitLabel = String(c.submitLabel ?? 'Send Message')
  const contactInfo = [
    c.email && `📧 ${esc(String(c.email))}`,
    c.phone && `📞 ${esc(String(c.phone))}`,
    c.address && `📍 ${esc(String(c.address))}`,
  ].filter(Boolean).join(' &nbsp;&middot;&nbsp; ')

  return `<section id="contact" style="padding:5rem 1.5rem;background:#fff;">
  <div style="max-width:800px;margin:0 auto;">
    <h2 style="text-align:center;font-size:2.25rem;font-weight:700;margin-bottom:${c.subheading ? '0.75rem' : '2rem'};">${esc(String(c.heading ?? 'Get In Touch'))}</h2>
    ${c.subheading ? `<p style="text-align:center;color:#6b7280;margin-bottom:2rem;">${esc(String(c.subheading))}</p>` : ''}
    ${contactInfo ? `<p style="text-align:center;margin-bottom:2rem;color:#374151;">${contactInfo}</p>` : ''}
    <form id="form_${sid}" style="background:#f9fafb;padding:2.5rem;border-radius:8px;display:flex;flex-direction:column;gap:1.25rem;" onsubmit="submitForm_${sid}(event)">
      <div id="form_msg_${sid}" style="display:none;padding:1rem;border-radius:6px;"></div>
      ${fields.map(f => renderFormField(f, sid)).join('\n      ')}
      <button type="submit" style="background:${esc(t.primaryColor)};color:#fff;padding:0.85rem 2rem;border-radius:6px;font-weight:700;font-size:1rem;cursor:pointer;border:none;align-self:flex-start;">${esc(submitLabel)}</button>
    </form>
  </div>
</section>
<script>
async function submitForm_${sid}(e){
  e.preventDefault();
  var form=document.getElementById('form_${sid}');
  var msg=document.getElementById('form_msg_${sid}');
  var btn=form.querySelector('button[type=submit]');
  btn.disabled=true;btn.textContent='Sending…';
  try{
    var data=Object.fromEntries(new FormData(form).entries());
    var res=await fetch('/api/submit-form',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sectionId:'${sid}',data})});
    if(res.ok){msg.style.display='block';msg.style.background='#d1fae5';msg.style.color='#065f46';msg.textContent='Message sent! We will be in touch soon.';form.reset();}
    else{throw new Error('Failed');}
  }catch{msg.style.display='block';msg.style.background='#fee2e2';msg.style.color='#991b1b';msg.textContent='Something went wrong. Please try again.';}
  btn.disabled=false;btn.textContent='${submitLabel.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}';
}
</script>`
}

// ── Section dispatcher ────────────────────────────────────────
// Contact always uses JSON renderer (avoids legacy [object Object] bug).
// Other types use legacy content.html if present, otherwise JSON renderer.
function renderSection(s: SectionRow, theme: ThemeConfig): string {
  const c = s.content as Record<string, unknown>
  const legacyHtml = typeof (c as { html?: string }).html === 'string'
    ? (c as { html: string }).html
    : null

  if (s.type === 'contact') return renderContact(c, s.id, theme)
  if (legacyHtml) return legacyHtml

  switch (s.type) {
    case 'hero':         return renderHero(c, theme)
    case 'about':        return renderAbout(c, theme)
    case 'services':     return renderServices(c, theme)
    case 'team':         return renderTeam(c, theme)
    case 'testimonials': return renderTestimonials(c)
    default:             return ''
  }
}

// ── Main page renderer ────────────────────────────────────────
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

  const navLinks = allPages
    .filter((p) => p.published)
    .sort((a, b) => a.nav_order - b.nav_order)
    .map(
      (p) =>
        `<a href="${p.is_homepage ? './' : p.slug}" style="text-decoration:none;color:#333;font-weight:500;font-size:0.95rem;">${esc(p.nav_label ?? '')}</a>`
    )
    .join('')

  const sectionStyles = sections
    .map((s) => s.section_css || '')
    .filter(Boolean)
    .join('\n')

  const sectionScripts = sections
    .map((s) => s.section_js || '')
    .filter(Boolean)
    .join('\n')

  const sectionsHtml = sections
    .filter((s) => s.published)
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => renderSection(s, theme))
    .join('\n')

  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --primary: ${primaryColor}; --secondary: ${secondaryColor}; --font: ${fontFamily}; }
    html { scroll-behavior: smooth; }
    body { font-family: var(--font); line-height: 1.6; color: #222; }
    img { max-width: 100%; height: auto; display: block; }
    a { color: inherit; }
    button, .btn { cursor: pointer; border: none; padding: 0.75rem 1.75rem; border-radius: 6px; font-family: var(--font); font-weight: 600; font-size: 1rem; background: var(--primary); color: #fff; transition: opacity 0.2s; }
    button:hover, .btn:hover { opacity: 0.85; }
    section { width: 100%; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
    ${sectionStyles}
  </style>
</head>
<body>

  <!-- Navigation -->
  <nav style="position:sticky;top:0;z-index:999;background:#fff;border-bottom:1px solid #e5e7eb;padding:0 2rem;height:64px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <a href="./" style="font-weight:800;font-size:1.25rem;text-decoration:none;color:${esc(primaryColor)};">${esc(siteName)}</a>
    <div style="display:flex;gap:2rem;align-items:center;">${navLinks}</div>
  </nav>

  <!-- Page sections -->
  ${sectionsHtml}

  <!-- Footer -->
  <footer style="background:#111827;color:#9ca3af;text-align:center;padding:3rem 1.5rem;font-size:0.875rem;">
    <p style="font-weight:700;color:#f9fafb;font-size:1rem;margin-bottom:0.5rem;">${esc(siteName)}</p>
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
