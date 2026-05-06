// ============================================================
// SiteSync — /api/client/history
// Returns recent update history for a site from the versions table.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const subdomain = searchParams.get('subdomain')?.toLowerCase().trim()
  const email = searchParams.get('email')?.toLowerCase().trim()

  if (!subdomain || !email) {
    return NextResponse.json({ error: 'Missing subdomain or email' }, { status: 400 })
  }

  const { data: site } = await supabaseAdmin
    .from('sites').select('id, owner_id, authorized_senders').eq('subdomain', subdomain).single()
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  // Verify email is authorized
  const { data: ownerData } = await supabaseAdmin.auth.admin.getUserById(site.owner_id)
  const isOwner = ownerData.user?.email?.toLowerCase() === email
  const isEditor = site.authorized_senders?.includes(email) ?? false
  if (!isOwner && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: versions } = await supabaseAdmin
    .from('versions')
    .select('id, trigger, triggered_by, update_instructions, created_at, page_id')
    .eq('site_id', site.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Get page names for context
  const pageIds = [...new Set((versions ?? []).map(v => v.page_id).filter(Boolean))]
  let pageMap: Record<string, string> = {}
  if (pageIds.length) {
    const { data: pages } = await supabaseAdmin
      .from('pages').select('id, nav_label, slug').in('id', pageIds)
    pages?.forEach(p => { pageMap[p.id] = p.nav_label ?? p.slug })
  }

  const history = (versions ?? []).map(v => ({
    id: v.id,
    trigger: v.trigger,
    triggeredBy: v.triggered_by,
    instructions: v.update_instructions,
    pageName: v.page_id ? (pageMap[v.page_id] ?? 'Unknown page') : 'All pages',
    createdAt: v.created_at,
  }))

  return NextResponse.json({ history })
}
