// ============================================================
// SiteSync v2 — /api/generate
// Generates a site section-by-section, streaming progress
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { planSite, generateSection } from '@/services/sectionGeneratorService'
import { renderPage } from '@/lib/renderer'
import { scrapeSite } from '@/lib/siteScraper'
import type { SectionRow, PageRow } from '@/types/site'

export const maxDuration = 300

export async function POST(request: Request) {
  // ── 1. Parse & validate ───────────────────────────────────
  let body: {
    siteName?: string
    subdomain?: string
    prompt?: string
    userId?: string
    userEmail?: string
    existingUrl?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { siteName, subdomain, prompt, userId, userEmail, existingUrl } = body
  if (!siteName || !subdomain || !prompt || !userId || !userEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
    return NextResponse.json(
      { error: 'Subdomain must be 3–30 lowercase letters, numbers, or hyphens' },
      { status: 400 }
    )
  }

  // ── 2. Check subdomain availability ──────────────────────
  const { data: existing } = await supabaseAdmin
    .from('sites')
    .select('id')
    .eq('subdomain', subdomain)
    .single()
  if (existing) {
    return NextResponse.json(
      { error: 'That subdomain is already taken. Please choose another.' },
      { status: 409 }
    )
  }

  const updateEmail = `update+${subdomain}@mg.sceneengineering.com`
  const basePath = `/sites/${subdomain}`
  const encoder = new TextEncoder()

  // ── 3. Open SSE stream ────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      let siteId: string | null = null
      try {
        // ── 4. Scrape existing site if URL provided ───────────
        let existingContent = ''
        if (existingUrl?.trim()) {
          send({ type: 'status', message: `Reading existing site at ${new URL(existingUrl.trim().startsWith('http') ? existingUrl.trim() : `https://${existingUrl.trim()}`).hostname}…` })
          const scrapeResult = await scrapeSite(existingUrl)
          if (scrapeResult.success) {
            existingContent = scrapeResult.content
            send({ type: 'status', message: `Read ${scrapeResult.pagesRead} pages — using real content…` })
          } else {
            send({ type: 'status', message: 'Could not read existing site — generating from description instead…' })
          }
        }

        // ── 5. Plan the site (fast Haiku call) ───────────────
        send({ type: 'status', message: 'Planning your site…' })
        const plan = await planSite(siteName!, prompt!, existingContent)
        const { theme } = plan
        const homePage = plan.pages.find(p => p.isHomepage) ?? plan.pages[0]

        send({ type: 'status', message: 'Creating site record…' })

        // ── 6. Create site record (status: building) ─────────
        const { data: siteRow, error: siteErr } = await supabaseAdmin
          .from('sites')
          .insert({
            owner_id: userId,
            name: siteName,
            subdomain,
            theme,
            authorized_senders: [userEmail!.toLowerCase().trim()],
            update_email: updateEmail,
            form_recipient_email: userEmail,
            status: 'building',
          })
          .select()
          .single()
        if (siteErr || !siteRow) {
          console.error('Site insert error:', siteErr)
          send({ type: 'error', message: 'Failed to create site record.' })
          controller.close()
          return
        }
        siteId = siteRow.id

        // ── 7. Create all pages ───────────────────────────────
        const pageInserts = plan.pages.map((p, i) => ({
          site_id: siteId!,
          slug: p.slug,
          title: p.title,
          nav_label: p.navLabel,
          nav_order: i,
          is_homepage: p.isHomepage,
          published: true,
        }))
        const { data: pageRows, error: pageErr } = await supabaseAdmin
          .from('pages')
          .insert(pageInserts)
          .select()
        if (pageErr || !pageRows?.length) {
          console.error('Pages insert error:', pageErr)
          send({ type: 'error', message: 'Failed to create pages.' })
          controller.close()
          return
        }

        // ── 8. Generate sections for home page ───────────────
        const homePageRow = pageRows.find((p: PageRow) => p.is_homepage) as PageRow
        const totalSections = homePage.sections.length
        const builtSections: SectionRow[] = []

        for (let i = 0; i < homePage.sections.length; i++) {
          const sectionPlan = homePage.sections[i]
          send({
            type: 'progress',
            message: `Building ${sectionPlan.label}…`,
            current: i + 1,
            total: totalSections,
          })
          const { content, sectionCss, sectionJs } = await generateSection(
            sectionPlan.type,
            sectionPlan.label,
            siteName!,
            prompt!,
            theme,
            '',
            existingContent
          )
          const { data: sectionRow, error: secErr } = await supabaseAdmin
            .from('sections')
            .insert({
              page_id: homePageRow.id,
              site_id: siteId!,
              type: sectionPlan.type,
              order_index: i,
              label: sectionPlan.label,
              content,
              section_css: sectionCss,
              section_js: sectionJs,
              published: true,
            })
            .select()
            .single()
          if (secErr || !sectionRow) {
            console.error(`Section insert error (${sectionPlan.type}):`, secErr)
            continue // non-fatal, keep building
          }
          builtSections.push(sectionRow as SectionRow)
        }

        // ── 9. Render full HTML from sections ─────────────────
        send({ type: 'status', message: 'Rendering site…' })
        const html = renderPage({
          page: homePageRow,
          sections: builtSections,
          theme,
          siteName: siteName!,
          allPages: pageRows as PageRow[],
          updateEmail,
          basePath,
        })

        // ── 10. Cache rendered HTML for fast serving ──────────
        const { error: cacheErr } = await supabaseAdmin
          .from('site_html_cache')
          .upsert({
            site_id: siteId!,
            subdomain,
            html_content: html,
            updated_at: new Date().toISOString(),
          })
        if (cacheErr) {
          console.error('HTML cache write error:', cacheErr)
        }

        // ── 11. Save initial version snapshot ────────────────
        await supabaseAdmin.from('versions').insert({
          site_id: siteId!,
          page_id: homePageRow.id,
          sections_snapshot: builtSections as unknown as object,
          trigger: 'initial_generation',
          triggered_by: userEmail,
          update_instructions: prompt,
        })

        // ── 12. Activate site ────────────────────────────────
        await supabaseAdmin
          .from('sites')
          .update({ status: 'active' })
          .eq('id', siteId!)

        send({ type: 'done', subdomain, siteId: siteId! })
      } catch (err) {
        console.error('Generate error:', err)
        // Clean up partial site
        if (siteId) {
          await supabaseAdmin.from('sites').delete().eq('id', siteId)
        }
        send({ type: 'error', message: 'Site generation failed. Please try again.' })
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
