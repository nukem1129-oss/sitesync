// ============================================================
// SiteSync — /api/client/verify-token
// Validates a magic link token and returns session info.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(request: Request) {
  let body: { token?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token } = body
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  // ── Find token ───────────────────────────────────────────
  const { data: row } = await supabaseAdmin
    .from('client_tokens')
    .select('id, subdomain, email, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!row) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 })
  }
  if (row.used_at) {
    return NextResponse.json({ error: 'This link has already been used' }, { status: 401 })
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired — request a new one' }, { status: 401 })
  }

  // ── Mark as used ─────────────────────────────────────────
  await supabaseAdmin
    .from('client_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', row.id)

  // ── Fetch site name ──────────────────────────────────────
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('name')
    .eq('subdomain', row.subdomain)
    .single()

  return NextResponse.json({
    ok: true,
    email: row.email,
    subdomain: row.subdomain,
    siteName: site?.name ?? row.subdomain,
  })
}
