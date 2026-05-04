import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'

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

  // v2: read from HTML cache
  const { data: cache } = await supabaseAdmin
    .from('site_html_cache')
    .select('html_content')
    .eq('subdomain', subdomain)
    .single()

  if (cache) {
    return (
      <html suppressHydrationWarning>
        <body style={{ margin: 0, padding: 0 }} dangerouslySetInnerHTML={{ __html: cache.html_content }} />
      </html>
    )
  }

  // v1 fallback: old websites table
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
