import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'

interface Props {
  params: Promise<{ subdomain: string }>
}

export async function generateMetadata({ params }: Props) {
  const { subdomain } = await params
  const { data: site } = await supabaseAdmin
    .from('websites')
    .select('name')
    .eq('subdomain', subdomain)
    .single()

  return {
    title: site?.name ?? 'SiteSync Website',
  }
}

export default async function SitePage({ params }: Props) {
  const { subdomain } = await params

  const { data: site } = await supabaseAdmin
    .from('websites')
    .select('html_content, name')
    .eq('subdomain', subdomain)
    .single()

  if (!site) {
    notFound()
  }

  // Render the raw HTML directly as an iframe-like full-page experience
  return (
    <html>
      <body
        style={{ margin: 0, padding: 0 }}
        dangerouslySetInnerHTML={{ __html: site.html_content }}
      />
    </html>
  )
}
