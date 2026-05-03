// ============================================================
// SiteSync v2 HTML Renderer
// Converts sections JSON + theme → complete HTML page
// ============================================================

import type {
  SectionRow, PageRow, Theme,
  HeroContent, AboutContent, ServicesContent,
  TeamContent, TestimonialsContent, ContactContent, CustomContent,
} from '@/types/site'

interface RenderPageOptions {
  page: PageRow
  sections: SectionRow[]
  theme: Theme
  siteName: string
  allPages?: PageRow[]   // for multi-page navigation
  updateEmail?: string
  subdomain?: string
}

// ── Google Fonts import for common font choices ───────────────
function googleFontsLink(theme: Theme): string {
  const fonts = new Set<string>()
  const extract = (f: string) => {
    const m = f.match(/'([^']+)'/)
    return m ? m[1].replace(/ /g, '+') : null
  }
  const f1 = extract(theme.fontFamily)
  const f2 = extract(theme.headingFont)
  if (f1) fonts.add(f1)
  if (f2 && f2 !== f1) fonts.add(f2)
  if (fonts.size === 0) return ''
  const families = [...fonts].map(f => `family=${f}:wght@300;400;500;600;700`).join('&')
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`
}

// ── Base CSS with theme variables ────────────────────────────
function baseStyles(theme: Theme): string {
  return `
    :root {
      --primary: ${theme.primaryColor};
      --secondary: ${theme.secondaryColor};
      --accent: ${theme.accentColor};
      --bg: ${theme.backgroundColor};
      --text: ${theme.textColor};
      --font: ${theme.fontFamily};
      --heading-font: ${theme.headingFont};
      --radius: ${theme.borderRadius};
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    h1,h2,h3,h4,h5,h6 { font-family: var(--heading-font); line-height: 1.2; }
    a { color: var(--primary); text-decoration: none; }
    img { max-width: 100%; height: auto; display: block; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.75rem;
      border-radius: var(--radius);
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.2s;
      border: none;
      font-family: var(--font);
      font-size: 1rem;
    }
    .btn:hover { opacity: 0.88; transform: translateY(-1px); }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-outline { background: transparent; color: var(--primary); border: 2px solid var(--primary); }
    section { padding: 5rem 0; }
    .section-heading {
      text-align: center;
      font-size: 2.25rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: var(--text);
    }
    .section-sub {
      text-align: center;
      color: #6b7280;
      font-size: 1.1rem;
      margin-bottom: 3rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }
  `.trim()
}

// ── Navigation ───────────────────────────────────────────────
function renderNav(siteName: string, pages: PageRow[], currentSlug: string): string {
  const links = pages
    .filter(p => p.published)
    .sort((a, b) => a.nav_order - b.nav_order)
    .map(p => {
      const href = p.is_homepage ? '/' : `/${p.slug}`
      const active = p.slug === currentSlug
      return `<a href="${href}" class="nav-link${active ? ' active' : ''}">${p.nav_label || p.title}</a>`
    })
    .join('\n        ')

  return `
  <nav id="site-nav">
    <div class="nav-inner container">
      <a href="/" class="nav-brand">${escHtml(siteName)}</a>
      <button class="nav-toggle" aria-label="Toggle menu" onclick="document.getElementById('site-nav').classList.toggle('open')">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-links">
        ${links}
      </div>
    </div>
  </nav>
  <style>
    #site-nav {
      position: sticky; top: 0; z-index: 1000;
      background: var(--bg);
      border-bottom: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
    .nav-brand { font-family: var(--heading-font); font-size: 1.3rem; font-weight: 700; color: var(--primary); }
    .nav-links { display: flex; gap: 2rem; }
    .nav-link { color: var(--text); font-weight: 500; transition: color 0.2s; }
    .nav-link:hover, .nav-link.active { color: var(--primary); }
    .nav-toggle { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 4px; }
    .nav-toggle span { display: block; width: 24px; height: 2px; background: var(--text); border-radius: 2px; }
    @media (max-width: 768px) {
      .nav-toggle { display: flex; }
      .nav-links { display: none; position: absolute; top: 64px; left: 0; right: 0; background: var(--bg); flex-direction: column; padding: 1rem 1.5rem; border-bottom: 1px solid rgba(0,0,0,0.08); gap: 1rem; }
      #site-nav.open .nav-links { display: flex; }
    }
  </style>`
}

// ── Section renderers ────────────────────────────────────────

function renderHero(content: HeroContent, theme: Theme, id: string): string {
  const bg = content.backgroundType === 'gradient'
    ? content.backgroundValue
    : content.backgroundValue

  return `
  <section id="${id}" style="background:${bg}; padding: 7rem 0;">
    <div class="container" style="text-align:center;">
      <h1 style="font-size:clamp(2rem,5vw,3.5rem); font-weight:800; color:#fff; margin-bottom:1.25rem; line-height:1.15;">
        ${escHtml(content.headline)}
      </h1>
      <p style="font-size:1.2rem; color:rgba(255,255,255,0.88); max-width:600px; margin:0 auto 2rem;">
        ${escHtml(content.subheadline)}
      </p>
      <a href="${escAttr(content.ctaLink)}" class="btn" style="background:#fff; color:${theme.primaryColor}; font-size:1.1rem; padding:1rem 2.5rem;">
        ${escHtml(content.ctaText)}
      </a>
    </div>
  </section>`
}

function renderAbout(content: AboutContent, id: string): string {
  const stats = content.stats?.length
    ? `<div style="display:flex; gap:2rem; flex-wrap:wrap; margin-top:2rem;">
        ${content.stats.map(s => `
          <div style="text-align:center; flex:1; min-width:120px;">
            <div style="font-size:2rem; font-weight:700; color:var(--primary);">${escHtml(s.value)}</div>
            <div style="font-size:0.9rem; color:#6b7280; margin-top:0.25rem;">${escHtml(s.label)}</div>
          </div>`).join('')}
      </div>`
    : ''

  return `
  <section id="${id}" style="background:var(--bg);">
    <div class="container" style="max-width:800px;">
      <h2 class="section-heading">${escHtml(content.heading)}</h2>
      <p style="font-size:1.1rem; line-height:1.8; color:#374151;">${escHtml(content.body)}</p>
      ${stats}
    </div>
  </section>`
}

function renderServices(content: ServicesContent, id: string): string {
  const cards = content.services.map(s => `
    <div class="service-card">
      ${s.icon ? `<div class="service-icon">${escHtml(s.icon)}</div>` : ''}
      <h3 style="font-size:1.2rem; font-weight:600; margin-bottom:0.5rem;">${escHtml(s.title)}</h3>
      <p style="color:#6b7280; font-size:0.95rem; line-height:1.6;">${escHtml(s.description)}</p>
      ${s.price ? `<p style="margin-top:1rem; font-weight:700; color:var(--primary);">${escHtml(s.price)}</p>` : ''}
    </div>`).join('')

  return `
  <section id="${id}" style="background:#f9fafb;">
    <div class="container">
      <h2 class="section-heading">${escHtml(content.heading)}</h2>
      ${content.subheading ? `<p class="section-sub">${escHtml(content.subheading)}</p>` : ''}
      <div class="services-grid">${cards}</div>
    </div>
  </section>
  <style>
    .services-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1.5rem; }
    .service-card { background:#fff; border-radius:var(--radius); padding:2rem; box-shadow:0 1px 4px rgba(0,0,0,0.07); transition:transform 0.2s,box-shadow 0.2s; }
    .service-card:hover { transform:translateY(-3px); box-shadow:0 6px 20px rgba(0,0,0,0.1); }
    .service-icon { font-size:2rem; margin-bottom:1rem; }
  </style>`
}

function renderTeam(content: TeamContent, id: string): string {
  const members = content.members.map(m => `
    <div class="team-card">
      <div class="team-avatar">${escHtml(m.name.charAt(0).toUpperCase())}</div>
      <h3 style="font-size:1.1rem; font-weight:600; margin-bottom:0.25rem;">${escHtml(m.name)}</h3>
      <p style="color:var(--primary); font-size:0.9rem; font-weight:500; margin-bottom:0.75rem;">${escHtml(m.role)}</p>
      ${m.bio ? `<p style="color:#6b7280; font-size:0.9rem; line-height:1.6;">${escHtml(m.bio)}</p>` : ''}
    </div>`).join('')

  return `
  <section id="${id}">
    <div class="container">
      <h2 class="section-heading">${escHtml(content.heading)}</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1.5rem;">
        ${members}
      </div>
    </div>
  </section>
  <style>
    .team-card { text-align:center; padding:2rem 1.5rem; background:#fff; border-radius:var(--radius); box-shadow:0 1px 4px rgba(0,0,0,0.07); }
    .team-avatar { width:72px; height:72px; border-radius:50%; background:var(--primary); color:#fff; font-size:1.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; }
  </style>`
}

function renderTestimonials(content: TestimonialsContent, id: string): string {
  const cards = content.testimonials.map(t => {
    const stars = t.rating
      ? `<div style="color:#f59e0b; font-size:1.1rem; margin-bottom:0.75rem;">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>`
      : ''
    return `
    <div class="testimonial-card">
      ${stars}
      <p style="color:#374151; font-style:italic; line-height:1.7; margin-bottom:1rem;">"${escHtml(t.quote)}"</p>
      <div style="font-weight:600;">${escHtml(t.author)}</div>
      ${t.role || t.company ? `<div style="font-size:0.85rem; color:#6b7280;">${escHtml([t.role, t.company].filter(Boolean).join(', '))}</div>` : ''}
    </div>`
  }).join('')

  return `
  <section id="${id}" style="background:#f9fafb;">
    <div class="container">
      <h2 class="section-heading">${escHtml(content.heading)}</h2>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1.5rem;">
        ${cards}
      </div>
    </div>
  </section>
  <style>
    .testimonial-card { background:#fff; border-radius:var(--radius); padding:2rem; box-shadow:0 1px 4px rgba(0,0,0,0.07); }
  </style>`
}

function renderContact(content: ContactContent, sectionId: string, id: string): string {
  const fields = content.formFields.map(f => {
    const req = f.required ? ' required' : ''
    const ph = f.placeholder ? ` placeholder="${escAttr(f.placeholder)}"` : ''

    if (f.type === 'signature') {
      return `
      <div class="form-group" style="grid-column:1/-1;">
        <label>${escHtml(f.label)}${f.required ? ' *' : ''}</label>
        <div style="position:relative;">
          <canvas id="sig_${escAttr(f.name)}" width="500" height="150"
            style="border:2px solid #e5e7eb; border-radius:var(--radius); width:100%; touch-action:none; background:#fff; cursor:crosshair;"></canvas>
          <button type="button" onclick="clearSig('${escAttr(f.name)}')"
            style="position:absolute; top:8px; right:8px; font-size:0.8rem; padding:4px 10px; background:#fee2e2; border:none; border-radius:4px; cursor:pointer; color:#dc2626;">Clear</button>
        </div>
        <input type="hidden" name="${escAttr(f.name)}" id="sig_input_${escAttr(f.name)}">
      </div>`
    }
    if (f.type === 'textarea') {
      return `
      <div class="form-group" style="grid-column:1/-1;">
        <label>${escHtml(f.label)}${f.required ? ' *' : ''}</label>
        <textarea name="${escAttr(f.name)}"${ph}${req} rows="4"></textarea>
      </div>`
    }
    if (f.type === 'select') {
      const opts = (f.options || []).map(o => `<option value="${escAttr(o)}">${escHtml(o)}</option>`).join('')
      return `
      <div class="form-group">
        <label>${escHtml(f.label)}${f.required ? ' *' : ''}</label>
        <select name="${escAttr(f.name)}"${req}><option value="">Select…</option>${opts}</select>
      </div>`
    }
    if (f.type === 'checkbox') {
      return `
      <div class="form-group" style="flex-direction:row; align-items:center; gap:0.5rem;">
        <input type="checkbox" name="${escAttr(f.name)}" id="cb_${escAttr(f.name)}"${req}>
        <label for="cb_${escAttr(f.name)}" style="margin:0;">${escHtml(f.label)}</label>
      </div>`
    }
    return `
    <div class="form-group">
      <label>${escHtml(f.label)}${f.required ? ' *' : ''}</label>
      <input type="${f.type}" name="${escAttr(f.name)}"${ph}${req}>
    </div>`
  }).join('')

  const hasSig = content.formFields.some(f => f.type === 'signature')
  const sigNames = content.formFields.filter(f => f.type === 'signature').map(f => f.name)

  const sigScript = hasSig ? `
  <script>
    (function() {
      var canvases = {};
      ${sigNames.map(n => `
      (function(){
        var canvas = document.getElementById('sig_${n}');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var drawing = false;
        function pos(e) {
          var r = canvas.getBoundingClientRect();
          var scaleX = canvas.width / r.width;
          var scaleY = canvas.height / r.height;
          var src = e.touches ? e.touches[0] : e;
          return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
        }
        canvas.addEventListener('mousedown', function(e){ drawing=true; ctx.beginPath(); var p=pos(e); ctx.moveTo(p.x,p.y); });
        canvas.addEventListener('mousemove', function(e){ if(!drawing) return; var p=pos(e); ctx.lineTo(p.x,p.y); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke(); });
        canvas.addEventListener('mouseup', function(){ drawing=false; document.getElementById('sig_input_${n}').value=canvas.toDataURL(); });
        canvas.addEventListener('touchstart', function(e){ e.preventDefault(); drawing=true; ctx.beginPath(); var p=pos(e); ctx.moveTo(p.x,p.y); }, {passive:false});
        canvas.addEventListener('touchmove', function(e){ e.preventDefault(); if(!drawing) return; var p=pos(e); ctx.lineTo(p.x,p.y); ctx.strokeStyle='#111'; ctx.lineWidth=2; ctx.lineCap='round'; ctx.stroke(); }, {passive:false});
        canvas.addEventListener('touchend', function(){ drawing=false; document.getElementById('sig_input_${n}').value=canvas.toDataURL(); });
      })();`).join('')}
    })();
    function clearSig(name) {
      var canvas = document.getElementById('sig_' + name);
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
      document.getElementById('sig_input_' + name).value = '';
    }
  </script>` : ''

  const infoBlock = [
    content.email ? `<div class="contact-info-item">📧 <a href="mailto:${escAttr(content.email)}">${escHtml(content.email)}</a></div>` : '',
    content.phone ? `<div class="contact-info-item">📞 <a href="tel:${escAttr(content.phone)}">${escHtml(content.phone)}</a></div>` : '',
    content.address ? `<div class="contact-info-item">📍 ${escHtml(content.address)}</div>` : '',
  ].filter(Boolean).join('')

  return `
  <section id="${id}" style="background:#f9fafb;">
    <div class="container" style="max-width:800px;">
      <h2 class="section-heading">${escHtml(content.heading)}</h2>
      ${content.subheading ? `<p class="section-sub">${escHtml(content.subheading)}</p>` : ''}
      ${infoBlock ? `<div class="contact-info">${infoBlock}</div>` : ''}
      <form id="form_${sectionId}" class="contact-form" onsubmit="submitForm_${sectionId}(event)">
        <div class="form-grid">
          ${fields}
        </div>
        <button type="submit" class="btn btn-primary" style="margin-top:1.5rem; width:100%;">
          ${escHtml(content.submitLabel || 'Send Message')}
        </button>
        <div id="form_msg_${sectionId}" style="display:none; margin-top:1rem; padding:1rem; border-radius:var(--radius);"></div>
      </form>
    </div>
  </section>
  <style>
    .contact-info { display:flex; flex-wrap:wrap; gap:1.5rem; justify-content:center; margin-bottom:2.5rem; }
    .contact-info-item { font-size:1rem; color:#374151; }
    .contact-form { background:#fff; padding:2.5rem; border-radius:var(--radius); box-shadow:0 1px 4px rgba(0,0,0,0.07); }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; }
    .form-group { display:flex; flex-direction:column; gap:0.4rem; }
    .form-group label { font-weight:500; font-size:0.9rem; color:#374151; }
    .form-group input, .form-group textarea, .form-group select {
      padding:0.65rem 0.9rem; border:1.5px solid #e5e7eb; border-radius:var(--radius);
      font-family:var(--font); font-size:1rem; color:var(--text); background:#fff;
      transition:border-color 0.2s; outline:none;
    }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus { border-color:var(--primary); }
    @media (max-width:600px) { .form-grid { grid-template-columns:1fr; } }
  </style>
  <script>
    async function submitForm_${sectionId}(e) {
      e.preventDefault();
      var form = document.getElementById('form_${sectionId}');
      var msg = document.getElementById('form_msg_${sectionId}');
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        var data = Object.fromEntries(new FormData(form).entries());
        var res = await fetch('/api/submit-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionId: '${sectionId}', data })
        });
        if (res.ok) {
          msg.style.display = 'block';
          msg.style.background = '#d1fae5';
          msg.style.color = '#065f46';
          msg.textContent = 'Message sent! We will be in touch soon.';
          form.reset();
        } else {
          throw new Error('Failed');
        }
      } catch {
        msg.style.display = 'block';
        msg.style.background = '#fee2e2';
        msg.style.color = '#991b1b';
        msg.textContent = 'Something went wrong. Please try again.';
      }
      btn.disabled = false;
      btn.textContent = '${escHtml(content.submitLabel || 'Send Message')}';
    }
  </script>
  ${sigScript}`
}

function renderCustom(content: CustomContent, id: string): string {
  return `<section id="${id}">${content.html}</section>`
}

// ── Section dispatcher ────────────────────────────────────────

function renderSection(row: SectionRow, theme: Theme): string {
  const sectionId = `sec_${row.id.replace(/-/g, '').substring(0, 8)}`
  const c = row.content as Record<string, unknown>

  try {
    switch (row.type) {
      case 'hero':
        return renderHero(c as unknown as HeroContent, theme, sectionId)
      case 'about':
        return renderAbout(c as unknown as AboutContent, sectionId)
      case 'services':
        return renderServices(c as unknown as ServicesContent, sectionId)
      case 'team':
        return renderTeam(c as unknown as TeamContent, sectionId)
      case 'testimonials':
        return renderTestimonials(c as unknown as TestimonialsContent, sectionId)
      case 'contact':
        return renderContact(c as unknown as ContactContent, row.id, sectionId)
      case 'custom':
        return renderCustom(c as unknown as CustomContent, sectionId)
      default:
        return `<!-- Unknown section type: ${row.type} -->`
    }
  } catch (err) {
    console.error(`Error rendering section ${row.id} (${row.type}):`, err)
    return `<!-- Section render error: ${row.type} -->`
  }
}

// ── Footer ────────────────────────────────────────────────────
function renderFooter(siteName: string, updateEmail?: string): string {
  return `
  <footer style="background:#111827; color:#9ca3af; text-align:center; padding:2.5rem 1.5rem;">
    <p style="margin-bottom:0.5rem; font-weight:500; color:#fff;">${escHtml(siteName)}</p>
    <p style="font-size:0.85rem;">
      Powered by <a href="https://sitesync.app" style="color:#60a5fa;">SiteSync</a>
      ${updateEmail ? ` · Update: <a href="mailto:${escAttr(updateEmail)}" style="color:#6b7280; font-size:0.8rem;">${escHtml(updateEmail)}</a>` : ''}
    </p>
  </footer>`
}

// ── Main render function ──────────────────────────────────────
export function renderPage(opts: RenderPageOptions): string {
  const { page, sections, theme, siteName, allPages = [page], updateEmail } = opts

  const sorted = [...sections]
    .filter(s => s.published)
    .sort((a, b) => a.order_index - b.order_index)

  const sectionsHtml = sorted.map(s => renderSection(s, theme)).join('\n')

  const additionalCss = [
    page.page_css,
    ...sorted.map(s => s.section_css).filter(Boolean),
  ].filter(Boolean).join('\n')

  const additionalJs = [
    page.page_js,
    ...sorted.map(s => s.section_js).filter(Boolean),
  ].filter(Boolean).join('\n')

  const metaTitle = page.meta_title || `${page.title} | ${siteName}`
  const metaDesc = page.meta_description || ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(metaTitle)}</title>
  ${metaDesc ? `<meta name="description" content="${escAttr(metaDesc)}">` : ''}
  ${page.og_image_url ? `<meta property="og:image" content="${escAttr(page.og_image_url)}">` : ''}
  ${googleFontsLink(theme)}
  <style>
    ${baseStyles(theme)}
    ${additionalCss}
  </style>
</head>
<body>
  ${renderNav(siteName, allPages, page.slug)}
  ${sectionsHtml}
  ${renderFooter(siteName, updateEmail)}
  ${additionalJs ? `<script>${additionalJs}</script>` : ''}
</body>
</html>`
}

// ── HTML escaping helpers ─────────────────────────────────────
function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escAttr(s: string): string {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
