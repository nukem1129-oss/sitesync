// SiteSync v2 — Email Update Service
// Handles inbound email → AI → section update → cache clear
// ============================================================
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendMailgunEmail } from '@/lib/mailgunWebhook'
import { renderPage } from '@/lib/renderer'
import type { SectionRow, PageRow, Theme, ThemeConfig } from '@/types/site'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type UpdateResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

// ── Authorization ─────────────────────────────────────────────
async function isAuthorizedSender(siteId: string, sender: string, ownerId: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(ownerId)
  if (user.user?.email?.toLowerCase() === sender) return true

  const { data: site } = await supabaseAdmin
    .from('sites').select('authorized_senders').eq('id', siteId).single()
  if (site?.authorized_senders?.includes(sender)) return true

  const { data: editor } = await supabaseAdmin
    .from('authorized_editors').select('id').eq('site_id', siteId).eq('email', sender).single()
  return !!editor
}

// ── Page targeting — which page does the update refer to? ─────
async function identifyTargetPage(
  instructions: string,
  pages: Array<{ id: string; nav_label: string | null; slug: string; is_homepage: boolean }>
): Promise<string> {
  // If only one page, pick it
  if (pages.length === 1) return pages[0].id
  // If instruction clearly mentions a page name, ask AI to pick
  const list = pages.map(p => `- "${p.nav_label ?? p.slug}" (id: ${p.id})`).join('\n')
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{ role: 'user', content: `Instructions: "${instructions}"\n\nPages:\n${list}\n\nWhich page does this update apply to? Reply with ONLY the page id.` }],
  })
  const text = (msg.content[0].type === 'text' ? msg.content[0].text : '').trim()
  const match = pages.find(p => p.id === text)
  return match?.id ?? pages.find(p => p.is_homepage)?.id ?? pages[0].id
}

// ── Section targeting — which sections need changing? ─────────
async function identifyAffectedSections(
  instructions: string,
  sections: Array<{ type: string; label: string | null; id: string }>
): Promise<string[]> {
  if (sections.length <= 2) return sections.map(s => s.id)
  const list = sections.map((s, i) => `${i + 1}. ${s.label ?? s.type} (type: ${s.type}, id: ${s.id})`).join('\n')
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{ role: 'user', content: `Instructions: "${instructions}"\n\nSections:\n${list}\n\nReturn a JSON array of section IDs to update. Return ONLY the JSON array, no other text.` }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return sections.map(s => s.id)
  try {
    const ids = JSON.parse(match[0]) as string[]
    return ids.filter(id => sections.some(s => s.id === id))
  } catch {
    return sections.map(s => s.id)
  }
}

// ── Section content update via AI ─────────────────────────────
async function updateSectionContent(
  section: SectionRow,
  instructions: string,
  siteName: string
): Promise<Record<string, unknown>> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Update this "${section.type}" section for the website "${siteName}".\n\nCurrent content:\n${JSON.stringify(section.content, null, 2)}\n\nUpdate instructions: ${instructions}\n\nRules:\n- Return ONLY the updated JSON object — same structure, no markdown, no explanation.\n- Never use em dashes (—) or en dashes (–). Use commas or rewrite the sentence instead.\n- Do not use emojis anywhere in the content.`
    }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return section.content as Record<string, unknown>
  try { return JSON.parse(match[0]) } catch { return section.content as Record<string, unknown> }
}

// ── Theme change detection ────────────────────────────────────
async function isThemeChangeRequest(instructions: string): Promise<boolean> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8,
    messages: [{
      role: 'user',
      content: `Does this instruction ask to change the website's color theme, color scheme, primary colors, brand colors, or fonts? Answer only YES or NO.\n\nInstruction: "${instructions}"`,
    }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim().toUpperCase() : 'NO'
  return text.startsWith('YES')
}

// ── Resolve new theme from natural language ───────────────────
async function resolveNewTheme(currentTheme: Theme, instructions: string, siteName: string): Promise<Theme> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `The website "${siteName}" wants to update its color theme.

Current theme:
${JSON.stringify(currentTheme, null, 2)}

Update instruction: "${instructions}"

Return ONLY a JSON object with the updated theme. Rules:
- Convert color names to accurate hex codes (e.g. "navy blue" → "#1e3a5f", "forest green" → "#228b22", "teal" → "#0d9488")
- primaryColor and secondaryColor should be harmonious — secondaryColor is typically a darker or more saturated variant of primary
- Keep ALL existing fields; only update what the instruction specifically mentions
- Return valid 6-digit hex codes only (e.g. "#2563eb")
- No markdown, no explanation — return the JSON object only`,
    }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return currentTheme
  try {
    const updated = JSON.parse(match[0]) as Partial<Theme>
    return { ...currentTheme, ...updated }
  } catch {
    return currentTheme
  }
}

// ── Re-render every page with the new theme ───────────────────
async function reRenderAllPages(
  siteId: string,
  subdomain: string,
  siteName: string,
  newTheme: Theme,
  updateEmail: string | null,
): Promise<void> {
  const { data: pages } = await supabaseAdmin
    .from('pages')
    .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
    .eq('site_id', siteId)
    .eq('published', true)
    .order('nav_order')

  if (!pages?.length) return
  const basePath = `/sites/${subdomain}`

  for (const page of pages) {
    const { data: sections } = await supabaseAdmin
      .from('sections')
      .select('*')
      .eq('page_id', page.id)
      .eq('published', true)
      .order('order_index')

    if (!sections?.length) continue

    const html = renderPage({
      page: page as PageRow,
      sections: sections as SectionRow[],
      theme: newTheme as ThemeConfig,
      siteName,
      allPages: pages as PageRow[],
      updateEmail,
      basePath,
    })

    const cacheKey = page.is_homepage ? subdomain : `${subdomain}/${page.slug}`
    await supabaseAdmin.from('site_html_cache').upsert(
      { site_id: siteId, subdomain: cacheKey, html_content: html, updated_at: new Date().toISOString() },
      { onConflict: 'subdomain' },
    )
  }
}

// ── Main entry point ──────────────────────────────────────────
export async function processSiteUpdate(
  subdomain: string,
  sender: string,
  subject: string,
  instructions: string
): Promise<UpdateResult> {
  // ── 1. Find site ──────────────────────────────────────────
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, owner_id, name, theme, update_email')
    .eq('subdomain', subdomain)
    .single()

  if (!site) {
    // Fall back to legacy websites table
    const { data: legacy } = await supabaseAdmin
      .from('websites').select('id, owner_id, name, html_content').eq('subdomain', subdomain).single()
    if (!legacy) return { ok: false, status: 404, error: 'Site not found' }
    return processLegacyUpdate(legacy, sender, subject, instructions, subdomain)
  }

  // ── 2. Authorize ──────────────────────────────────────────
  const authorized = await isAuthorizedSender(site.id, sender, site.owner_id)

  if (!authorized) {
    await sendMailgunEmail({
      to: sender,
      subject: `Re: ${subject}`,
      text: `Your update email for "${site.name}" was rejected — your email is not on the authorized senders list.\n\nSiteSync`,
    })
    return { ok: false, status: 403, error: 'Unauthorized sender' }
  }

  // ── 3. Check for theme/color change request ──────────────
  const themeChange = await isThemeChangeRequest(instructions)
  if (themeChange) {
    const newTheme = await resolveNewTheme(site.theme as Theme, instructions, site.name)
    await supabaseAdmin.from('sites').update({ theme: newTheme }).eq('id', site.id)
    await reRenderAllPages(site.id, subdomain, site.name, newTheme, site.update_email ?? null)
    const siteUrl = `https://sitesync-psi.vercel.app/sites/${subdomain}`
    await sendMailgunEmail({
      to: sender,
      subject: `Re: ${subject}`,
      text: `Your site "${site.name}" has been updated!\n\nTheme colors updated across all pages.\nView your site: ${siteUrl}\n\nTIP: You can also update content by emailing instructions like:\n  "Update the About page — change our team to include Dr. Martinez"\n  "On the Services page, add a new service: Senior Pet Wellness"\n\nPowered by SiteSync`,
    })
    return { ok: true }
  }

  // ── 4. Load pages + pick target page ─────────────────────
  const { data: allPages } = await supabaseAdmin
    .from('pages').select('id, nav_label, slug, is_homepage, nav_order, published').eq('site_id', site.id).eq('published', true).order('nav_order')
  if (!allPages?.length) return { ok: false, status: 500, error: 'No pages found' }

  const targetPageId = await identifyTargetPage(instructions, allPages)
  const targetPage = allPages.find(p => p.id === targetPageId) ?? allPages[0]

  // ── 5. Load sections for target page ─────────────────────
  const { data: sections } = await supabaseAdmin
    .from('sections').select('*').eq('page_id', targetPage.id).eq('published', true).order('order_index')
  if (!sections?.length) return { ok: false, status: 500, error: 'No sections found on target page' }

  // ── 5. Snapshot for rollback ──────────────────────────────
  await supabaseAdmin.from('versions').insert({
    site_id: site.id,
    page_id: targetPage.id,
    sections_snapshot: sections as unknown as object,
    trigger: 'email_update',
    triggered_by: sender,
    update_instructions: instructions,
  })

  // ── 6. Identify + update affected sections ────────────────
  const affectedIds = await identifyAffectedSections(instructions, sections)
  for (const sectionId of affectedIds) {
    const section = sections.find((s: SectionRow) => s.id === sectionId)
    if (!section) continue
    try {
      const content = await updateSectionContent(section as SectionRow, instructions, site.name)
      await supabaseAdmin.from('sections').update({ content }).eq('id', sectionId)
    } catch (err) {
      console.error(`Failed to update section ${sectionId}:`, err)
    }
  }

  // ── 7. Clear full site cache so all pages re-render ───────
  await supabaseAdmin.from('site_html_cache').delete().eq('site_id', site.id)

  // ── 8. Confirm to sender ──────────────────────────────────
  const siteUrl = `https://sitesync-psi.vercel.app/sites/${subdomain}`
  const pageName = targetPage.nav_label ?? targetPage.slug
  await sendMailgunEmail({
    to: sender,
    subject: `Re: ${subject}`,
    text: `Your site "${site.name}" has been updated!

Page updated: ${pageName}
View your site: ${siteUrl}

---
TIP: To update a specific page, just mention it in your email.
  "On the Services page, please add..."
  "Update the Team page — remove Dr. Smith"
  "Change the hours in the Contact section"
If you don't mention a page, updates go to the homepage by default.

Powered by SiteSync`,
  })

  return { ok: true }
}

// ── Legacy HTML update (websites table) ──────────────────────
async function processLegacyUpdate(
  site: { id: string; owner_id: string; name: string; html_content: string },
  sender: string,
  subject: string,
  instructions: string,
  subdomain: string
): Promise<UpdateResult> {
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(site.owner_id)
  const ownerEmail = user.user?.email?.toLowerCase()

  if (sender !== ownerEmail) {
    const { data: editor } = await supabaseAdmin
      .from('authorized_editors').select('id').eq('site_id', site.id).eq('email', sender).single()
    if (!editor) {
      await sendMailgunEmail({
        to: sender, subject: `Re: ${subject}`,
        text: `Update for "${site.name}" rejected — not on authorized list.\n\nSiteSync`,
      })
      return { ok: false, status: 403, error: 'Unauthorized sender' }
    }
  }

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    system: 'Update the HTML as instructed. Output ONLY the complete updated HTML — no markdown.',
    messages: [{ role: 'user', content: `Current HTML:\n\n${site.html_content}\n\n---\n\n${instructions}` }],
  })
  const updatedHtml = msg.content[0].type === 'text' ? msg.content[0].text : ''
  if (!updatedHtml.includes('<html') && !updatedHtml.includes('<!DOCTYPE'))
    return { ok: false, status: 500, error: 'AI generation failed' }

  await supabaseAdmin.from('websites').update({ html_content: updatedHtml }).eq('id', site.id)
  await sendMailgunEmail({
    to: sender, subject: `Re: ${subject}`,
    text: `"${site.name}" updated!\n\nView: https://sitesync-psi.vercel.app/sites/${subdomain}\n\nSiteSync`,
  })
  return { ok: true }
}
