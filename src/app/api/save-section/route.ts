// ============================================================
// SiteSync — /api/save-section
// Updates a section's content JSON and clears the site cache.
// Protected: verifies the requesting user owns the site.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function PATCH(request: Request) {
  let body: { sectionId?: string; content?: Record<string, unknown>; siteId?: string; userId?: string }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { sectionId, content, siteId, userId } = body

  if (!sectionId || !content || !siteId || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // ── Verify ownership ──────────────────────────────────────
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .eq('owner_id', userId)
    .single()

  if (!site) {
    return NextResponse.json({ error: 'Site not found or access denied' }, { status: 403 })
  }

  // ── Update section content ────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from('sections')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', sectionId)
    .eq('site_id', siteId)

  if (updateError) {
    console.error('save-section update error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // ── Clear HTML cache so live site re-renders ──────────────
  await supabaseAdmin
    .from('site_html_cache')
    .delete()
    .eq('site_id', siteId)

  return NextResponse.json({ ok: true })
}
