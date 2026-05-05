// ============================================================
// SiteSync v2 — /api/generate-page
// Adds a new page to an existing site, streaming progress via SSE
// ============================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { planPage, generateSection } from '@/services/sectionGeneratorService'
import { renderPage } from '@/lib/renderer'
import type { SectionRow, PageRow, ThemeConfig } from '@/types/site'

export const maxDuration = 300

export async function POST(request: Request) {
  let body: {
    siteId?: string
    pageName?: string
    pageSlug?: string
    userId?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { siteId, pageName, pageSlug, userId } = body

  if (!siteId || !pageName || !pageSlug || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!/^[a-z0-9-]{2,50}$/.test(pageSlug)) {
    return NextResponse.json(
      { error: 'Slug must be 2–50 lowercase letters, numbers, or hyphens' },
      { status: 400 }
    )
  }

  const { data: site, error: siteErr } = await supabaseAdmin
    .from('sites')
    .select('id, name, subdomain, theme, update_email, status')
    .eq('id', siteId)
    .eq('owner_id', userId)
    .single()

  if (siteErr || !site) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 })
  }

  if (site.status !== 'active') {
    return NextResponse.json({ error: 'Site is not yet active' }, { status: 409 })
  }

  const { data: existingPage } = await supabaseAdmin
    .from('pages')
    .select('id')
    .eq('site_id', siteId)
    .eq('slug', pageSlug)
    .single()

  if (existingPage) {
    return NextResponse.json(
      { error: `A page with slug "${pageSlug}" already exists on this site` },
      { status: 409 }
    )
  }

  const theme = site.theme as ThemeConfig
  const basePath = `/sites/${site.subdomain}`
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ── 1. Gather context for the smart page planner ──────
        send({ type: 'status', message: `Planning ${pageName} page…` })

        // Get homepage section types so the planner knows what's already covered
        const { data: homePageRow } = await supabaseAdmin
          .from('pages')
          .select('id')
          .eq('site_id', siteId)
          .eq('is_homepage', true)
          .single()

        let homepageSectionTypes: string[] = []
        if (homePageRow) {
          const { data: homeSections } = await supabaseAdmin
            .from('sections')
            .select('type')
            .eq('page_id', homePageRow.id)
            .eq('published', true)
            .order('order_index', { ascending: true })
          homepageSectionTypes = (homeSections ?? []).map(s => s.type as string)
        }

        // Get existing page titles so the planner knows what's already on the site
        const { data: existingPagesForPlan } = await supabaseAdmin
          .from('pages')
          .select('nav_label, is_homepage')
          .eq('site_id', siteId)
          .eq('published', true)

        const existingPageTitles = (existingPagesForPlan ?? [])
          .filter(p => !p.is_homepage)
          .map(p => p.nav_label as string)

        const siteStyle = (site.theme as ThemeConfig).style ?? 'modern'

        // ── 2. AI plans sections + writes rationale ────────────
        const { sections, rationale } = await planPage(
          pageName,
          site.name,
          siteStyle,
          existingPageTitles,
          homepageSectionTypes,
        )

        const totalSections = sections.length
        // Rationale becomes the page context — threads through every generateSection() call
        const pageContext = rationale

        // ── 3. Create page record ──────────────────────────────
        const { data: existingPages } = await supabaseAdmin
          .from('pages')
          .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
          .eq('site_id', siteId)
          .order('nav_order', { ascending: true })

        const maxNavOrder = existingPages?.length
          ? Math.max(...existingPages.map((p) => p.nav_order as number))
          : 0

        const { data: newPageRow, error: pageErr } = await supabaseAdmin
          .from('pages')
          .insert({
            site_id: siteId,
            slug: pageSlug,
            title: `${pageName} | ${site.name}`,
            nav_label: pageName,
            nav_order: maxNavOrder + 1,
            is_homepage: false,
            published: true,
          })
          .select()
          .single()

        if (pageErr || !newPageRow) {
          send({ type: 'error', message: 'Failed to create page record.' })
          controller.close()
          return
        }

        // ── 4. Generate each section with rationale as context ─
        const builtSections: SectionRow[] = []

        for (let i = 0; i < sections.length; i++) {
          const sectionPlan = sections[i]
          send({
            type: 'progress',
            message: `Building ${sectionPlan.label}…`,
            current: i + 1,
            total: totalSections,
          })

          const { content, sectionCss, sectionJs } = await generateSection(
            sectionPlan.type,
            sectionPlan.label,
            site.name,
            pageContext,
            theme
          )

          const { data: sectionRow, error: secErr } = await supabaseAdmin
            .from('sections')
            .insert({
              page_id: newPageRow.id,
              site_id: siteId,
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

          if (!secErr && sectionRow) builtSections.push(sectionRow as SectionRow)
        }

        // ── 5. Fetch all pages for nav + render ────────────────
        send({ type: 'status', message: 'Rendering page…' })

        const { data: allPageRows } = await supabaseAdmin
          .from('pages')
          .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
          .eq('site_id', siteId)
          .order('nav_order', { ascending: true })

        const allPages = (allPageRows ?? []) as PageRow[]

        // ── 6. Cache the new page ──────────────────────────────
        const newPageHtml = renderPage({
          page: newPageRow as PageRow,
          sections: builtSections,
          theme,
          siteName: site.name,
          allPages,
          updateEmail: site.update_email,
          basePath,
        })

        await supabaseAdmin.from('site_html_cache').upsert(
          {
            site_id: siteId,
            subdomain: `${site.subdomain}/${pageSlug}`,
            html_content: newPageHtml,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'subdomain' }
        )

        // ── 7. Re-cache all other pages (nav has a new entry) ──
        send({ type: 'status', message: 'Updating navigation on all pages…' })

        for (const otherPage of allPages.filter(p => p.slug !== pageSlug)) {
          const { data: otherSections } = await supabaseAdmin
            .from('sections')
            .select('*')
            .eq('page_id', otherPage.id)
            .eq('published', true)
            .order('order_index', { ascending: true })

          if (otherSections?.length) {
            const cacheKey = otherPage.is_homepage
              ? site.subdomain
              : `${site.subdomain}/${otherPage.slug}`

            const otherHtml = renderPage({
              page: otherPage,
              sections: otherSections as SectionRow[],
              theme,
              siteName: site.name,
              allPages,
              updateEmail: site.update_email,
              basePath,
            })

            await supabaseAdmin.from('site_html_cache').upsert(
              {
                site_id: siteId,
                subdomain: cacheKey,
                html_content: otherHtml,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'subdomain' }
            )
          }
        }

        send({ type: 'done', pageId: newPageRow.id, slug: pageSlug, url: `/${pageSlug}` })
      } catch (err) {
        console.error('Generate-page error:', err)
        send({ type: 'error', message: 'Page generation failed. Please try again.' })
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
