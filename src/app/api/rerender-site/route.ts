// ============================================================
// SiteSync v2 — /api/rerender-site
// Clears HTML cache for a site so the next visit re-renders
// with the latest renderer templates. Content unchanged.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(request: Request) {
  let body: { siteId?: string; userId?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { siteId, userId } = body
  if (!siteId || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify ownership
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .eq('owner_id', userId)
    .single()

  if (!site) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 })
  }

  // Clear all cached HTML for this site
  const { error } = await supabaseAdmin
    .from('site_html_cache')
    .delete()
    .eq('site_id', siteId)

  if (error) {
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
