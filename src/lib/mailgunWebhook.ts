import crypto from 'crypto'

export function verifyMailgunSignature(
  signingKey: string,
  timestamp: string,
  token: string,
  signature: string
): boolean {
  const value = timestamp + token
  const hmac = crypto.createHmac('sha256', signingKey)
  hmac.update(value)
  const computedSignature = hmac.digest('hex')
  return computedSignature === signature
}

export async function sendMailgunEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}): Promise<void> {
  const domain = process.env.MAILGUN_DOMAIN!
  const apiKey = process.env.MAILGUN_API_KEY!

  const formData = new URLSearchParams()
  formData.append('from', `SiteSync <noreply@${domain}>`)
  formData.append('to', to)
  formData.append('subject', subject)
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
    console.error('Mailgun send error:', error)
  }
}
