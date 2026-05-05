// ============================================================
// SiteSync — /api/delete-site
// Deletes a site and all associated data
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function DELETE(request: Request) {
  let body: { siteId?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { siteId, userId } = body
  if (!siteId || !userId) {
    return NextResponse.json({ error: 'Missing siteId or userId' }, { status: 400 })
  }

  // Verify ownership
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, owner_id, name')
    .eq('id', siteId)
    .single()

  if (!site || site.owner_id !== userId) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 })
  }

  // Delete in order (children before parents)
  await supabaseAdmin.from('site_html_cache').delete().eq('site_id', siteId)
  await supabaseAdmin.from('versions').delete().eq('site_id', siteId)
  await supabaseAdmin.from('sections').delete().eq('site_id', siteId)
  await supabaseAdmin.from('pages').delete().eq('site_id', siteId)
  await supabaseAdmin.from('authorized_editors').delete().eq('site_id', siteId)
  const { error } = await supabaseAdmin.from('sites').delete().eq('id', siteId)

  if (error) {
    console.error('Delete site error:', error)
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
