// ============================================================
// SiteSync v2 — Page assembler
// Imports section renderers; builds full HTML with global CSS
// ============================================================
import type { SectionRow, PageRow, ThemeConfig } from '@/types/site'
import {
  esc,
  renderHero, renderPageHeader, renderAbout, renderServices,
  renderFeatures, renderTeam, renderTestimonials, renderProcess,
  renderFAQ, renderPricing, renderGallery,
} from './rendererSections'

interface RenderPageArgs {
  page: PageRow
  sections: SectionRow[]
  theme: ThemeConfig
  siteName: string
  allPages: PageRow[]
  updateEmail: string | null
  basePath?: string
}

// ── Option helper ─────────────────────────────────────────────
type OptionItem = string | { value: string; label: string }
function renderOption(o: OptionItem): string {
  if (typeof o === 'string') return `<option value="${esc(o)}">${esc(o)}</option>`
  const val = String((o as { value?: string }).value ?? '')
  const lbl = String((o as { label?: string }).label ?? val)
  return `<option value="${esc(val)}">${esc(lbl)}</option>`
}

// ── Form field renderer ───────────────────────────────────────
interface FormField { type: string; name: string; label: string; placeholder?: string; required?: boolean; options?: OptionItem[] }
function renderFormField(field: FormField, sid: string): string {
  const req = field.required ? ' required' : ''
  const ph = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : ''
  const base = 'class="ss-input" style="padding:0.65rem 0.9rem;border:1.5px solid #e5e7eb;border-radius:8px;font-family:inherit;font-size:1rem;width:100%;box-sizing:border-box;"'
  const lbl = `<label style="font-weight:600;font-size:0.875rem;color:#374151;">${esc(field.label)}${field.required ? ' *' : ''}</label>`
  switch (field.type) {
    case 'textarea':
      return `<div style="display:flex;flex-direction:column;gap:0.4rem;">${lbl}<textarea name="${esc(field.name)}"${ph}${req} rows="4" ${base} style="padding:0.65rem 0.9rem;border:1.5px solid #e5e7eb;border-radius:8px;font-family:inherit;font-size:1rem;width:100%;box-sizing:border-box;resize:vertical;"></textarea></div>`
    case 'select': {
      const opts = (field.options ?? []).map(renderOption).join('')
      return `<div style="display:flex;flex-direction:column;gap:0.4rem;">${lbl}<select name="${esc(field.name)}"${req} ${base}><option value="">Select…</option>${opts}</select></div>`
    }
    case 'checkbox':
      return `<div style="display:flex;align-items:center;gap:0.5rem;"><input type="checkbox" name="${esc(field.name)}" id="chk_${esc(field.name)}_${sid}"${req} style="width:1rem;height:1rem;accent-color:var(--primary);"/><label for="chk_${esc(field.name)}_${sid}" style="font-size:0.9rem;color:#374151;">${esc(field.label)}</label></div>`
    default:
      return `<div style="display:flex;flex-direction:column;gap:0.4rem;">${lbl}<input type="${esc(field.type)}" name="${esc(field.name)}"${ph}${req} ${base}/></div>`
  }
}

// ── Contact section ───────────────────────────────────────────
function renderContact(c: Record<string, unknown>, sid: string, t: ThemeConfig): string {
  const fields = Array.isArray(c.formFields) ? (c.formFields as FormField[]) : [
    { type: 'text',     name: 'name',    label: 'Full Name', required: true },
    { type: 'email',    name: 'email',   label: 'Email',     required: true },
    { type: 'textarea', name: 'message', label: 'Message',   required: true },
  ]
  const submitLabel = String(c.submitLabel ?? 'Send Message')
  const contactInfo = [
    c.email   && `📧 <a href="mailto:${esc(String(c.email))}" style="color:var(--primary);text-decoration:none;">${esc(String(c.email))}</a>`,
    c.phone   && `📞 ${esc(String(c.phone))}`,
    c.address && `📍 ${esc(String(c.address))}`,
  ].filter(Boolean).join('<br/>')
  return `<section id="contact" style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Get In Touch'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div class="ss-grid-2">
      ${contactInfo ? `<div style="background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:16px;padding:3rem;color:#fff;">
        <h3 style="font-size:1.3rem;font-weight:700;margin-bottom:1.5rem;">Contact Info</h3>
        <div style="display:flex;flex-direction:column;gap:1.25rem;line-height:1.7;opacity:0.92;">${contactInfo}</div>
      </div>` : '<div></div>'}
      <form id="form_${sid}" style="background:#f8f9fc;padding:2.5rem;border-radius:16px;display:flex;flex-direction:column;gap:1.25rem;" onsubmit="submitForm_${sid}(event)">
        <div id="form_msg_${sid}" style="display:none;padding:1rem;border-radius:8px;"></div>
        ${fields.map(f => renderFormField(f, sid)).join('\n  ')}
        <button type="submit" class="ss-btn" style="background:${esc(t.primaryColor)};color:#fff;align-self:flex-start;">${esc(submitLabel)}</button>
      </form>
    </div>
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
  btn.disabled=false;btn.textContent='${submitLabel.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}';
}
</script>`
}

// ── Section dispatcher ────────────────────────────────────────
function renderSection(s: SectionRow, theme: ThemeConfig): string {
  const c = s.content as Record<string, unknown>
  const legacyHtml = typeof (c as { html?: string }).html === 'string' ? (c as { html: string }).html : null
  switch (s.type) {
    case 'hero':         return renderHero(c, theme)
    case 'page-header':  return renderPageHeader(c, theme)
    case 'about':        return renderAbout(c, theme)
    case 'services':     return renderServices(c, theme)
    case 'features':     return renderFeatures(c, theme)
    case 'team':         return renderTeam(c, theme)
    case 'testimonials': return renderTestimonials(c, theme)
    case 'process':      return renderProcess(c, theme)
    case 'faq':          return renderFAQ(c)
    case 'pricing':      return renderPricing(c, theme)
    case 'gallery':      return renderGallery(c, theme)
    case 'contact':      return renderContact(c, s.id, theme)
    default:             return legacyHtml ?? ''
  }
}

// ── Main page renderer ────────────────────────────────────────
export function renderPage({ sections, theme, siteName, allPages, updateEmail: updateEmailRaw, basePath = '' }: RenderPageArgs): string {
  const updateEmail = updateEmailRaw ?? `update@mg.sceneengineering.com`
  const primary   = theme?.primaryColor   || '#6c63ff'
  const secondary = theme?.secondaryColor || '#4a47a3'
  const font      = theme?.fontFamily     || 'Inter, sans-serif'
  const year      = new Date().getFullYear()

  const navLinks = allPages
    .filter(p => p.published)
    .sort((a, b) => a.nav_order - b.nav_order)
    .map(p => {
      const href = basePath ? (p.is_homepage ? `${basePath}/` : `${basePath}/${p.slug}`) : (p.is_homepage ? './' : p.slug)
      return `<a href="${href}" class="ss-nav-link" style="text-decoration:none;color:#444;font-weight:500;font-size:0.95rem;">${esc(p.nav_label ?? '')}</a>`
    }).join('')

  const footerLinks = allPages
    .filter(p => p.published)
    .sort((a, b) => a.nav_order - b.nav_order)
    .map(p => {
      const href = basePath ? (p.is_homepage ? `${basePath}/` : `${basePath}/${p.slug}`) : (p.is_homepage ? './' : p.slug)
      return `<a href="${href}" style="text-decoration:none;color:#94a3b8;font-size:0.9rem;transition:color 0.15s;">${esc(p.nav_label ?? '')}</a>`
    }).join('')

  const sectionStyles  = sections.map(s => s.section_css || '').filter(Boolean).join('\n')
  const sectionScripts = sections.map(s => s.section_js  || '').filter(Boolean).join('\n')
  const sectionsHtml   = sections.filter(s => s.published).sort((a, b) => a.order_index - b.order_index).map(s => renderSection(s, theme)).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${esc(siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
    :root{--primary:${primary};--secondary:${secondary};--font:${font};}
    html{scroll-behavior:smooth;}
    body{font-family:var(--font);line-height:1.6;color:#1a1a2e;background:#fff;}
    img{max-width:100%;height:auto;display:block;}
    a{color:inherit;}
    h1,h2,h3,h4{line-height:1.15;letter-spacing:-0.02em;}
    /* Responsive grids */
    .ss-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:3rem;align-items:center;}
    .ss-grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1.75rem;}
    .ss-grid-4{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:1.5rem;}
    /* Card hover lift */
    .ss-card{transition:transform 0.22s ease,box-shadow 0.22s ease;}
    .ss-card:hover{transform:translateY(-5px);box-shadow:0 16px 40px rgba(0,0,0,0.12)!important;}
    /* Nav underline on hover */
    .ss-nav-link{position:relative;padding-bottom:3px;}
    .ss-nav-link::after{content:'';position:absolute;bottom:0;left:0;width:0;height:2px;background:var(--primary);border-radius:1px;transition:width 0.2s ease;}
    .ss-nav-link:hover{color:var(--primary)!important;}
    .ss-nav-link:hover::after{width:100%;}
    /* Buttons */
    .ss-btn{display:inline-block;padding:0.9rem 2.25rem;border-radius:8px;font-weight:700;font-size:1rem;text-decoration:none;cursor:pointer;border:none;font-family:var(--font);transition:transform 0.15s ease,box-shadow 0.15s ease;}
    .ss-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.2);}
    /* Section heading accent bar */
    .ss-section-heading::after{content:'';display:block;width:48px;height:4px;background:var(--primary);border-radius:2px;margin:0.75rem auto 0;}
    /* Input focus rings */
    .ss-input:focus{border-color:var(--primary)!important;box-shadow:0 0 0 3px rgba(108,99,255,0.15);outline:none;}
    /* FAQ accordion */
    details.ss-faq summary::-webkit-details-marker{display:none;}
    details.ss-faq summary{display:flex;justify-content:space-between;align-items:center;cursor:pointer;}
    details.ss-faq .ss-faq-icon{transition:transform 0.2s;}
    details.ss-faq[open] .ss-faq-icon{transform:rotate(45deg);}
    /* Mobile nav */
    #ss-nav-toggle{display:none;}
    .ss-hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:4px;}
    .ss-hamburger span{display:block;width:24px;height:2px;background:#333;border-radius:2px;transition:all 0.25s;}
    #ss-nav-toggle:checked ~ .ss-nav-links{display:flex!important;flex-direction:column;position:absolute;top:68px;left:0;right:0;background:rgba(255,255,255,0.98);border-bottom:1px solid #e5e7eb;padding:1.5rem 2rem;gap:1.25rem;box-shadow:0 8px 24px rgba(0,0,0,0.08);}
    #ss-nav-toggle:checked ~ label .ss-hamburger span:nth-child(1){transform:translateY(7px) rotate(45deg);}
    #ss-nav-toggle:checked ~ label .ss-hamburger span:nth-child(2){opacity:0;}
    #ss-nav-toggle:checked ~ label .ss-hamburger span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}
    @media(max-width:768px){
      .ss-hamburger{display:flex;}
      .ss-nav-links{display:none;}
      .ss-grid-2{gap:2rem;}
    }
    ${sectionStyles}
  </style>
</head>
<body>
  <nav style="position:sticky;top:0;z-index:999;background:rgba(255,255,255,0.96);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid #e5e7eb;padding:0 2rem;height:68px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 8px rgba(0,0,0,0.06);">
    <a href="${basePath ? basePath + '/' : './'}" style="font-weight:800;font-size:1.3rem;text-decoration:none;color:${esc(primary)};letter-spacing:-0.02em;">${esc(siteName)}</a>
    <input type="checkbox" id="ss-nav-toggle" style="display:none;"/>
    <label for="ss-nav-toggle" aria-label="Toggle menu"><div class="ss-hamburger"><span></span><span></span><span></span></div></label>
    <div class="ss-nav-links" style="display:flex;gap:2.5rem;align-items:center;">${navLinks}</div>
  </nav>
  ${sectionsHtml}
  <footer style="background:#0f172a;color:#94a3b8;padding:4rem 1.5rem 3rem;">
    <div style="max-width:1100px;margin:0 auto;text-align:center;">
      <a href="${basePath ? basePath + '/' : './'}" style="display:inline-block;font-weight:800;color:#f1f5f9;font-size:1.25rem;margin-bottom:1.25rem;text-decoration:none;letter-spacing:-0.02em;">${esc(siteName)}</a>
      <div style="display:flex;justify-content:center;gap:2rem;flex-wrap:wrap;margin-bottom:2.5rem;">${footerLinks}</div>
      <div style="border-top:1px solid #1e293b;padding-top:2rem;font-size:0.85rem;">
        <p>&copy; ${year} ${esc(siteName)}. All rights reserved.</p>
        <p style="margin-top:0.5rem;font-size:0.75rem;color:#475569;">
          Powered by <a href="https://www.sceneengineering.com" style="color:var(--primary);text-decoration:none;">SiteSync</a>
          &mdash; update this site by emailing
          <a href="mailto:${updateEmail}" style="color:var(--primary);text-decoration:none;">${updateEmail}</a>
        </p>
      </div>
    </div>
  </footer>
  ${sectionScripts ? `<script>\n${sectionScripts}\n</script>` : ''}
</body>
</html>`
}
