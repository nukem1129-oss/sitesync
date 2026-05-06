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
    .replace(/\s*—\s*/g, ' ')   // em dash (—) → space
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Hero ──────────────────────────────────────────────────────────
export function renderHero(c: Record<string, unknown>, t: ThemeConfig): string {
  const layout = String(c.layout ?? 'centered')
  // Always derive gradient from live theme so email theme-changes update the hero too.
  // backgroundImage (real photo) is still respected — only the gradient fallback is theme-driven.
  const bgColor = `linear-gradient(135deg,${t.primaryColor} 0%,${t.secondaryColor ?? t.primaryColor} 100%)`
  const bgImage = c.backgroundImage ? String(c.backgroundImage) : null
  const bgStyle = bgImage
    ? `background:linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)),url('${esc(bgImage)}') center/cover no-repeat`
    : `background:${bgColor}`

  // ── left-text: split layout, text left, visual right ─────────
  if (layout === 'left-text') {
    return `<section style="${bgStyle};padding:5rem 1.5rem;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;opacity:0.04;background:radial-gradient(ellipse at top right, #fff 0%, transparent 60%);pointer-events:none;"></div>
  <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:4rem;align-items:center;position:relative;">
    <div style="color:#fff;">
      <h1 style="font-size:clamp(2rem,4.5vw,3.5rem);font-weight:800;line-height:1.1;margin-bottom:1.25rem;letter-spacing:-0.03em;">${esc(String(c.headline ?? ''))}</h1>
      ${c.subheadline ? `<p style="font-size:1.1rem;opacity:0.88;margin-bottom:2.5rem;line-height:1.7;max-width:480px;">${esc(String(c.subheadline))}</p>` : ''}
      ${c.ctaText ? `<a href="${esc(String(c.ctaLink ?? '#contact'))}" class="ss-btn" style="background:#fff;color:${esc(t.primaryColor)};">${esc(String(c.ctaText))}</a>` : ''}
    </div>
    <div style="display:flex;justify-content:center;align-items:center;">
      <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:24px;width:100%;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);overflow:hidden;">
        <div style="font-size:clamp(5rem,12vw,9rem);font-weight:900;color:rgba(255,255,255,0.12);letter-spacing:-0.05em;line-height:1;user-select:none;">${esc(String(c.headline ?? 'X').split(' ')[0]?.slice(0, 4) ?? '')}</div>
      </div>
    </div>
  </div>
</section>`
  }

  // ── minimal: light background, dark text, premium SaaS feel ──
  if (layout === 'minimal') {
    return `<section style="background:#f8fafc;padding:9rem 1.5rem 8rem;text-align:center;position:relative;overflow:hidden;">
  <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:800px;height:2px;background:linear-gradient(90deg,transparent,${esc(t.primaryColor)},transparent);opacity:0.4;"></div>
  <div style="max-width:760px;margin:0 auto;position:relative;">
    <div style="display:inline-block;background:${hexToRgba(t.primaryColor, 0.1)};color:${esc(t.primaryColor)};padding:0.3rem 1rem;border-radius:999px;font-size:0.82rem;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;margin-bottom:2rem;">${esc(String(c.subheadline ?? '').split('.')[0] ?? '')}</div>
    <h1 style="font-size:clamp(2.5rem,5vw,4.5rem);font-weight:900;line-height:1.05;margin-bottom:1.75rem;letter-spacing:-0.04em;color:#0f172a;">${esc(String(c.headline ?? ''))}</h1>
    ${c.subheadline ? `<p style="font-size:1.2rem;color:#475569;margin-bottom:3rem;line-height:1.7;max-width:580px;margin-left:auto;margin-right:auto;">${esc(String(c.subheadline))}</p>` : ''}
    ${c.ctaText ? `<a href="${esc(String(c.ctaLink ?? '#contact'))}" class="ss-btn" style="background:${esc(t.primaryColor)};color:#fff;">${esc(String(c.ctaText))}</a>` : ''}
  </div>
</section>`
  }

  // ── bold-impact: near-black bg, massive headline ──────────────
  if (layout === 'bold-impact') {
    return `<section style="background:#0f172a;padding:8rem 1.5rem 7rem;position:relative;overflow:hidden;">
  <div style="position:absolute;top:0;right:0;width:700px;height:700px;background:${esc(t.primaryColor)};opacity:0.06;border-radius:0 0 0 350px;pointer-events:none;"></div>
  <div style="position:absolute;bottom:-100px;left:-100px;width:400px;height:400px;background:${esc(t.secondaryColor ?? t.primaryColor)};opacity:0.04;border-radius:50%;pointer-events:none;"></div>
  <div style="max-width:1000px;margin:0 auto;position:relative;">
    <div style="display:inline-block;background:${esc(t.primaryColor)};color:#fff;padding:0.35rem 1rem;border-radius:4px;font-size:0.8rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2.5rem;">${esc(String(c.subheadline ?? '').split('.')[0]?.slice(0, 60) ?? 'Welcome')}</div>
    <h1 style="font-size:clamp(3rem,7vw,6rem);font-weight:900;line-height:1;letter-spacing:-0.04em;color:#f1f5f9;margin-bottom:2rem;">${esc(String(c.headline ?? ''))}</h1>
    ${c.subheadline ? `<p style="font-size:1.2rem;color:#94a3b8;margin-bottom:3.5rem;max-width:580px;line-height:1.7;">${esc(String(c.subheadline))}</p>` : ''}
    ${c.ctaText ? `<a href="${esc(String(c.ctaLink ?? '#contact'))}" class="ss-btn" style="background:${esc(t.primaryColor)};color:#fff;">${esc(String(c.ctaText))}</a>` : ''}
  </div>
</section>`
  }

  // ── centered (default) ────────────────────────────────────────
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

// ── Page Header ───────────────────────────────────────────────────
export function renderPageHeader(c: Record<string, unknown>, t: ThemeConfig): string {
  const bg = t.primaryColor
  return `<section style="background:${bg};padding:5rem 1.5rem 4rem;color:#fff;position:relative;overflow:hidden;">
  <div style="position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.06);pointer-events:none;"></div>
  <div style="max-width:800px;margin:0 auto;position:relative;">
    <h1 style="font-size:clamp(1.75rem,4vw,3rem);font-weight:800;line-height:1.15;margin-bottom:1rem;letter-spacing:-0.02em;">${esc(String(c.heading ?? ''))}</h1>
    ${c.subheading ? `<p style="font-size:1.1rem;opacity:0.88;max-width:600px;">${esc(String(c.subheading))}</p>` : ''}
  </div>
</section>`
}

// ── About ─────────────────────────────────────────────────────────
export function renderAbout(c: Record<string, unknown>, t: ThemeConfig): string {
  const layout = String(c.layout ?? '')
  const stats = Array.isArray(c.stats) ? (c.stats as Array<Record<string, unknown>>) : []
  const values = Array.isArray(c.values) ? (c.values as Array<Record<string, unknown>>) : []
  const pillars = Array.isArray(c.pillars) ? (c.pillars as Array<Record<string, unknown>>) : []
  const milestones = Array.isArray(c.milestones) ? (c.milestones as Array<Record<string, unknown>>) : []
  const image = c.image ? String(c.image) : (c.logo ? String(c.logo) : null)
  const tint = hexToRgba(t.primaryColor, 0.05)

  // ── Layout: timeline ──────────────────────────────────────────
  if (layout === 'timeline') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:860px;margin:0 auto;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;margin-bottom:${c.subheading ? '1rem' : '3.5rem'};">${esc(String(c.heading ?? 'Our Journey'))}</h2>
    ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-bottom:3.5rem;max-width:600px;">${esc(String(c.subheading))}</p>` : ''}
    <div style="position:relative;padding-left:3.5rem;">
      <div style="position:absolute;left:1rem;top:0.5rem;bottom:0;width:2px;background:linear-gradient(to bottom,${esc(t.primaryColor)},${hexToRgba(t.primaryColor, 0.1)});border-radius:1px;"></div>
      ${milestones.map(m => `<div style="position:relative;padding-bottom:3rem;">
        <div style="position:absolute;left:-2.7rem;top:0.3rem;width:14px;height:14px;border-radius:50%;background:${esc(t.primaryColor)};border:3px solid #fff;box-shadow:0 0 0 3px ${hexToRgba(t.primaryColor, 0.2)};"></div>
        <div style="display:inline-block;background:${esc(t.primaryColor)};color:#fff;padding:0.15rem 0.65rem;border-radius:4px;font-size:0.78rem;font-weight:700;margin-bottom:0.6rem;letter-spacing:0.04em;">${esc(String(m.year ?? ''))}</div>
        <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.5rem;color:#111;">${esc(String(m.title ?? ''))}</h3>
        <p style="color:#4b5563;line-height:1.75;font-size:0.97rem;">${esc(String(m.description ?? ''))}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── Layout: numbers-hero ──────────────────────────────────────
  if (layout === 'numbers-hero') {
    return `<section style="background:#f8fafc;padding:6rem 1.5rem;position:relative;overflow:hidden;">
  <div style="position:absolute;top:0;right:0;width:500px;height:500px;background:${esc(t.primaryColor)};opacity:0.04;border-radius:0 0 0 250px;pointer-events:none;"></div>
  <div style="max-width:1100px;margin:0 auto;position:relative;text-align:center;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;color:#0f172a;margin-bottom:${c.subheading ? '0.75rem' : '3.5rem'};">${esc(String(c.heading ?? ''))}</h2>
    ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-bottom:3.5rem;max-width:580px;margin-left:auto;margin-right:auto;">${esc(String(c.subheading))}</p>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:2.5rem;margin-bottom:${c.body ? '4rem' : '0'};">
      ${stats.map(s => `<div>
        <div style="font-size:3.5rem;font-weight:900;color:${esc(t.primaryColor)};line-height:1;margin-bottom:0.4rem;">${esc(String(s.value ?? ''))}</div>
        <div style="color:#6b7280;font-size:0.95rem;">${esc(String(s.label ?? ''))}</div>
      </div>`).join('')}
    </div>
    ${c.body ? `<p style="color:#4b5563;font-size:1.1rem;line-height:1.8;max-width:720px;margin:0 auto;">${esc(String(c.body))}</p>` : ''}
  </div>
</section>`
  }

  // ── Layout: icon-pillars ──────────────────────────────────────
  if (layout === 'icon-pillars' || pillars.length) {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Our Approach'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;max-width:600px;margin-left:auto;margin-right:auto;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div class="ss-grid-3">
      ${pillars.map(p => `<div class="ss-card" style="padding:2.5rem;border-radius:16px;background:#f8fafc;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,0.04);">
        <div style="font-size:2.5rem;margin-bottom:1rem;">${String(p.icon ?? '')}</div>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.6rem;">${esc(String(p.title ?? ''))}</h3>
        <p style="color:#4b5563;line-height:1.75;font-size:0.95rem;">${esc(String(p.description ?? ''))}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── Layout: mission-first ─────────────────────────────────────
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

  // ── Layout: narrative ─────────────────────────────────────────
  if (layout === 'narrative') {
    return `<section style="padding:6rem 1.5rem;background:#f1f5f9;">
  <div class="ss-grid-2" style="max-width:1100px;margin:0 auto;align-items:center;">
    <div style="background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});border-radius:16px;padding:3rem;color:#fff;">
      <h2 style="font-size:2.25rem;font-weight:800;margin-bottom:1.75rem;line-height:1.2;letter-spacing:-0.02em;">${esc(String(c.heading ?? 'Our Story'))}</h2>
      ${c.body ? `<p style="font-size:1.1rem;line-height:1.95;opacity:0.92;">${esc(String(c.body))}</p>` : ''}
      ${c.mission ? `<p style="margin-top:2rem;font-size:1rem;font-style:italic;opacity:0.8;border-left:3px solid rgba(255,255,255,0.4);padding-left:1.25rem;">${esc(String(c.mission))}</p>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      ${image
        ? `<img src="${esc(image)}" alt="${esc(String(c.heading ?? ''))}" style="width:100%;border-radius:16px;object-fit:cover;max-height:400px;" />`
        : `<div style="background:#fff;border-radius:16px;height:320px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
          <div style="font-size:5rem;font-weight:900;color:${hexToRgba(t.primaryColor, 0.15)};letter-spacing:-0.05em;">${esc(String(c.heading ?? 'Story')[0])}</div>
        </div>`
      }
    </div>
  </div>
</section>`
  }

  // ── Layout: split-stats (default) ────────────────────────────
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

// ── Services ──────────────────────────────────────────────────────
export function renderServices(c: Record<string, unknown>, t: ThemeConfig): string {
  const svcs = Array.isArray(c.services) ? (c.services as Array<Record<string, unknown>>) : []
  const layout = String(c.layout ?? 'card-grid')
  const tint = hexToRgba(t.primaryColor, 0.05)
  const heading = `<div style="text-align:center;margin-bottom:3.5rem;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Our Services'))}</h2>
    ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;max-width:600px;margin-left:auto;margin-right:auto;">${esc(String(c.subheading))}</p>` : ''}
  </div>`

  // ── Layout: icon-rows ─────────────────────────────────────────
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

  // ── Layout: showcase ──────────────────────────────────────────
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

  // ── Layout: accordion ─────────────────────────────────────────
  if (layout === 'accordion') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:900px;margin:0 auto;">
    ${heading}
    <div style="display:flex;flex-direction:column;gap:0.6rem;">
      ${svcs.map(s => {
        const includes = Array.isArray(s.includes) ? (s.includes as string[]) : []
        return `<details class="ss-faq" style="border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <summary style="padding:1.5rem 2rem;background:#fff;user-select:none;cursor:pointer;">
            <div style="display:flex;flex-direction:column;gap:0.2rem;flex:1;">
              <span style="font-size:1.05rem;font-weight:700;color:#111;">${esc(String(s.title ?? ''))}</span>
              ${s.price ? `<span style="color:${esc(t.primaryColor)};font-weight:600;font-size:0.9rem;">${esc(String(s.price))}</span>` : ''}
            </div>
            <span class="ss-faq-icon" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${hexToRgba(t.primaryColor, 0.1)};font-size:1.1rem;color:${esc(t.primaryColor)};flex-shrink:0;margin-left:1rem;">+</span>
          </summary>
          <div style="padding:0 2rem 1.5rem;border-top:1px solid #f3f4f6;">
            <p style="color:#4b5563;line-height:1.8;margin-bottom:${includes.length ? '1.25rem' : '0'};">${esc(String(s.description ?? ''))}</p>
            ${includes.length ? `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
              ${includes.map(inc => `<span style="background:${tint};border:1px solid ${hexToRgba(t.primaryColor, 0.2)};border-radius:999px;padding:0.2rem 0.85rem;font-size:0.82rem;color:#374151;">${esc(inc)}</span>`).join('')}
            </div>` : ''}
          </div>
        </details>`
      }).join('')}
    </div>
  </div>
</section>`
  }

  // ── Layout: feature-strip ─────────────────────────────────────
  if (layout === 'feature-strip') {
    return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:1000px;margin:0 auto;">
    ${heading}
    <div style="display:flex;flex-direction:column;gap:1.25rem;">
      ${svcs.map(s => `<div class="ss-card" style="background:#fff;border-radius:12px;display:flex;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
        <div style="width:5px;flex-shrink:0;background:${esc(t.primaryColor)};"></div>
        <div style="padding:2rem 2.5rem;flex:1;display:flex;justify-content:space-between;align-items:flex-start;gap:2rem;">
          <div style="flex:1;">
            <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.6rem;">${esc(String(s.title ?? ''))}</h3>
            <p style="color:#4b5563;line-height:1.75;font-size:0.97rem;">${esc(String(s.description ?? ''))}</p>
          </div>
          ${s.price ? `<div style="flex-shrink:0;font-weight:800;color:${esc(t.primaryColor)};font-size:1.05rem;white-space:nowrap;padding-top:0.2rem;">${esc(String(s.price))}</div>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── Layout: card-grid (default) ───────────────────────────────
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

// ── Features ──────────────────────────────────────────────────────
export function renderFeatures(c: Record<string, unknown>, t: ThemeConfig): string {
  const features = Array.isArray(c.features) ? (c.features as Array<Record<string, unknown>>) : []
  const layout = String(c.layout ?? 'card-grid')
  const tint = hexToRgba(t.primaryColor, 0.05)
  const heading = `<div style="text-align:center;margin-bottom:3.5rem;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Features'))}</h2>
    ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;max-width:600px;margin-left:auto;margin-right:auto;">${esc(String(c.subheading))}</p>` : ''}
  </div>`

  // ── icon-left-rows: full-width rows with icon left ────────────
  if (layout === 'icon-left-rows') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:900px;margin:0 auto;">
    ${heading}
    <div style="display:flex;flex-direction:column;gap:0;">
      ${features.map((f, i) => `<div style="display:flex;gap:2rem;align-items:flex-start;padding:2.5rem 0;${i > 0 ? 'border-top:1px solid #e5e7eb;' : ''}">
        <div style="flex-shrink:0;width:52px;height:52px;border-radius:14px;background:${tint};border:2px solid ${hexToRgba(t.primaryColor, 0.25)};display:flex;align-items:center;justify-content:center;">
          <div style="width:20px;height:20px;border-radius:4px;background:${esc(t.primaryColor)};"></div>
        </div>
        <div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.6rem;">${esc(String(f.title ?? ''))}</h3>
          <p style="color:#4b5563;line-height:1.75;font-size:0.97rem;">${esc(String(f.description ?? ''))}</p>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── bold-list: numbered list, typographic treatment ───────────
  if (layout === 'bold-list') {
    return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:960px;margin:0 auto;">
    ${heading}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:2.5rem;">
      ${features.map((f, i) => `<div>
        <div style="display:flex;align-items:flex-start;gap:1rem;margin-bottom:0.65rem;">
          <div style="font-size:1.6rem;font-weight:900;color:${esc(t.primaryColor)};font-family:monospace;opacity:0.35;line-height:1;flex-shrink:0;">${String(i + 1).padStart(2, '0')}</div>
          <h3 style="font-size:1.15rem;font-weight:800;color:#111;line-height:1.2;">${esc(String(f.title ?? ''))}</h3>
        </div>
        <p style="color:#4b5563;line-height:1.75;font-size:0.97rem;padding-left:2.75rem;">${esc(String(f.description ?? ''))}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── card-grid (default) ───────────────────────────────────────
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

// ── Team ──────────────────────────────────────────────────────────
export function renderTeam(c: Record<string, unknown>, t: ThemeConfig): string {
  const members = Array.isArray(c.members) ? (c.members as Array<Record<string, unknown>>) : []
  const layout = String(c.layout ?? 'card-grid')
  const tint = hexToRgba(t.primaryColor, 0.05)

  function avatarCircle(m: Record<string, unknown>, size: number, fontSize: number): string {
    const name = String(m.name ?? '?')
    const photo = m.photo ? String(m.photo) : null
    return photo
      ? `<img src="${esc(photo)}" alt="${esc(name)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;border:3px solid ${esc(t.primaryColor)};" />`
      : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${fontSize}rem;font-weight:800;">${esc(name[0])}</div>`
  }

  // ── horizontal-bio: wide stacked cards ───────────────────────
  if (layout === 'horizontal-bio') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:900px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Our Team'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:1.5rem;">
      ${members.map(m => `<div class="ss-card" style="display:flex;gap:2rem;align-items:flex-start;padding:2.5rem;background:#fff;border-radius:14px;box-shadow:0 1px 8px rgba(0,0,0,0.07);border-left:4px solid ${esc(t.primaryColor)};">
        ${avatarCircle(m, 80, 1.6)}
        <div style="flex:1;">
          <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:0.2rem;">${esc(String(m.name ?? ''))}</h3>
          <p style="color:${esc(t.primaryColor)};font-weight:600;font-size:0.82rem;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.75rem;">${esc(String(m.role ?? ''))}</p>
          ${m.bio ? `<p style="color:#6b7280;font-size:0.95rem;line-height:1.7;">${esc(String(m.bio))}</p>` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── featured-lead: first member large, rest in grid ──────────
  if (layout === 'featured-lead' && members.length) {
    const [lead, ...rest] = members
    return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Our Team'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div style="background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});border-radius:20px;padding:3rem;display:grid;grid-template-columns:auto 1fr;gap:2.5rem;align-items:center;margin-bottom:2.5rem;color:#fff;">
      ${avatarCircle(lead, 120, 2.5)}
      <div>
        <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;opacity:0.65;margin-bottom:0.5rem;">Founder / Lead</div>
        <h3 style="font-size:1.75rem;font-weight:800;margin-bottom:0.4rem;line-height:1.1;">${esc(String(lead.name ?? ''))}</h3>
        <p style="font-size:1rem;font-weight:600;opacity:0.85;margin-bottom:${lead.bio ? '1rem' : '0'};">${esc(String(lead.role ?? ''))}</p>
        ${lead.bio ? `<p style="opacity:0.82;line-height:1.75;font-size:0.97rem;">${esc(String(lead.bio))}</p>` : ''}
      </div>
    </div>
    ${rest.length ? `<div class="ss-grid-3">
      ${rest.map(m => `<div class="ss-card" style="text-align:center;padding:2.25rem 1.5rem;background:#fff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
        ${avatarCircle(m, 72, 1.5)}
        <div style="margin-top:1.25rem;">
          <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.2rem;">${esc(String(m.name ?? ''))}</h3>
          <p style="color:${esc(t.primaryColor)};font-weight:600;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.6rem;">${esc(String(m.role ?? ''))}</p>
          ${m.bio ? `<p style="color:#6b7280;font-size:0.85rem;line-height:1.6;">${esc(String(m.bio))}</p>` : ''}
        </div>
      </div>`).join('')}
    </div>` : ''}
  </div>
</section>`
  }

  // ── minimal-list: name + role only, no cards ─────────────────
  if (layout === 'minimal-list') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:900px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Our Team'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:1rem;">
      ${members.map(m => `<div style="padding:1.5rem;border:1.5px solid #e5e7eb;border-radius:10px;transition:border-color 0.2s,box-shadow 0.2s;" onmouseover="this.style.borderColor='${t.primaryColor}';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)';" onmouseout="this.style.borderColor='#e5e7eb';this.style.boxShadow='none';">
        <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:0.25rem;color:#111;">${esc(String(m.name ?? ''))}</h3>
        <p style="color:${esc(t.primaryColor)};font-size:0.85rem;font-weight:600;">${esc(String(m.role ?? ''))}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── card-grid (default) ───────────────────────────────────────
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

// ── Testimonials ──────────────────────────────────────────────────
export function renderTestimonials(c: Record<string, unknown>, t: ThemeConfig): string {
  const tms = Array.isArray(c.testimonials) ? (c.testimonials as Array<Record<string, unknown>>) : []
  const layout = String(c.layout ?? 'card-grid')
  const tint = hexToRgba(t.primaryColor, 0.04)

  function authorAvatar(tm: Record<string, unknown>): string {
    const name = String(tm.author ?? '?')
    const photo = tm.photo ? String(tm.photo) : null
    return photo
      ? `<img src="${esc(photo)}" alt="${esc(name)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;" />`
      : `<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9rem;">${esc(name[0])}</div>`
  }

  function stars(tm: Record<string, unknown>): string {
    return tm.rating ? `<div style="color:#f59e0b;margin-bottom:0.75rem;font-size:1.05rem;">${'★'.repeat(Number(tm.rating))}</div>` : ''
  }

  function authorLine(tm: Record<string, unknown>): string {
    const name = String(tm.author ?? '?')
    const meta = [tm.role, tm.company].filter(Boolean).map(x => esc(String(x))).join(' · ')
    return `<div style="display:flex;align-items:center;gap:0.75rem;">
      ${authorAvatar(tm)}
      <div>
        <div style="font-weight:700;font-size:0.95rem;">${esc(name)}</div>
        ${meta ? `<div style="font-size:0.8rem;color:#9ca3af;">${meta}</div>` : ''}
      </div>
    </div>`
  }

  // ── featured-quote: one large + grid below ────────────────────
  if (layout === 'featured-quote' && tms.length) {
    const [featured, ...rest] = tms
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'What Our Clients Say'))}</h2>
    </div>
    <div style="text-align:center;padding:3.5rem;background:${tint};border-radius:20px;position:relative;margin-bottom:3rem;">
      <div style="font-size:7rem;line-height:0.8;color:${esc(t.primaryColor)};opacity:0.1;position:absolute;top:1.5rem;left:2rem;font-family:Georgia,serif;pointer-events:none;">&ldquo;</div>
      <div style="position:relative;max-width:800px;margin:0 auto;">
        ${stars(featured)}
        <p style="font-size:1.35rem;color:#374151;line-height:1.7;font-style:italic;margin-bottom:2rem;">"${esc(String(featured.quote ?? ''))}"</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:0.75rem;">
          ${authorAvatar(featured)}
          <div style="text-align:left;">
            <div style="font-weight:700;">${esc(String(featured.author ?? ''))}</div>
            ${(featured.role || featured.company) ? `<div style="font-size:0.85rem;color:#9ca3af;">${[featured.role, featured.company].filter(Boolean).map(x => esc(String(x))).join(' · ')}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
    ${rest.length ? `<div class="ss-grid-3">
      ${rest.map(tm => `<div class="ss-card" style="background:#fff;border-radius:12px;padding:2rem;box-shadow:0 1px 6px rgba(0,0,0,0.07);border-top:3px solid ${esc(t.primaryColor)};">
        ${stars(tm)}
        <p style="color:#374151;line-height:1.75;margin-bottom:1.25rem;font-size:0.95rem;">"${esc(String(tm.quote ?? ''))}"</p>
        ${authorLine(tm)}
      </div>`).join('')}
    </div>` : ''}
  </div>
</section>`
  }

  // ── dark-band: accent-tinted background, white cards ─────────
  if (layout === 'dark-band') {
    return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'What Our Clients Say'))}</h2>
    </div>
    <div class="ss-grid-3">
      ${tms.map(tm => `<div class="ss-card" style="padding:2.5rem;border-radius:12px;background:#fff;border-top:3px solid ${esc(t.primaryColor)};box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        ${stars(tm)}
        <p style="color:#374151;line-height:1.8;margin-bottom:1.5rem;font-size:0.97rem;font-style:italic;">"${esc(String(tm.quote ?? ''))}"</p>
        ${authorLine(tm)}
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── stacked: full-width stacked, alternating background ───────
  if (layout === 'stacked') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:860px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'What Our Clients Say'))}</h2>
    </div>
    <div style="display:flex;flex-direction:column;gap:1.75rem;">
      ${tms.map((tm, i) => `<div style="padding:2.5rem;border-radius:16px;background:${i % 2 === 0 ? tint : '#fff'};${i % 2 !== 0 ? 'border:1.5px solid #e5e7eb;' : ''}">
        ${stars(tm)}
        <p style="color:#374151;line-height:1.8;font-size:1.05rem;margin-bottom:1.5rem;">"${esc(String(tm.quote ?? ''))}"</p>
        ${authorLine(tm)}
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── card-grid (default) ───────────────────────────────────────
  return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:1100px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:3.5rem;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'What Our Clients Say'))}</h2>
    </div>
    <div class="ss-grid-3">
      ${tms.map(tm => {
        const authorName = String(tm.author ?? '?')
        const photo = tm.photo ? String(tm.photo) : null
        const av = photo
          ? `<img src="${esc(photo)}" alt="${esc(authorName)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0;" />`
          : `<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,${esc(t.primaryColor)},${esc(t.secondaryColor ?? t.primaryColor)});flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:0.9rem;">${esc(authorName[0])}</div>`
        return `<div class="ss-card" style="background:#fff;border-radius:12px;padding:2.25rem;box-shadow:0 1px 6px rgba(0,0,0,0.07);border-left:4px solid ${esc(t.primaryColor)};position:relative;">
        <div style="font-size:5rem;line-height:1;color:${esc(t.primaryColor)};opacity:0.1;position:absolute;top:0.75rem;left:1.25rem;font-family:Georgia,serif;pointer-events:none;">&ldquo;</div>
        <div style="position:relative;">
          ${tm.rating ? `<div style="color:#f59e0b;margin-bottom:0.75rem;font-size:1.1rem;">${'★'.repeat(Number(tm.rating))}</div>` : ''}
          <p style="color:#374151;line-height:1.8;margin-bottom:1.5rem;font-size:0.97rem;">"${esc(String(tm.quote ?? ''))}"</p>
          <div style="display:flex;align-items:center;gap:0.75rem;">
            ${av}
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

// ── Process ───────────────────────────────────────────────────────
export function renderProcess(c: Record<string, unknown>, t: ThemeConfig): string {
  const steps = Array.isArray(c.steps) ? (c.steps as Array<Record<string, unknown>>) : []
  const layout = String(c.layout ?? 'numbered-rows')
  const tint = hexToRgba(t.primaryColor, 0.05)

  const headingBlock = `<div style="text-align:center;margin-bottom:3.5rem;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'How It Works'))}</h2>
    ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
  </div>`

  // ── cards-horizontal: horizontal flow with arrows ─────────────
  if (layout === 'cards-horizontal') {
    return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:1200px;margin:0 auto;">
    ${headingBlock}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:0;align-items:start;">
      ${steps.map((step, i) => `<div style="padding:1.75rem 1.25rem;text-align:center;position:relative;">
        ${i < steps.length - 1 ? `<div style="display:none;position:absolute;right:-10px;top:calc(3.25rem + 1.75rem);z-index:1;font-size:1.4rem;color:${esc(t.primaryColor)};opacity:0.35;">→</div>` : ''}
        <div style="width:56px;height:56px;border-radius:50%;background:${esc(t.primaryColor)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;margin:0 auto 1.25rem;box-shadow:0 4px 16px ${hexToRgba(t.primaryColor, 0.3)};">${i + 1}</div>
        <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.5rem;color:#111;">${esc(String(step.title ?? ''))}</h3>
        <p style="color:#4b5563;font-size:0.88rem;line-height:1.7;">${esc(String(step.description ?? ''))}</p>
      </div>${i < steps.length - 1 ? `<div style="display:flex;align-items:center;justify-content:center;padding-top:calc(3.25rem + 1.75rem);color:${esc(t.primaryColor)};opacity:0.3;font-size:1.5rem;">→</div>` : ''}`).join('')}
    </div>
  </div>
</section>`
  }

  // ── diagonal-steps: alternating full-width bands ──────────────
  if (layout === 'diagonal-steps') {
    return `<section style="padding:0;background:#fff;overflow:hidden;">
  <div style="padding:5rem 1.5rem 3rem;text-align:center;background:#fff;">
    <div style="max-width:860px;margin:0 auto;">
      <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'How It Works'))}</h2>
      ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
    </div>
  </div>
  ${steps.map((step, i) => `<div style="padding:4rem 1.5rem;background:${i % 2 === 0 ? '#fff' : tint};">
    <div style="max-width:900px;margin:0 auto;display:flex;gap:3rem;align-items:center;${i % 2 !== 0 ? 'flex-direction:row-reverse;' : ''}">
      <div style="flex-shrink:0;width:80px;height:80px;border-radius:50%;background:${esc(t.primaryColor)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.5rem;box-shadow:0 6px 24px ${hexToRgba(t.primaryColor, 0.35)};">${i + 1}</div>
      <div>
        <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:0.6rem;color:#111;">${esc(String(step.title ?? ''))}</h3>
        <p style="color:#4b5563;line-height:1.8;font-size:1.05rem;">${esc(String(step.description ?? ''))}</p>
      </div>
    </div>
  </div>`).join('')}
</section>`
  }

  // ── numbered-rows (default) ───────────────────────────────────
  return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:860px;margin:0 auto;">
    ${headingBlock}
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

// ── FAQ ───────────────────────────────────────────────────────────
export function renderFAQ(c: Record<string, unknown>, t?: ThemeConfig): string {
  const faqs = Array.isArray(c.faqs) ? (c.faqs as Array<Record<string, unknown>>) : []
  const layout = String(c.layout ?? 'accordion')
  const primaryColor = t?.primaryColor ?? '#6366f1'
  const tint = hexToRgba(primaryColor, 0.05)

  const headingBlock = `<div style="text-align:center;margin-bottom:3.5rem;">
    <h2 class="ss-section-heading" style="font-size:2.25rem;font-weight:800;">${esc(String(c.heading ?? 'Frequently Asked Questions'))}</h2>
    ${c.subheading ? `<p style="color:#6b7280;font-size:1.1rem;margin-top:1.25rem;">${esc(String(c.subheading))}</p>` : ''}
  </div>`

  // ── two-column: open Q&A grid ─────────────────────────────────
  if (layout === 'two-column') {
    return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:1100px;margin:0 auto;">
    ${headingBlock}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:1.75rem;">
      ${faqs.map(f => `<div style="padding:2rem;border:1.5px solid #e5e7eb;border-radius:12px;background:#fff;">
        <h3 style="font-size:1rem;font-weight:700;color:#111;margin-bottom:0.75rem;line-height:1.4;">${esc(String(f.question ?? ''))}</h3>
        <p style="color:#4b5563;line-height:1.75;font-size:0.95rem;">${esc(String(f.answer ?? ''))}</p>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── numbered: numbered circles, open answers ──────────────────
  if (layout === 'numbered') {
    return `<section style="padding:6rem 1.5rem;background:${tint};">
  <div style="max-width:860px;margin:0 auto;">
    ${headingBlock}
    <div style="display:flex;flex-direction:column;gap:2.5rem;">
      ${faqs.map((f, i) => `<div style="display:flex;gap:2rem;align-items:flex-start;">
        <div style="flex-shrink:0;width:48px;height:48px;border-radius:50%;background:${esc(primaryColor)};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.05rem;">${i + 1}</div>
        <div style="padding-top:0.5rem;">
          <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:0.6rem;color:#111;">${esc(String(f.question ?? ''))}</h3>
          <p style="color:#4b5563;line-height:1.75;font-size:0.97rem;">${esc(String(f.answer ?? ''))}</p>
        </div>
      </div>`).join('')}
    </div>
  </div>
</section>`
  }

  // ── accordion (default) ───────────────────────────────────────
  return `<section style="padding:6rem 1.5rem;background:#fff;">
  <div style="max-width:800px;margin:0 auto;">
    ${headingBlock}
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

// ── Pricing ───────────────────────────────────────────────────────
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

// ── Gallery ───────────────────────────────────────────────────────
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
