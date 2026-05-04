// ============================================================
// SiteSync v2 — /api/generate-page
// Adds a new page to an existing site, streaming progress via SSE
// ============================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { planSite, generateSection } from '@/services/sectionGeneratorService'
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
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        send({ type: 'status', message: `Planning ${pageName} page…` })

        const plan = await planSite(
          site.name,
          `Create a "${pageName}" page for ${site.name}. Plan sections appropriate for a ${pageName} page only — do not repeat the hero or homepage sections.`
        )

        const innerPageTypes = new Set(['about', 'services', 'features', 'team', 'faq', 'gallery', 'contact', 'pricing', 'testimonials'])
        const rawSections = plan.pages[0]?.sections ?? []
        let sections = rawSections.filter(s => innerPageTypes.has(s.type)).slice(0, 4)

        if (sections.length < 2) {
          sections = [
            { type: 'about', label: pageName },
            { type: 'contact', label: 'Get in Touch' },
          ]
        }

        const totalSections = sections.length

        const { data: existingPages } = await supabaseAdmin
          .from('pages')
          .select('id, slug, title, nav_label, nav_order, is_homepage, published')
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

        const builtSections: SectionRow[] = []

        for (let i = 0; i < sections.length; i++) {
          const sectionPlan = sections[i]
          send({ type: 'progress', message: `Building ${sectionPlan.label}…`, current: i + 1, total: totalSections })

          const { content, sectionCss, sectionJs } = await generateSection(
            sectionPlan.type, sectionPlan.label, site.name,
            `This is the ${pageName} page for ${site.name}.`, theme
          )

          const { data: sectionRow, error: secErr } = await supabaseAdmin
            .from('sections')
            .insert({
              page_id: newPageRow.id, site_id: siteId,
              type: sectionPlan.type, order_index: i,
              label: sectionPlan.label, content,
              section_css: sectionCss, section_js: sectionJs, published: true,
            })
            .select().single()

          if (!secErr && sectionRow) builtSections.push(sectionRow as SectionRow)
        }

        send({ type: 'status', message: 'Rendering page…' })

        const { data: allPageRows } = await supabaseAdmin
          .from('pages')
          .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
          .eq('site_id', siteId)
          .order('nav_order', { ascending: true })

        const allPages = (allPageRows ?? []) as PageRow[]

        const newPageHtml = renderPage({
          page: newPageRow as PageRow, sections: builtSections,
          theme, siteName: site.name, allPages, updateEmail: site.update_email,
        })

        await supabaseAdmin.from('site_html_cache').upsert({
          site_id: siteId, subdomain: `${site.subdomain}/${pageSlug}`,
          html_content: newPageHtml, updated_at: new Date().toISOString(),
        },
        { onConflict: 'subdomain' }
)

        send({ type: 'status', message: 'Updating homepage nav…' })

        const homePageRow = allPages.find((p) => p.is_homepage)
        if (homePageRow) {
          const { data: homeSections } = await supabaseAdmin
            .from('sections').select('*')
            .eq('page_id', homePageRow.id).eq('published', true)
            .order('order_index', { ascending: true })

          if (homeSections?.length) {
            const homeHtml = renderPage({
              page: homePageRow, sections: homeSections as SectionRow[],
              theme, siteName: site.name, allPages, updateEmail: site.update_email,
            })
            await supabaseAdmin.from('site_html_cache').upsert({
              site_id: siteId, subdomain: site.subdomain,
              html_content: homeHtml, updated_at: new Date().toISOString(),
            },
            { onConflict: 'subdomain' }
)
          }
        }

        for (const otherPage of allPages.filter(p => !p.is_homepage && p.slug !== pageSlug)) {
          const { data: otherSections } = await supabaseAdmin
            .from('sections').select('*')
            .eq('page_id', otherPage.id).eq('published', true)
            .order('order_index', { ascending: true })

          if (otherSections?.length) {
            const otherHtml = renderPage({
              page: otherPage, sections: otherSections as SectionRow[],
              theme, siteName: site.name, allPages, updateEmail: site.update_email,
            })
            await supabaseAdmin.from('site_html_cache').upsert({
              site_id: siteId, subdomain: `${site.subdomain}/${otherPage.slug}`,
              html_content: otherHtml, updated_at: new Date().toISOString(),
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
