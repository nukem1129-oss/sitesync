// ============================================================
// SiteSync v2 — Section Generator Service
// Calls Claude once per section, returns typed content JSON
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { SectionType, Theme, SitePlan, PagePlan } from '@/types/site'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Site planner (homepage) ───────────────────────────────────
// Plans the full site structure including theme + all pages
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
    messages: [{ role: 'user', content: `Business: ${siteName}\nDescription: ${prompt}\n\nReturn the site plan JSON.` }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Site planner returned invalid JSON')
  return JSON.parse(jsonMatch[0]) as SitePlan
}

// ── Page planner (sub-pages) ──────────────────────────────────
// Plans sections for a specific sub-page — NOT the homepage
export async function planPage(
  siteName: string,
  businessDescription: string,
  pageName: string,
): Promise<PagePlan> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are planning sections for a website sub-page. Return ONLY a JSON array, no markdown.

Available section types for sub-pages:
- page-header: REQUIRED first section — clean page title banner (not a full hero)
- about: Detailed company/service story or description
- services: Grid of service cards with details
- features: Feature or benefit highlights (capabilities, what's included, why choose us)
- process: Step-by-step how-it-works or workflow breakdown
- team: Team member profiles
- testimonials: Client reviews and ratings
- faq: Frequently asked questions
- pricing: Pricing tiers or rate cards
- contact: Contact form with info
- gallery: Image/portfolio gallery

Rules:
- ALWAYS start with page-header
- Pick 3-5 total sections that make sense for this specific page
- Do NOT include "hero" (homepage only)
- Services page → page-header, services, process, faq, contact
- About page → page-header, about, team, features, contact
- Contact page → page-header, contact
- Training/Course page → page-header, features, process, faq, contact
- Portfolio page → page-header, gallery, testimonials, contact
- Pricing page → page-header, pricing, features, faq, contact

Return format: [{"type":"page-header","label":"Label"},{"type":"services","label":"Label"}]`,
    messages: [{
      role: 'user',
      content: `Plan the "${pageName}" page for "${siteName}" (${businessDescription}). Return a JSON array of sections.`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    // Fallback plan if AI fails
    return [
      { type: 'page-header', label: pageName },
      { type: 'features', label: `${pageName} Details` },
      { type: 'contact', label: 'Get In Touch' },
    ]
  }
  const plan = JSON.parse(jsonMatch[0]) as PagePlan
  // Ensure page-header is always first
  if (plan[0]?.type !== 'page-header') {
    plan.unshift({ type: 'page-header', label: pageName })
  }
  return plan
}

// ── Per-section content prompts ───────────────────────────────
function sectionPrompt(
  type: SectionType,
  siteName: string,
  pageContext: string,   // e.g. "Services page" or "homepage"
  theme: Theme
): string {
  const base = `Business: ${siteName}\nContext: ${pageContext}\nPrimary color: ${theme.primaryColor}\n\nReturn ONLY valid JSON, no markdown.`

  const shapes: Partial<Record<SectionType, string>> = {
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

    'page-header': `${base}
Generate a page header section JSON for the "${pageContext}":
{
  "heading": "Page Title (the page name, professional and clear)",
  "subheading": "1-2 sentence description of what this page covers",
  "backgroundValue": "linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)"
}`,

    about: `${base}
Generate about section JSON with detailed, page-specific content:
{
  "heading": "About [Business Name]",
  "body": "3-4 sentence paragraph — detailed, specific to this page context, not generic",
  "stats": [
    { "value": "10+", "label": "Years Experience" },
    { "value": "500+", "label": "Clients Served" },
    { "value": "98%", "label": "Satisfaction Rate" }
  ]
}`,

    services: `${base}
Generate services section JSON with 4-6 DETAILED services specific to this page context. Each service should have a meaningful description (2-3 sentences) not just 1 line:
{
  "heading": "Our Services",
  "subheading": "brief subheading",
  "services": [
    { "title": "Service Name", "description": "2-3 sentence detailed description of this specific service", "icon": "🔧", "price": "optional price or range" }
  ]
}`,

    features: `${base}
Generate a features/benefits section JSON with 4-6 specific, meaningful highlights for this page context:
{
  "heading": "What We Offer",
  "subheading": "optional supporting line",
  "features": [
    { "title": "Feature or Benefit Name", "description": "2 sentence explanation of why this matters", "icon": "✓" }
  ]
}`,

    process: `${base}
Generate a step-by-step process section JSON with 4-6 clear steps specific to this page context:
{
  "heading": "How It Works",
  "subheading": "optional line",
  "steps": [
    { "number": 1, "title": "Step Name", "description": "2 sentence description of what happens in this step" }
  ]
}`,

    team: `${base}
Generate team section JSON with 3-4 realistic team members relevant to this business:
{
  "heading": "Meet Our Team",
  "members": [
    { "name": "Full Name", "role": "Job Title", "bio": "1-2 sentence bio highlighting their expertise" }
  ]
}`,

    testimonials: `${base}
Generate testimonials section JSON with 3 specific, believable testimonials relevant to the services:
{
  "heading": "What Our Clients Say",
  "testimonials": [
    { "quote": "specific testimonial mentioning real results or experience (2-3 sentences)", "author": "Full Name", "role": "Job Title", "company": "Company Name", "rating": 5 }
  ]
}`,

    faq: `${base}
Generate an FAQ section JSON with 5-7 realistic questions people would ask about this specific page context:
{
  "heading": "Frequently Asked Questions",
  "faqs": [
    { "question": "Specific question someone would ask?", "answer": "Clear, helpful answer (2-3 sentences)." }
  ]
}`,

    pricing: `${base}
Generate a pricing section JSON with 2-4 tiers appropriate for this business:
{
  "heading": "Our Pricing",
  "subheading": "optional line about pricing",
  "tiers": [
    {
      "name": "Tier Name",
      "price": "$X/month or starting at $X",
      "description": "1 sentence about who this is for",
      "features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
      "cta": "Get Started",
      "highlighted": false
    }
  ]
}
Set highlighted: true on the recommended/most popular tier.`,

    contact: `${base}
Generate contact section JSON with form fields appropriate for this business and page context:
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
Available field types: text, email, tel, select (include options array with {value,label} objects), textarea, checkbox
Add fields specific to this business type and page context.`,

    gallery: `${base}
Generate gallery section JSON:
{
  "heading": "Our Work",
  "subheading": "optional",
  "images": []
}`,

    custom: `${base}
Generate a custom section. Return:
{ "html": "<div>...</div>", "description": "brief description" }`,
  }

  return shapes[type] || shapes.custom!
}

// ── Generate a single section ─────────────────────────────────
export async function generateSection(
  type: SectionType,
  label: string,
  siteName: string,
  pageContext: string,   // e.g. "Services page for TCRisk" or "homepage for TCRisk"
  theme: Theme
): Promise<{ content: Record<string, unknown>; sectionCss: string | null; sectionJs: string | null }> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: sectionPrompt(type, siteName, pageContext, theme) }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Section generator (${type}) returned invalid JSON`)
  }

  const content = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  return { content, sectionCss: null, sectionJs: null }
}
