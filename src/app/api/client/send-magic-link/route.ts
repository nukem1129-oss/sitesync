// ============================================================
// SiteSync — /api/client/send-magic-link
// Validates email is authorized for the subdomain, then
// sends a one-click login link via Mailgun.
// No AI tokens used.
// ============================================================
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendMailgunEmail } from '@/lib/mailgunWebhook'
import crypto from 'crypto'

export async function POST(request: Request) {
  let body: { subdomain?: string; email?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const subdomain = body.subdomain?.toLowerCase().trim()
  const email = body.email?.toLowerCase().trim()

  if (!subdomain || !email) {
    return NextResponse.json({ error: 'Missing subdomain or email' }, { status: 400 })
  }

  // ── 1. Look up site ──────────────────────────────────────
  const { data: site } = await supabaseAdmin
    .from('sites')
    .select('id, name, owner_id, authorized_senders')
    .eq('subdomain', subdomain)
    .single()

  if (!site) {
    // Return success anyway to avoid subdomain enumeration
    return NextResponse.json({ ok: true })
  }

  // ── 2. Check email is authorized ─────────────────────────
  const isAuthorized =
    site.authorized_senders?.includes(email) ||
    (await (async () => {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(site.owner_id)
      if (user.user?.email?.toLowerCase() === email) return true
      const { data: editor } = await supabaseAdmin
        .from('authorized_editors')
        .select('id')
        .eq('site_id', site.id)
        .eq('email', email)
        .single()
      return !!editor
    })())

  if (!isAuthorized) {
    // Return success anyway to avoid email enumeration
    return NextResponse.json({ ok: true })
  }

  // ── 3. Generate token ────────────────────────────────────
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await supabaseAdmin.from('client_tokens').insert({
    subdomain,
    email,
    token,
    expires_at: expiresAt.toISOString(),
  })

  // ── 4. Send magic link ───────────────────────────────────
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sitesync-psi.vercel.app'
  const link = `${baseUrl}/client/${subdomain}?token=${token}`

  await sendMailgunEmail({
    to: email,
    subject: `Your login link for ${site.name}`,
    text: `Here is your one-click login link for the ${site.name} client portal:

${link}

This link expires in 1 hour. If you didn't request this, you can ignore this email.

Powered by SiteSync`,
  })

  return NextResponse.json({ ok: true })
}
