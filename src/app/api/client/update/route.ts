// ============================================================
// SiteSync — /api/client/update
// Client portal: submit update instructions for their site.
// Reuses the same AI update flow as inbound email.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { processSiteUpdate } from '@/services/emailUpdateService'

export async function POST(request: Request) {
  let body: { subdomain?: string; email?: string; instructions?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const subdomain = body.subdomain?.toLowerCase().trim()
  const email = body.email?.toLowerCase().trim()
  const instructions = body.instructions?.trim()

  if (!subdomain || !email || !instructions) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (instructions.length < 5) {
    return NextResponse.json({ error: 'Instructions too short' }, { status: 400 })
  }

  const result = await processSiteUpdate(
    subdomain,
    email,
    `Client portal update for ${subdomain}`,
    instructions
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
