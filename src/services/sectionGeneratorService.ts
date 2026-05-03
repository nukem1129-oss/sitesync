// ============================================================
// SiteSync v2 — Section Generator Service
// Calls Claude once per section, returns typed content JSON
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { SectionType, Theme, SitePlan } from '@/types/site'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Site planner ─────────────────────────────────────────────
// First call: decide which sections to build + theme colors/fonts
export async function planSite(
  siteName: string,
  prompt: string
): Promise<SitePlan> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are a web design planner. Given a business description, return a JSON site plan.
Always return valid JSON matching this exact shape — no markdown, no explanation, just JSON:
{
  "theme": {
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "accentColor": "#hex",
    "backgroundColor": "#hex",
    "textColor": "#hex",
    "fontFamily": "'Font Name', sans-serif",
    "headingFont": "'Font Name', sans-serif",
    "borderRadius": "Npx"
  },
  "pages": [
    {
      "slug": "home",
      "title": "Home",
      "navLabel": "Home",
      "isHomepage": true,
      "sections": [
        { "type": "hero", "label": "Hero" },
        { "type": "about", "label": "About Us" },
        { "type": "services", "label": "Our Services" },
        { "type": "contact", "label": "Contact" }
      ]
    }
  ]
}

Section types available: hero, about, services, team, testimonials, contact
Rules:
- Always include hero and contact sections on the home page
- Only add team/testimonials if they make sense for the business
- Use Google Fonts that match the brand personality
- Choose cohesive, professional color palettes
- borderRadius: "4px" for corporate, "12px" for friendly/modern, "0px" for minimal`,

    messages: [{
      role: 'user',
      content: `Business: ${siteName}\nDescription: ${prompt}\n\nReturn the site plan JSON.`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Site planner returned invalid JSON')

  return JSON.parse(jsonMatch[0]) as SitePlan
}

// ── Per-section content prompts ───────────────────────────────
function sectionPrompt(
  type: SectionType,
  siteName: string,
  businessPrompt: string,
  theme: Theme
): string {
  const base = `Business: ${siteName}\nDescription: ${businessPrompt}\nPrimary color: ${theme.primaryColor}\n\nReturn ONLY valid JSON, no markdown.`

  const shapes: Record<SectionType, string> = {
    hero: `${base}
Generate hero section JSON:
{
  "headline": "compelling headline (max 8 words)",
  "subheadline": "supporting line (1-2 sentences)",
  "ctaText": "button text",
  "ctaLink": "#contact",
  "backgroundType": "gradient",
  "backgroundValue": "linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)"
}`,

    about: `${base}
Generate about section JSON:
{
  "heading": "About [Business Name]",
  "body": "2-3 sentence paragraph about the business",
  "stats": [
    { "value": "10+", "label": "Years Experience" },
    { "value": "500+", "label": "Happy Clients" },
    { "value": "98%", "label": "Satisfaction Rate" }
  ]
}`,

    services: `${base}
Generate services section JSON with 3-5 services:
{
  "heading": "Our Services",
  "subheading": "optional subheading",
  "services": [
    { "title": "Service Name", "description": "1-2 sentence description", "icon": "🔧", "price": "optional price" }
  ]
}`,

    team: `${base}
Generate team section JSON with 3-4 members:
{
  "heading": "Meet Our Team",
  "members": [
    { "name": "Full Name", "role": "Job Title", "bio": "1 sentence bio" }
  ]
}`,

    testimonials: `${base}
Generate testimonials section JSON with 3 testimonials:
{
  "heading": "What Our Clients Say",
  "testimonials": [
    { "quote": "testimonial text", "author": "Full Name", "role": "Job Title", "company": "Company Name", "rating": 5 }
  ]
}`,

    contact: `${base}
Generate contact section JSON with appropriate form fields for this business:
{
  "heading": "Get In Touch",
  "subheading": "optional subheading",
  "email": "info@example.com",
  "phone": "optional phone",
  "address": "optional address",
  "submitLabel": "Send Message",
  "formFields": [
    { "type": "text", "name": "name", "label": "Full Name", "placeholder": "John Smith", "required": true },
    { "type": "email", "name": "email", "label": "Email Address", "placeholder": "john@example.com", "required": true },
    { "type": "textarea", "name": "message", "label": "Message", "placeholder": "How can we help?", "required": true }
  ]
}
Available field types: text, email, tel, select (include options array), textarea, checkbox, signature
Add fields that make sense for this specific business type.`,

    gallery: `${base}
Generate gallery section JSON:
{
  "heading": "Our Work",
  "images": []
}`,

    custom: `${base}
Generate a custom HTML section for this business. Return:
{
  "html": "<div>...</div>",
  "description": "brief description"
}`,
  }

  return shapes[type] || shapes.custom
}

// ── Generate a single section ─────────────────────────────────
export async function generateSection(
  type: SectionType,
  label: string,
  siteName: string,
  businessPrompt: string,
  theme: Theme
): Promise<{ content: Record<string, unknown>; sectionCss: string | null; sectionJs: string | null }> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: sectionPrompt(type, siteName, businessPrompt, theme)
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Section generator (${type}) returned invalid JSON`)
  }

  const content = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  return { content, sectionCss: null, sectionJs: null }
}
