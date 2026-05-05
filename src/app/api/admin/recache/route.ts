// ============================================================
// SiteSync — /api/admin/recache
// Clears site_html_cache for a subdomain so pages re-render
// with correct nav links on next visit.
// Protected: requires valid userId (site owner).
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(request: Request) {
  let body: { subdomain?: string; userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { subdomain, userId } = body
  if (!subdomain || !userId) {
    return NextResponse.json({ error: 'subdomain and userId required' }, { status: 400 })
  }

  // Verify the user owns this site
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, subdomain')
    .eq('subdomain', subdomain)
    .eq('owner_id', userId)
    .single()

  if (!site) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 })
  }

  // Delete all cache entries for this site (homepage + all sub-pages)
  const { error, count } = await supabaseAdmin
    .from('site_html_cache')
    .delete({ count: 'exact' })
    .eq('site_id', site.id)

  if (error) {
    console.error('Recache error:', error)
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    subdomain,
    rowsDeleted: count ?? 0,
    message: `Cache cleared — pages will re-render with correct nav links on next visit`,
  })
}
