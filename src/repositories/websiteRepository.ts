import { supabaseAdmin } from '@/lib/supabase-server'

export interface WebsiteRow {
  id: string
  owner_id: string
  html_content: string
  name: string
}

export async function getWebsiteBySubdomain(
  subdomain: string
): Promise<WebsiteRow | null> {
  const { data, error } = await supabaseAdmin
    .from('websites')
    .select('id, owner_id, html_content, name')
    .eq('subdomain', subdomain)
    .single()

  if (error || !data) return null
  return data as WebsiteRow
}

export async function getOwnerEmail(
  ownerId: string
): Promise<string | undefined> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(ownerId)
  return data?.user?.email?.toLowerCase()
}

export async function isAuthorizedEditor(
  websiteId: string,
  email: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('authorized_editors')
    .select('id')
    .eq('website_id', websiteId)
    .eq('email', email)
    .single()
  return !!data
}

export async function updateWebsiteHtml(
  websiteId: string,
  htmlContent: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('websites')
    .update({ html_content: htmlContent })
    .eq('id', websiteId)

  if (error) {
    console.error('DB update error:', error)
    return false
  }
  return true
}
