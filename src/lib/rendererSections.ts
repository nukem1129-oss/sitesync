// ============================================================
// SiteSync v2 — Section renderers
// Each function returns an HTML string for one section type
// ============================================================
import type { ThemeConfig } from '@/types/site'

// Convert a hex color to rgba with given alpha — used for themed section backgrounds
export function hexToRgba(hex: string, alpha: number): string {
  const full = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (_, r, g, b) => r + r + g + g + b + b)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full.replace('#', ''))
  if (!result) return `rgba(99,102,241,${alpha})`
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`
}

export function esc(str: string): string {
  return str
    .replace(/\s*—\s*/g, ' ')   // em dash (—) → space: used as sentence separator, never wanted
    // en dash (–) intentionally NOT stripped: correct typography for number ranges (8–14 weeks)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderHero(c: Record<string, unknown>, t: ThemeConfig): string {
  const bgColor = String(c.backgroundValue || c.backgroundOverlay || `linear-gradient(135deg,${t.primaryColor} 0%,${t.secondaryColor ?? t.primaryColor} 100%)`)
  const bgImage = c.backgroundImage ? String(c.backgroundImage) : null
  const bgStyle = bgImage
    ? `background:linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)),url('${esc(bgImage)}') center/cover no-repeat`
    : `background:${bgColor}`
  return `<section style="${bgStyle};padding:7rem 1.5rem 6rem;text-align:center;color:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-100px;right:-100px;width:500px;height:500px;border-radius:50%;background:rgba(255,255,255,0.05);pointer-events:none;"></div>
  <div style="position:absolute;bottom:-150px;left:-80px;width:380px;height:380px;border-radius:50%;background:rgba(255,255,255,0.04);pointer-events:none;"></div>
  <div style="position:relative;max-width:820px;margin:0 auto;">
    <h1 style="font-size:clamp(2.25rem,5vw,4rem);font-weight:800;line-height:1.1;margin-bottom:1.5rem;letter-spacing:-0.03em;">${esc(String(c.headline ?? ''))}</h1>
    ${c.subheadline ? `<p style="font-size:1.2rem;opacity:0.88;margin-bottom:3rem;max-width:620px;margin-left:auto;margin-right:auto;">${esc(String(c.subheadline))}</p>` : ''}
    ${c.ctaText ? `<a href="${esc(String(c.ctaLink ?? '#contact'))}" class="ss-btn" style="background:#fff;color:${esc(t.primaryColor)};">${esc(String(c.ctaText))}</a>` : ''}
  </div>
</section>`
}

export function renderPageHeader(c: Record<string, unknown>, t: ThemeConfig): string {
  const bg = String(c.backgroundValue || c.backgroundOverlay || t.primaryColor)
  return `<section style="background:${bg};padding:5rem 1.5rem 4rem;color:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.06);pointer-events:none;"></div>
  <div style="max-width:800px;margin:0 auto;position:relative;">
    <h1 style="font-size:clamp(1.75rem,4vw,3rem);font-weight:800;line-height:1.15;margin-bottom:1rem;letter-spacing:-0.02em;">${esc(String(c.heading ?? ''))}</h1>
    ${c.subheading ? `<p style="font-size:1.1rem;opacity:0.88;max-width:600px;">${esc(String(c.subheading))}</p>` : ''}
  </div>
</section>`
}

export function renderAbout(c: Record<string, unknown>, t: ThemeConfig): string {
  const layout = String(c.layout ?? '')
  const stats = Array.isArray(c.stats) ? (c.stats as Array<Record<string, unknown>>) : []
  const values = Array.isArray(c.values) ? (c.values as Array<Record<string, unknown>>) : []
  const image = c.image ? String(c.image) : (c.logo ? String(c.logo) : null)
  const tint = hexToRgba(t.primaryColor, 0.05)

  // ── Layout: mission-first ─────────────────────────────────
  if (layout === 'mission-first' || (layout !== 'narrative' && !stats.length && values.length)) {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;margin-bottom:1.5rem;">${esc(String(c.heading ?? 'Our Mission'))}</h2>
    ${c.mission ? `<p style="font-size:1.3rem;font-style:italic;color:${esc(t.primaryColor)};line-height:1.7;margin-bottom:1.5rem;max-width:720px;margin-left:auto;margin-right:auto;">"${esc(String(c.mission))}"</p>` : ''}
    ${c.body ? `<p style="color:#4b5563;font-size:1.05rem;line-height:1.9;margin-bottom:3.5rem;">${esc(String(c.body))}</p>` : ''}
    ${values.length ? `<div class="ss-grid-3" style="text-align:left;">
      ${values.map(v => `<div style="padding:2rem;border-radius:12px;background:${tint};border-top:3px solid ${esc(t.primaryColor)};">
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.6rem;">${esc(String(v.title ?? ''))}</h3>
        <p style="color:#4b5563;line-height:1.7;font-size:0.95rem;">${esc(String(v.description ?? ''))}</p>
      </div>`).join('')}
    </div>` : ''}
  </div>
</section>`
  }

  // ── Layout: narrative ─────────────────────────────────────
  if (layout === 'narrative') {
    return `<section style="padding:6rem 1.5rem;background:${esc(t.primaryColor)};">
  <div class="ss-grid-2" style="max-width:1100px;margin:0 auto;align-items:center;">
    <div style="color:#fff;">
      <h2 style="font-size:2.25rem;font-weight:800;margin-bottom:1.75rem;line-height:1.2;letter-spacing:-0.02em;">${esc(String(c.heading ?? 'Our Story'))}</h2>
      ${c.body ? `<p style="font-size:1.1rem;line-height:1.95;opacity:0.92;">${esc(String(c.body))}</p>` : ''}
      ${c.mission ? `<p style="margin-top:2rem;font-size:1rem;font-style:italic;opacity:0.8;border-left:3px solid rgba(255,255,255,0.4);padding-left:1.25rem;">${esc(String(c.mission))}</p>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      ${image
        ? `<img src="${esc(image)}" alt="${esc(String(c.heading ?? ''))}" style="width:100%;border-radius:16px;object-fit:cover;max-height:400px;" />`
        : `<div style="background:rgba(255,255,255,0.12);border-radius:16px;height:320px;display:flex;align-items:center;justify-content:center;">
          <div style="font-size:5rem;font-weight:900;color:rgba(255,255,255,0.2);letter-spacing:-0.05em;">${esc(String(c.heading ?? 'Our Story')[0])}</div>
        </div>`
      }
    </div>
  </div>
</section>`
  }

  // ── Layout: split-stats (default) ────────────────────────
  if (stats.length) {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div class="ss-grid-2" style="max-width:1100px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});border-radius:16px;padding:3rem;color:#fff;">
      ${image ? `<img src="${esc(image)}" alt="${esc(String(c.heading ?? 'About'))}" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:2rem;" />` : ''}
      ${stats.map(s => `<div style="margin-bottom:2rem;">
        <div style="font-size:3rem;font-weight:800;line-height:1;">${esc(String(s.value ?? ''))}</div>
        <div style="opacity:0.8;margin-top:0.25rem;font-size:0.95rem;">${esc(String(s.label ?? ''))}</div>
      </div>`).join('')}
    </div>
    <div>
      <h2 style="font-size:2.25rem;font-weight:800;margin-bottom:1.5rem;letter-spacing:-0.02em;">${esc(String(c.heading ?? 'About Us'))}</h2>
      ${c.mission ? `<p style="color:${esc(t.primaryColor)};font-weight:600;font-size:1.05rem;margin-bottom:1.25rem;font-style:italic;">"${esc(String(c.mission))}"</p>` : ''}
      ${c.body ? `<p style="color:#4b5563;font-size:1.1rem;line-height:1.85;">${esc(String(c.body))}</p>` : ''}
    </div>
  </div>
</section>`
  }

  // Fallback: centered
  return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:760px;margin:0 auto;text-align:center;">
    ${image ? `<img src="${esc(image)}" alt="${esc(String(c.heading ?? 'About'))}" style="max-width:240px;max-height:160px;object-fit:contain;margin:0 auto 2.5rem;display:block;" />` : ''}
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;margin-bottom:1.75rem;">${esc(String(c.heading ?? 'About Us'))}</h2>
    ${c.body ? `<p style="color:#4b5563;font-size:1.1rem;line-height:1.9;">${esc(String(c.body))}</p>` : ''}
  </div>
</section>`
}

export function renderServices(c: Record<string, unknown>, t: ThemeConfig): string {
  const svcs = Array.isArray(c.services) ? (c.services as Array<Record<string, unknown>>) : []
  const layout = String(c.layout ?? 'card-grid')
  const tint = hexToRgba(t.primaryColor, 0.05)
  const heading = `<div style="text-align:center;margin-bottom:3.5rem;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Our Services'))}</h2>
    ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;max-width:600px;margin-left:auto;margin-right:auto;">${esc(String(c.subheading))}</p>` : ''}
  </div>`

  // ── Layout: icon-rows (B2B / detailed services) ───────────
  if (layout === 'icon-rows') {
    return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:900px;margin:0 auto;">
    ${heading}
    <div style="display:flex;flex-direction:column;gap:0;">
      ${svcs.map((s, i) => {
        const includes = Array.isArray(s.includes) ? (s.includes as string[]) : []
        return `<div style="display:flex;gap:2rem;align-items:flex-start;padding:2.5rem 0;${i > 0 ? 'border-top:1px solid #e5e7eb;' : ''}">
          <div style="flex-shrink:0;width:48px;height:48px;border-radius:12px;background:${esc(t.primaryColor)};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;">${i + 1}</div>
          <div style="flex:1;">
            <h3 style="font-size:1.2rem;font-weight:700;margin-bottom:0.6rem;">${esc(String(s.title ?? ''))}</h3>
            <p style="color:#4b5563;line-height:1.8;margin-bottom:${includes.length ? '1rem' : '0'};">${esc(String(s.description ?? ''))}</p>
            ${includes.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
              ${includes.map(inc => `<span style="background:#fff;border:1px solid #e5e7eb;border-radius:999px;padding:0.2rem 0.85rem;font-size:0.82rem;color:#374151;">${esc(inc)}</span>`).join('')}
            </div>` : ''}
            ${s.price ? `<p style="margin-top:0.85rem;font-weight:700;color:${esc(t.primaryColor)};font-size:0.97rem;">${esc(String(s.price))}</p>` : ''}
          </div>
        </div>`
      }).join('')}
    </div>
  </div>
</section>`
  }

  // ── Layout: showcase (premium / featured services) ────────
  if (layout === 'showcase') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:1000px;margin:0 auto;">
    ${heading}
    <div style="display:flex;flex-direction:column;gap:3rem;">
      ${svcs.map((s, i) => {
        const includes = Array.isArray(s.includes) ? (s.includes as string[]) : []
        const isEven = i % 2 === 0
        return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center;${!isEven ? 'direction:rtl;' : ''}">
          <div style="${!isEven ? 'direction:ltr;' : ''}background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});border-radius:16px;padding:3rem;color:#fff;min-height:280px;display:flex;flex-direction:column;justify-content:center;">
            <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;opacity:0.7;margin-bottom:0.75rem;">Service ${String(i + 1).padStart(2, '0')}</div>
            <h3 style="font-size:1.6rem;font-weight:800;margin-bottom:0.75rem;line-height:1.2;">${esc(String(s.title ?? ''))}</h3>
            ${s.price ? `<p style="font-size:1.1rem;font-weight:700;opacity:0.9;">${esc(String(s.price))}</p>` : ''}
          </div>
          <div style="${!isEven ? 'direction:ltr;' : ''}">
            <p style="color:#374151;line-height:1.85;font-size:1.05rem;margin-bottom:${includes.length ? '1.5rem' : '0'};">${esc(String(s.description ?? ''))}</p>
            ${includes.length ? `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:0.5rem;">
              ${includes.map(inc => `<li style="display:flex;gap:0.6rem;align-items:center;font-size:0.95rem;color:#374151;">
                <span style="color:${esc(t.primaryColor)};font-weight:700;flex-shrink:0;">✓</span>${esc(inc)}
              </li>`).join('')}
            </ul>` : ''}
          </div>
        </div>`
      }).join('')}
    </div>
  </div>
</section>`
  }

  // ── Layout: card-grid (default) ───────────────────────────
  return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:1100px;margin:0 auto;">
    ${heading}
    <div class="ss-grid-3">
      ${svcs.map(s => `<div class="ss-card" style="background:#fff;border-radius:12px;padding:2.25rem;box-shadow:0 1px 6px rgba(0,0,0,0.07);border-top:3px solid ${esc(t.primaryColor)};">
        <div style="width:36px;height:4px;background:${esc(t.primaryColor)};border-radius:2px;margin-bottom:1.25rem;"></div>
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.75rem;">${esc(String(s.title ?? ''))}</h3>
        <p style="color:#4b5563;line-height:1.75;font-size:0.97rem;">${esc(String(s.description ?? ''))}</p>
        ${s.price ? `<p style="margin-top:1.25rem;font-weight:700;color:${esc(t.primaryColor)};">${esc(String(s.price))}</p>` : ''}
      </div>`).join('')}
    </div>
  </div>
</section>`
}

export function renderFeatures(c: Record<string, unknown>, t: ThemeConfig): string {
  const features = Array.isArray(c.features) ? (c.features as Array<Record<string, unknown>>) : []
  const isDark = c.background === 'dark'
  const bg = isDark ? '#0f172a' : '#fff'
  const headColor = isDark ? '#f1f5f9' : '#111'
  const subColor = isDark ? '#94a3b8' : '#6b7280'
  const cardBg = isDark ? '#1e293b' : '#f8f9fc'
  const cardText = isDark ? '#e2e8f0' : '#4b5563'
  return `<section style="padding:6rem 1.5rem;background:${bg};">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;color:${headColor};">${esc(String(c.heading ?? 'Features'))}</h2>
      ${c.subheading ? `<p style="color:${subColor};font-size:1.1rem;margin-top:1.25rem;max-width:600px;margin-left:auto;margin-right:auto;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div class="ss-grid-3">
      ${features.map(f => `<div class="ss-card" style="padding:2rem;border-radius:12px;background:${cardBg};">
        <div style="width:44px;height:4px;background:${esc(t.primaryColor)};border-radius:2px;margin-bottom:1rem;"></div>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.6rem;color:${headColor};">${esc(String(f.title ?? ''))}</h3>
        <p style="color:${cardText};line-height:1.75;font-size:0.95rem;">${esc(String(f.description ?? ''))}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`
}

export function renderTeam(c: Record<string, unknown>, t: ThemeConfig): string {
  const members = Array.isArray(c.members) ? (c.members as Array<Record<string, unknown>>) : []
  return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Our Team'))}</h2>
    </div>
    <div class="ss-grid-4">
      ${members.map(m => {
        const name = String(m.name ?? '?')
        const photo = m.photo ? String(m.photo) : null
        const avatar = photo
          ? `<img src="${esc(photo)}" alt="${esc(name)}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;margin:0 auto 1.25rem;display:block;border:3px solid ${esc(t.primaryColor)};" />`
          : `<div style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});margin:0 auto 1.25rem;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;font-weight:800;">${esc(name[0])}</div>`
        return `<div class="ss-card" style="text-align:center;padding:2.5rem 1.5rem;background:#fff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
          ${avatar}
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.2rem;">${esc(name)}</h3>
          <p style="color:${esc(t.primaryColor)};font-weight:600;font-size:0.8rem;margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.06em;">${esc(String(m.role ?? ''))}</p>
          ${m.bio ? `<p style="color:#6b7280;font-size:0.88rem;line-height:1.65;">${esc(String(m.bio))}</p>` : ''}
        </div>`
      }).join('')}
    </div>
  </div>
</section>`
}

export function renderTestimonials(c: Record<string, unknown>, t: ThemeConfig): string {
  const tms = Array.isArray(c.testimonials) ? (c.testimonials as Array<Record<string, unknown>>) : []
  return `<section style="padding:6rem 1.5rem;background:${hexToRgba(t.primaryColor, 0.04)};">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'What Our Clients Say'))}</h2>
    </div>
    <div class="ss-grid-3">
      ${tms.map(tm => {
        const authorName = String(tm.author ?? '?')
        const photo = tm.photo ? String(tm.photo) : null
        const authorAvatar = photo
          ? `<img src="${esc(photo)}" alt="${esc(authorName)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;" />`
          : `<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9rem;">${esc(authorName[0])}</div>`
        return `<div class="ss-card" style="background:#fff;border-radius:12px;padding:2.25rem;box-shadow:0 1px 6px rgba(0,0,0,0.07);border-left:4px solid ${esc(t.primaryColor)};position:relative;">
        <div style="font-size:5rem;line-height:1;color:${esc(t.primaryColor)};opacity:0.1;position:absolute;top:0.75rem;left:1.25rem;font-family:Georgia,serif;pointer-events:none;">&ldquo;</div>
        <div style="position:relative;">
          ${tm.rating ? `<div style="color:#f59e0b;margin-bottom:0.75rem;font-size:1.1rem;">${'★'.repeat(Number(tm.rating))}</div>` : ''}
          <p style="color:#374151;line-height:1.8;margin-bottom:1.5rem;font-size:0.97rem;">"${esc(String(tm.quote ?? ''))}"</p>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            ${authorAvatar}
            <div>
              <div style="font-weight:700;font-size:0.95rem;">${esc(authorName)}</div>
              ${(tm.role || tm.company) ? `<div style="font-size:0.8rem;color:#9ca3af;">${[tm.role, tm.company].filter(Boolean).map(x => esc(String(x))).join(' · ')}</div>` : ''}
            </div>
          </div>
        </div>
      </div>`}).join('')}
    </div>
  </div>
</section>`
}

export function renderProcess(c: Record<string, unknown>, t: ThemeConfig): string {
  const steps = Array.isArray(c.steps) ? (c.steps as Array<Record<string, unknown>>) : []
  return `<section style="padding:6rem 1.5rem;background:${hexToRgba(t.primaryColor, 0.05)};">
  <div style="max-width:860px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'How It Works'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;">
      ${steps.map((step, i) => `<div style="display:flex;gap:2rem;align-items:flex-start;padding:2rem 0;${i > 0 ? 'border-top:1px solid #e5e7eb;' : ''}">
        <div style="flex-shrink:0;width:52px;height:52px;border-radius:50%;background:${esc(t.primaryColor)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;">${i + 1}</div>
        <div style="padding-top:0.75rem;">
          <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.5rem;">${esc(String(step.title ?? ''))}</h3>
          <p style="color:#4b5563;line-height:1.75;">${esc(String(step.description ?? ''))}</p>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`
}

export function renderFAQ(c: Record<string, unknown>): string {
  const faqs = Array.isArray(c.faqs) ? (c.faqs as Array<Record<string, unknown>>) : []
  return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:800px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Frequently Asked Questions'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:0.75rem;">
      ${faqs.map(f => `<details class="ss-faq" style="border:1.5px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <summary style="padding:1.25rem 1.5rem;font-weight:600;font-size:1rem;background:#fff;user-select:none;">
          <span>${esc(String(f.question ?? ''))}</span>
          <span class="ss-faq-icon" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#f3f4f6;font-size:1rem;color:#374151;flex-shrink:0;">+</span>
        </summary>
        <div style="padding:0 1.5rem 1.25rem;color:#4b5563;line-height:1.75;border-top:1px solid #f3f4f6;">${esc(String(f.answer ?? ''))}</div>
      </details>`).join('')}
    </div>
  </div>
</section>`
}

export function renderPricing(c: Record<string, unknown>, t: ThemeConfig): string {
  const tiers = Array.isArray(c.tiers) ? (c.tiers as Array<Record<string, unknown>>) : []
  return `<section style="padding:6rem 1.5rem;background:${hexToRgba(t.primaryColor, 0.05)};">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Pricing'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;max-width:600px;margin-left:auto;margin-right:auto;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div class="ss-grid-3" style="align-items:start;">
      ${tiers.map(tier => {
        const featured = !!tier.featured
        const feats = Array.isArray(tier.features) ? (tier.features as string[]) : []
        return `<div style="background:${featured ? esc(t.primaryColor) : '#fff'};color:${featured ? '#fff' : '#111'};border-radius:16px;padding:2.5rem;box-shadow:0 ${featured ? '8px 32px rgba(0,0,0,0.18)' : '2px 12px rgba(0,0,0,0.08)'};${featured ? 'transform:scale(1.03);' : ''}">
          ${tier.badge ? `<div style="display:inline-block;background:${featured ? 'rgba(255,255,255,0.2)' : esc(t.primaryColor)};color:#fff;padding:0.2rem 0.85rem;border-radius:999px;font-size:0.75rem;font-weight:700;margin-bottom:1rem;">${esc(String(tier.badge))}</div>` : ''}
          <h3 style="font-size:1.3rem;font-weight:700;margin-bottom:0.5rem;">${esc(String(tier.name ?? ''))}</h3>
          <div style="font-size:2.75rem;font-weight:800;margin-bottom:0.25rem;letter-spacing:-0.03em;">${esc(String(tier.price ?? ''))}</div>
          ${tier.period ? `<div style="opacity:0.7;font-size:0.9rem;margin-bottom:1.5rem;">${esc(String(tier.period))}</div>` : '<div style="margin-bottom:1.5rem;"></div>'}
          ${tier.description ? `<p style="opacity:0.8;font-size:0.95rem;margin-bottom:1.5rem;line-height:1.6;">${esc(String(tier.description))}</p>` : ''}
          <ul style="list-style:none;padding:0;margin:0 0 2rem;display:flex;flex-direction:column;gap:0.6rem;">
            ${feats.map(f => `<li style="display:flex;gap:0.6rem;align-items:flex-start;font-size:0.94rem;">
              <span style="color:${featured ? '#fff' : esc(t.primaryColor)};font-weight:700;flex-shrink:0;">✓</span>
              <span>${esc(f)}</span>
            </li>`).join('')}
          </ul>
          ${tier.ctaText ? `<a href="${esc(String(tier.ctaLink ?? '#contact'))}" class="ss-btn" style="display:block;text-align:center;background:${featured ? '#fff' : esc(t.primaryColor)};color:${featured ? esc(t.primaryColor) : '#fff'};">${esc(String(tier.ctaText))}</a>` : ''}
        </div>`
      }).join('')}
    </div>
  </div>
</section>`
}

export function renderGallery(c: Record<string, unknown>, t: ThemeConfig): string {
  const items = Array.isArray(c.items) ? (c.items as Array<Record<string, unknown>>) : []
  return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Gallery'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div class="ss-grid-3">
      ${items.map(item => {
        const img = item.image ? String(item.image) : null
        const placeholder = `<div style="background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});height:200px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;font-weight:700;">${esc(String(item.title ?? '')[0] ?? '')}</div>`
        const media = img
          ? `<img src="${esc(img)}" alt="${esc(String(item.title ?? ''))}" style="width:100%;height:200px;object-fit:cover;display:block;" />`
          : placeholder
        return `<div class="ss-card" style="border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        ${media}
        ${item.title || item.description ? `<div style="padding:1.5rem;">
          ${item.title ? `<h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.5rem;">${esc(String(item.title))}</h3>` : ''}
          ${item.description ? `<p style="color:#4b5563;font-size:0.95rem;line-height:1.7;">${esc(String(item.description))}</p>` : ''}
        </div>` : ''}
      </div>`}).join('')}
    </div>
  </div>
</section>`
}
