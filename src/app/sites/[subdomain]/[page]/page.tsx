// ============================================================
// SiteSync v2 — sub-page renderer
// Fast path: site_html_cache | fallback: render from DB
// Cache key: "{subdomain}/{slug}"
// ============================================================
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { renderPage } from '@/lib/renderer'
import type { SectionRow, PageRow, ThemeConfig } from '@/types/site'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ subdomain: string; page: string }>
}

export async function generateMetadata({ params }: Props) {
  const { subdomain, page } = await params
  const cacheKey = `${subdomain}/${page}`
  const { data: cache } = await supabaseAdmin
    .from('site_html_cache')
    .select('html_content')
    .eq('subdomain', cacheKey)
    .maybeSingle()
  if (cache?.html_content) {
    const titleMatch = cache.html_content.match(/<title>([^<]*)<\/title>/)
    if (titleMatch) return { title: titleMatch[1] }
  }
  const { data: site } = await supabaseAdmin
    .from('sites').select('name').eq('subdomain', subdomain).maybeSingle()
  return { title: site?.name ?? 'SiteSync Website' }
}

export default async function SubPage({ params }: Props) {
  const { subdomain, page: slug } = await params
  const cacheKey = `${subdomain}/${slug}`
  const basePath = `/sites/${subdomain}`

  // ── Fast path: serve from HTML cache ─────────────────────
  const { data: cache } = await supabaseAdmin
    .from('site_html_cache')
    .select('html_content')
    .eq('subdomain', cacheKey)
    .maybeSingle()

  if (cache?.html_content) {
    return (
      <html suppressHydrationWarning>
        <body style={{ margin: 0, padding: 0 }} dangerouslySetInnerHTML={{ __html: cache.html_content }} />
      </html>
    )
  }

  // ── Fallback: render directly from DB ─────────────────────
  console.log(`[SubPage] Cache miss for ${cacheKey} — rendering from DB`)

  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, name, subdomain, theme, update_email')
    .eq('subdomain', subdomain)
    .maybeSingle()

  if (!site) notFound()

  const { data: pageRow } = await supabaseAdmin
    .from('pages')
    .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
    .eq('site_id', site.id)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()

  if (!pageRow) notFound()

  const { data: sections } = await supabaseAdmin
    .from('sections')
    .select('*')
    .eq('page_id', pageRow.id)
    .eq('published', true)
    .order('order_index', { ascending: true })

  const { data: allPageRows } = await supabaseAdmin
    .from('pages')
    .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
    .eq('site_id', site.id)
    .order('nav_order', { ascending: true })

  const html = renderPage({
    page: pageRow as PageRow,
    sections: (sections ?? []) as SectionRow[],
    theme: site.theme as ThemeConfig,
    siteName: site.name,
    allPages: (allPageRows ?? []) as PageRow[],
    updateEmail: site.update_email,
    basePath,
  })

  // Write to cache for next time
  await supabaseAdmin.from('site_html_cache').upsert(
    {
      site_id: site.id,
      subdomain: cacheKey,
      html_content: html,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'subdomain' }
  )

  return (
    <html suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
    </html>
  )
}
