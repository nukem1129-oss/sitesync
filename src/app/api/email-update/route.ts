import { NextResponse } from 'next/server'
import { verifyMailgunSignature } from '@/lib/mailgunWebhook'
import { processSiteUpdate } from '@/services/emailUpdateService'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const timestamp = formData.get('timestamp') as string
    const token = formData.get('token') as string
    const signature = formData.get('signature') as string
    const sender = (formData.get('sender') as string)?.toLowerCase().trim()
    const recipient = formData.get('recipient') as string
    const subject = (formData.get('subject') as string) || '(no subject)'
    const bodyPlain = (formData.get('body-plain') as string) || ''

    // Verify Mailgun webhook signature
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY!
    if (!verifyMailgunSignature(signingKey, timestamp, token, signature)) {
      console.error('Invalid Mailgun signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Extract subdomain from recipient: update+subdomain@mg.sceneengineering.com
    const recipientMatch = recipient.match(/update\+([^@]+)@/i)
    if (!recipientMatch) {
      console.error('Could not extract subdomain from recipient:', recipient)
      return NextResponse.json({ error: 'Invalid recipient format' }, { status: 400 })
    }
    const subdomain = recipientMatch[1].toLowerCase()
    const instructions = bodyPlain.trim() || 'Make general improvements to the site.'

    const result = await processSiteUpdate(subdomain, sender, subject, instructions)

    if (!result.ok) {
      // 403 unauthorized sender still returns 200 to Mailgun (rejection email was sent)
      if (result.status === 403) {
        return NextResponse.json({ message: 'Unauthorized sender — rejection email sent' }, { status: 200 })
      }
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ message: 'Site updated successfully' }, { status: 200 })
  } catch (err) {
    console.error('Email update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
