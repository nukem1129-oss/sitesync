// SiteSync v2 — Email Update Service
// Handles inbound email → AI → section update → cache clear
// ============================================================
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendMailgunEmail } from '@/lib/mailgunWebhook'
import type { SectionRow, PageRow, Theme } from '@/types/site'

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
      content: `Update this "${section.type}" section for the website "${siteName}".\n\nCurrent content:\n${JSON.stringify(section.content, null, 2)}\n\nUpdate instructions: ${instructions}\n\nReturn ONLY the updated JSON object — same structure, no markdown, no explanation.`
    }],
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return section.content as Record<string, unknown>
  try { return JSON.parse(match[0]) } catch { return section.content as Record<string, unknown> }
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
    .select('id, owner_id, name, theme')
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

  // ── 3. Load pages + pick target page ─────────────────────
  const { data: allPages } = await supabaseAdmin
    .from('pages').select('id, nav_label, slug, is_homepage, nav_order, published').eq('site_id', site.id).eq('published', true).order('nav_order')
  if (!allPages?.length) return { ok: false, status: 500, error: 'No pages found' }

  const targetPageId = await identifyTargetPage(instructions, allPages)
  const targetPage = allPages.find(p => p.id === targetPageId) ?? allPages[0]

  // ── 4. Load sections for target page ─────────────────────
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
    text: `Your site "${site.name}" has been updated!\n\nPage updated: ${pageName}\nView: ${siteUrl}\n\nSiteSync`,
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
