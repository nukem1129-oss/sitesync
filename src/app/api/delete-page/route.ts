// ============================================================
// SiteSync v2 — /api/delete-page
// Deletes a page, its sections, its cache entry, and
// re-renders all remaining pages so nav stays in sync
// ============================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { renderPage } from '@/lib/renderer'
import type { SectionRow, PageRow, Theme } from '@/types/site'

export async function DELETE(request: Request) {
  // ── 1. Parse & validate ───────────────────────────────────
  let body: { siteId?: string; pageId?: string; userId?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { siteId, pageId, userId } = body

  if (!siteId || !pageId || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // ── 2. Verify ownership ───────────────────────────────────
  const { data: site, error: siteErr } = await supabaseAdmin
    .from('sites')
    .select('id, name, subdomain, theme, update_email')
    .eq('id', siteId)
    .eq('owner_id', userId)
    .single()

  if (siteErr || !site) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 })
  }

  // ── 3. Get the page to be deleted ─────────────────────────
  const { data: page, error: pageErr } = await supabaseAdmin
    .from('pages')
    .select('id, slug, is_homepage')
    .eq('id', pageId)
    .eq('site_id', siteId)
    .single()

  if (pageErr || !page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  }

  if (page.is_homepage) {
    return NextResponse.json({ error: 'Cannot delete the homepage' }, { status: 400 })
  }

  // ── 4. Delete sections for this page ─────────────────────
  await supabaseAdmin
    .from('sections')
    .delete()
    .eq('page_id', pageId)

  // ── 5. Delete the page row ────────────────────────────────
  const { error: deleteErr } = await supabaseAdmin
    .from('pages')
    .delete()
    .eq('id', pageId)

  if (deleteErr) {
    return NextResponse.json({ error: 'Failed to delete page' }, { status: 500 })
  }

  // ── 6. Remove the cache entry for this page ───────────────
  await supabaseAdmin
    .from('site_html_cache')
    .delete()
    .eq('subdomain', `${site.subdomain}/${page.slug}`)

  // ── 7. Fetch remaining pages ──────────────────────────────
  const { data: remainingPageRows } = await supabaseAdmin
    .from('pages')
    .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
    .eq('site_id', siteId)
    .order('nav_order', { ascending: true })

  const allPages = (remainingPageRows ?? []) as PageRow[]
  const theme = site.theme as Theme

  // ── 8. Re-render all remaining pages so nav is updated ───
  for (const p of allPages) {
    const { data: pageSections } = await supabaseAdmin
      .from('sections')
      .select('*')
      .eq('page_id', p.id)
      .eq('published', true)
      .order('order_index', { ascending: true })

    if (!pageSections?.length) continue

    const html = renderPage({
      page: p,
      sections: pageSections as SectionRow[],
      theme,
      siteName: site.name,
      allPages,
      updateEmail: site.update_email,
    })

    const cacheKey = p.is_homepage ? site.subdomain : `${site.subdomain}/${p.slug}`

    await supabaseAdmin.from('site_html_cache').upsert({
      site_id: siteId,
      subdomain: cacheKey,
      html_content: html,
      updated_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ success: true, deletedSlug: page.slug })
}
