// ============================================================
// SiteSync v2 — homepage renderer
// Fast path: site_html_cache | fallback: render from sections
// Cache key: "{subdomain}"
// ============================================================
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import { renderPage } from '@/lib/renderer'
import type { SectionRow, PageRow, ThemeConfig } from '@/types/site'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ subdomain: string }>
}

export async function generateMetadata({ params }: Props) {
  const { subdomain } = await params
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('name')
    .eq('subdomain', subdomain)
    .single()
  return { title: site?.name ?? 'SiteSync Website' }
}

export default async function SitePage({ params }: Props) {
  const { subdomain } = await params
  const basePath = `/sites/${subdomain}`

  // ── Fast path: serve from HTML cache ─────────────────────
  const { data: cache } = await supabaseAdmin
    .from('site_html_cache')
    .select('html_content')
    .eq('subdomain', subdomain)
    .maybeSingle()

  if (cache?.html_content) {
    return (
      <html suppressHydrationWarning>
        <body style={{ margin: 0, padding: 0 }} dangerouslySetInnerHTML={{ __html: cache.html_content }} />
      </html>
    )
  }

  // ── Fallback: render from DB ──────────────────────────────
  console.log(`[SitePage] Cache miss for ${subdomain} — rendering from DB`)

  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, name, subdomain, theme, update_email')
    .eq('subdomain', subdomain)
    .maybeSingle()

  if (!site) notFound()

  const { data: homePageRow } = await supabaseAdmin
    .from('pages')
    .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
    .eq('site_id', site.id)
    .eq('is_homepage', true)
    .eq('published', true)
    .maybeSingle()

  if (!homePageRow) {
    // Last resort: try legacy websites table
    const { data: legacy } = await supabaseAdmin
      .from('websites')
      .select('html_content')
      .eq('subdomain', subdomain)
      .single()
    if (!legacy) notFound()
    return (
      <html suppressHydrationWarning>
        <body style={{ margin: 0, padding: 0 }} dangerouslySetInnerHTML={{ __html: legacy!.html_content }} />
      </html>
    )
  }

  const { data: sections } = await supabaseAdmin
    .from('sections')
    .select('*')
    .eq('page_id', homePageRow.id)
    .eq('published', true)
    .order('order_index', { ascending: true })

  const { data: allPageRows } = await supabaseAdmin
    .from('pages')
    .select('id, slug, title, nav_label, nav_order, is_homepage, published, site_id')
    .eq('site_id', site.id)
    .order('nav_order', { ascending: true })

  const html = renderPage({
    page: homePageRow as PageRow,
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
      subdomain,
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
