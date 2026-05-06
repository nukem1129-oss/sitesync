// ============================================================
// SiteSync — /api/client/editors
// GET  — list authorized senders for a site
// POST — add an editor email
// DELETE — remove an editor email
// Only the site owner or existing authorized senders can manage editors.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

async function isAuthorized(siteId: string, ownerId: string, email: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin.auth.admin.getUserById(ownerId)
  if (user.user?.email?.toLowerCase() === email) return true
  const { data: site } = await supabaseAdmin
    .from('sites').select('authorized_senders').eq('id', siteId).single()
  return site?.authorized_senders?.includes(email) ?? false
}

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

  const auth = await isAuthorized(site.id, site.owner_id, email)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  return NextResponse.json({ editors: site.authorized_senders ?? [] })
}

export async function POST(request: Request) {
  let body: { subdomain?: string; email?: string; newEditor?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const subdomain = body.subdomain?.toLowerCase().trim()
  const email = body.email?.toLowerCase().trim()
  const newEditor = body.newEditor?.toLowerCase().trim()

  if (!subdomain || !email || !newEditor) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEditor)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const { data: site } = await supabaseAdmin
    .from('sites').select('id, owner_id, authorized_senders').eq('subdomain', subdomain).single()
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const auth = await isAuthorized(site.id, site.owner_id, email)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const current: string[] = site.authorized_senders ?? []
  if (current.includes(newEditor)) {
    return NextResponse.json({ error: 'That email is already an editor' }, { status: 409 })
  }

  const updated = [...current, newEditor]
  await supabaseAdmin.from('sites').update({ authorized_senders: updated }).eq('id', site.id)

  return NextResponse.json({ ok: true, editors: updated })
}

export async function DELETE(request: Request) {
  let body: { subdomain?: string; email?: string; removeEditor?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const subdomain = body.subdomain?.toLowerCase().trim()
  const email = body.email?.toLowerCase().trim()
  const removeEditor = body.removeEditor?.toLowerCase().trim()

  if (!subdomain || !email || !removeEditor) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (email === removeEditor) {
    return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 })
  }

  const { data: site } = await supabaseAdmin
    .from('sites').select('id, owner_id, authorized_senders').eq('subdomain', subdomain).single()
  if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

  const auth = await isAuthorized(site.id, site.owner_id, email)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const updated = (site.authorized_senders ?? []).filter((e: string) => e !== removeEditor)
  await supabaseAdmin.from('sites').update({ authorized_senders: updated }).eq('id', site.id)

  return NextResponse.json({ ok: true, editors: updated })
}
