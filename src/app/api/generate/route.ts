import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase-server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function POST(request: Request) {
  try {
    const { siteName, subdomain, prompt, userId, userEmail } = await request.json()

    // Validate required fields
    if (!siteName || !subdomain || !prompt || !userId || !userEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate subdomain format
    if (!/^[a-z0-9-]{3,30}$/.test(subdomain)) {
      return NextResponse.json(
        { error: 'Subdomain must be 3–30 lowercase letters, numbers, or hyphens' },
        { status: 400 }
      )
    }

    // Check subdomain isn't already taken
    const { data: existing } = await supabaseAdmin
      .from('websites')
      .select('id')
      .eq('subdomain', subdomain)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'That subdomain is already taken. Please choose another.' },
        { status: 409 }
      )
    }

    // Build the update email address for this site
    const updateEmail = `update+${subdomain}@sitesync.app`

    // ── Generate the website HTML with Claude ──────────────────────────────
    const systemPrompt = `You are an expert web developer and designer. Your job is to generate complete,
beautiful, production-ready HTML websites based on user descriptions.

Rules:
- Output ONLY valid HTML. No markdown, no explanation, no code fences.
- Use a single self-contained HTML file with embedded CSS (in <style> tags) and JavaScript (in <script> tags).
- Make the design modern, professional, and visually impressive. Use a consistent color scheme.
- Include responsive design (works on mobile and desktop).
- Use semantic HTML5 elements.
- Include smooth hover effects and subtle animations.
- Add a sticky navigation bar with smooth-scroll to sections.
- Include ALL sections the client requests — do not skip or abbreviate any section.
- Every section must have real placeholder content (not just a heading). Fill in realistic placeholder text, items, and details for each section.
- Include a contact section with a working placeholder form (show a success message on submit via JavaScript).
- Always close the HTML properly with </body></html> — never truncate mid-page.
- Include a small "Powered by SiteSync" badge in the footer.
- The update email for this site is: ${updateEmail} — include it subtly in the footer so the client knows how to update their site.

CRITICAL: You must output the ENTIRE page from <!DOCTYPE html> to </html>. Every section requested must be fully built out with content. Do not stop early.`

    const userMessage = `Create a complete website for: ${siteName}

Client description:
${prompt}

Site subdomain: ${subdomain}
Update email: ${updateEmail}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    })

    const htmlContent = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('')

    if (!htmlContent.includes('<html') && !htmlContent.includes('<!DOCTYPE')) {
      return NextResponse.json(
        { error: 'AI generation failed. Please try again.' },
        { status: 500 }
      )
    }

    // ── Save to Supabase ───────────────────────────────────────────────────
    const { data: website, error: dbError } = await supabaseAdmin
      .from('websites')
      .insert({
        owner_id: userId,
        name: siteName,
        subdomain,
        html_content: htmlContent,
        update_email: updateEmail,
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save website. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, websiteId: website.id, subdomain })
  } catch (err) {
    console.error('Generate route error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
