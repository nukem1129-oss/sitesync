import { NextResponse } from 'next/server'

async function sendMailgunEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text: string
}) {
  const domain = process.env.MAILGUN_DOMAIN!
  const apiKey = process.env.MAILGUN_API_KEY!

  const formData = new URLSearchParams()
  formData.append('from', `Scene Engineering <noreply@${domain}>`)
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('html', html)
  formData.append('text', text)

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Mailgun error: ${error}`)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, phone, business, plan, message } = body

    // Basic validation
    if (!name || !email || !business || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const planLabel = plan
      ? { starter: 'Starter ($149/mo)', professional: 'Professional ($299/mo)', elite: 'Elite ($599/mo)' }[plan as string] ?? plan
      : 'Not specified'

    const subject = `New inquiry from ${name} - ${business}`

    const text = [
      '== New Contact Form Submission ==',
      '',
      `Name:     ${name}`,
      `Email:    ${email}`,
      `Phone:    ${phone || 'Not provided'}`,
      `Business: ${business}`,
      `Plan:     ${planLabel}`,
      '',
      'Message:',
      message,
    ].join('\n')

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:8px;">
        <h2 style="color:#0a0f1e;margin-top:0;">New Contact Form Submission</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;width:110px;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#4f8ef7;">${email}</a></td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;">${phone || 'Not provided'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Business</td><td style="padding:8px 0;font-weight:600;">${business}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Plan</td><td style="padding:8px 0;">${planLabel}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">
          <p style="color:#6b7280;font-size:12px;margin-top:0;">Message</p>
          <p style="white-space:pre-wrap;margin-bottom:0;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
        <p style="margin-top:20px;text-align:center;">
          <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" style="background:#4f8ef7;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Reply to ${name}</a>
        </p>
      </div>
    `

    await sendMailgunEmail({
      to: 'info@sceneengineering.com',
      subject,
      html,
      text,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Contact form error:', err)
    return NextResponse.json(
      { error: 'Failed to send message. Please try emailing hello@sceneengineering.com directly.' },
      { status: 500 }
    )
  }
}
