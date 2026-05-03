// SiteSync v2 - Email Update Service (section-aware)

import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendMailgunEmail } from '@/lib/mailgunWebhook'
import { renderPage } from '@/lib/renderer'
import type { SectionRow, PageRow, Theme } from '@/types/site'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type UpdateResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

async function isAuthorizedSender(siteId: string, sender: string, ownerId: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(ownerId)
  if (user.user?.email?.toLowerCase() === sender) return true

  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('authorized_senders')
    .eq('id', siteId)
    .single()
  if (site?.authorized_senders?.includes(sender)) return true

  const { data: editor } = await supabaseAdmin
    .from('authorized_editors')
    .select('id')
    .eq('site_id', siteId)
    .eq('email', sender)
    .single()
  return !!editor
}

async function identifyAffectedSections(
  instructions: string,
  sections: Array<{ type: string; label: string; id: string }>
): Promise<string[]> {
  const list = sections.map((s, i) => `${i + 1}. ${s.label} (type: ${s.type}, id: ${s.id})`).join('\n')
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Update instructions: "${instructions}"\n\nSections:\n${list}\n\nReturn a JSON array of section IDs to update. Return ONLY the JSON array.`
    }]
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return sections.map(s => s.id)
  try {
    const ids = JSON.parse(match[0]) as string[]
    return ids.filter(id => sections.some(s => s.id === id))
  } catch {
    return sections.map(s => s.id)
  }
}

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
      content: `Update this "${section.type}" section for "${siteName}".\n\nCurrent content:\n${JSON.stringify(section.content, null, 2)}\n\nInstructions: ${instructions}\n\nReturn updated JSON only — same structure, no markdown.`
    }]
  })
  const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return section.content as Record<string, unknown>
  try { return JSON.parse(match[0]) } catch { return section.content as Record<string, unknown> }
}

export async function processSiteUpdate(
  subdomain: string,
  sender: string,
  subject: string,
  instructions: string
): Promise<UpdateResult> {
  // Try v2 sites table first
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, owner_id, name, theme')
    .eq('subdomain', subdomain)
    .single()

  if (!site) {
    // Try legacy websites table
    const { data: legacy } = await supabaseAdmin
      .from('websites')
      .select('id, owner_id, name, html_content')
      .eq('subdomain', subdomain)
      .single()
    if (!legacy) return { ok: false, status: 404, error: 'Site not found' }
    return processLegacyUpdate(legacy, sender, subject, instructions, subdomain)
  }

  const authorized = await isAuthorizedSender(site.id, sender, site.owner_id)
  if (!authorized) {
    await sendMailgunEmail({
      to: sender,
      subject: `Re: ${subject}`,
      text: `Your update email for "${site.name}" was rejected — your email is not on the authorized senders list.\n\nSiteSync`,
    })
    return { ok: false, status: 403, error: 'Unauthorized sender' }
  }

  const { data: homePage } = await supabaseAdmin
    .from('pages')
    .select('*')
    .eq('site_id', site.id)
    .eq('is_homepage', true)
    .single()
  if (!homePage) return { ok: false, status: 500, error: 'Home page not found' }

  const { data: sections } = await supabaseAdmin
    .from('sections')
    .select('*')
    .eq('page_id', homePage.id)
    .eq('published', true)
    .order('order_index')
  if (!sections?.length) return { ok: false, status: 500, error: 'No sections found' }

  // Snapshot before update
  await supabaseAdmin.from('versions').insert({
    site_id: site.id,
    page_id: homePage.id,
    sections_snapshot: sections as unknown as object,
    trigger: 'email_update',
    triggered_by: sender,
    update_instructions: instructions,
  })

  const affectedIds = await identifyAffectedSections(instructions, sections)
  const theme = site.theme as Theme
  let updatedSections = [...sections] as SectionRow[]

  for (const sectionId of affectedIds) {
    const section = sections.find((s: SectionRow) => s.id === sectionId)
    if (!section) continue
    try {
      const content = await updateSectionContent(section as SectionRow, instructions, site.name)
      await supabaseAdmin.from('sections').update({ content }).eq('id', sectionId)
      updatedSections = updatedSections.map((s: SectionRow) => s.id === sectionId ? { ...s, content } : s)
    } catch (err) {
      console.error(`Failed to update section ${sectionId}:`, err)
    }
  }

  const { data: allPages } = await supabaseAdmin
    .from('pages').select('*').eq('site_id', site.id).eq('published', true).order('nav_order')

  const html = renderPage({
    page: homePage as PageRow,
    sections: updatedSections,
    theme,
    siteName: site.name,
    allPages: (allPages ?? []) as PageRow[],
    updateEmail: `update+${subdomain}@mg.sceneengineering.com`,
  })

  await supabaseAdmin.from('site_html_cache').upsert({
    site_id: site.id,
    subdomain,
    html_content: html,
    updated_at: new Date().toISOString(),
  })

  await sendMailgunEmail({
    to: sender,
    subject: `Re: ${subject}`,
    text: `Your site "${site.name}" has been updated!\n\nView: https://${subdomain}.sitesync.app\n\nSiteSync`,
  })

  return { ok: true }
}

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
    messages: [{ role: 'user', content: `Current HTML:\n\n${site.html_content}\n\n---\n\n${instructions}` }]
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
