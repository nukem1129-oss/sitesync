// ============================================================
// SiteSync v2 — /api/submit-form
// Stores form submission and emails the site owner
// ============================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendMailgunEmail } from '@/lib/mailgunWebhook'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sectionId, data } = body as { sectionId: string; data: Record<string, string> }

    if (!sectionId || !data) {
      return NextResponse.json({ error: 'Missing sectionId or data' }, { status: 400 })
    }

    // Look up the section to get site + page context
    const { data: section, error: secErr } = await supabaseAdmin
      .from('sections')
      .select('id, site_id, page_id, content')
      .eq('id', sectionId)
      .single()

    if (secErr || !section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Get site for recipient email
    const { data: site } = await supabaseAdmin
      .from('sites')
      .select('name, form_recipient_email, subdomain')
      .eq('id', section.site_id)
      .single()

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // Extract signature data (if present) — store separately
    const signatureData = data.signature as string | undefined
    const formData = { ...data }
    if (signatureData) delete formData.signature

    // Get submitter IP
    const submitterIp = request.headers.get('x-forwarded-for')?.split(',')[0] ?? undefined
    const submitterEmail = formData.email ?? undefined

    // Store the submission
    const { error: insertErr } = await supabaseAdmin
      .from('form_submissions')
      .insert({
        site_id: section.site_id,
        page_id: section.page_id,
        section_id: sectionId,
        data: formData,
        signature_data: signatureData ?? null,
        submitter_ip: submitterIp ?? null,
        submitter_email: submitterEmail ?? null,
        email_sent: false,
      })

    if (insertErr) {
      console.error('Form submission insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // Send email notification to site owner
    const recipientEmail = site.form_recipient_email
    if (recipientEmail) {
      const fieldLines = Object.entries(formData)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')

      const hasSignature = !!signatureData

      try {
        await sendMailgunEmail({
          to: recipientEmail,
          subject: `New form submission — ${site.name}`,
          text: `You received a new form submission from ${site.subdomain}.sitesync.app

${fieldLines}
${hasSignature ? '\n[Signature attached — view in your dashboard]' : ''}

Submitted at: ${new Date().toISOString()}`,
        })

        // Mark email as sent
        await supabaseAdmin
          .from('form_submissions')
          .update({ email_sent: true, email_sent_at: new Date().toISOString() })
          .eq('site_id', section.site_id)
          .order('created_at', { ascending: false })
          .limit(1)
      } catch (emailErr) {
        console.error('Email notification failed:', emailErr)
        // Non-fatal — submission is already saved
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Submit form error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
