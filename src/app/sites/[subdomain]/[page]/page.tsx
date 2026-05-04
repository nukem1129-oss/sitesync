// ============================================================
// SiteSync v2 — sub-page renderer
// Serves /sites/[subdomain]/[page] from site_html_cache
// Cache key: "{subdomain}/{slug}"
// ============================================================

import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase-server'

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
    .single()

  if (cache) {
    const titleMatch = cache.html_content.match(/<title>([^<]*)<\/title>/)
    if (titleMatch) return { title: titleMatch[1] }
  }

  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('name')
    .eq('subdomain', subdomain)
    .single()

  return { title: site?.name ?? 'SiteSync Website' }
}

export default async function SubPage({ params }: Props) {
  const { subdomain, page } = await params
  const cacheKey = `${subdomain}/${page}`

  const { data: cache } = await supabaseAdmin
    .from('site_html_cache')
    .select('html_content')
    .eq('subdomain', cacheKey)
    .single()

  if (cache) {
    return (
      <html suppressHydrationWarning>
        <body
          style={{ margin: 0, padding: 0 }}
          dangerouslySetInnerHTML={{ __html: cache.html_content }}
        />
      </html>
    )
  }

  notFound()
}
