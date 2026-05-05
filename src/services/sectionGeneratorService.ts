// ============================================================
// SiteSync v2 — Section Generator Service
// Calls Claude once per section, returns typed content JSON
// ============================================================
import Anthropic from '@anthropic-ai/sdk'
import type { SectionType, Theme, SitePlan, PagePlan } from '@/types/site'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Quality system prompt used for ALL section generation ─────
const COPY_SYSTEM = `You are a professional web copywriter creating content for a real business website.

Your writing must be:
- SPECIFIC: Use the actual business name, industry, and services — never generic placeholders
- DEEP: Go beyond surface-level. Include real details, processes, outcomes, and expertise
- UNIQUE: Each page covers a distinct angle. Never repeat what is already on the homepage
- HUMAN: Varied sentence length, natural voice, professional but approachable
- CREDIBLE: Specific numbers, timelines, certifications, and outcomes where appropriate
- COMPLETE: Fill every field fully — no empty strings, no "Lorem ipsum", no "Coming soon"

Return ONLY valid JSON matching the exact schema requested. No markdown fences, no explanation.`

// ── Site planner (homepage) ───────────────────────────────────
export async function planSite(siteName: string, prompt: string): Promise<SitePlan> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are a web design planner. Return valid JSON matching this shape exactly — no markdown, no explanation:
{
  "theme": {
    "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex",
    "backgroundColor": "#hex", "textColor": "#hex",
    "fontFamily": "'Font Name', sans-serif", "headingFont": "'Font Name', sans-serif",
    "borderRadius": "Npx"
  },
  "pages": [
    {
      "slug": "home", "title": "Home", "navLabel": "Home", "isHomepage": true,
      "sections": [
        { "type": "hero", "label": "Hero" },
        { "type": "about", "label": "About Us" },
        { "type": "services", "label": "Our Services" },
        { "type": "contact", "label": "Contact" }
      ]
    }
  ]
}
Section types: hero, about, services, team, testimonials, contact
Rules: always include hero + contact on home page. Use Google Fonts matching brand personality.
borderRadius: "4px" corporate, "12px" friendly/modern, "0px" minimal`,
    messages: [{ role: 'user', content: `Business: ${siteName}\nDescription: ${prompt}\n\nReturn site plan JSON.` }]
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Site planner returned invalid JSON')
  return JSON.parse(jsonMatch[0]) as SitePlan
}

// ── Page planner (sub-pages) ──────────────────────────────────
export async function planPage(
  siteName: string,
  businessDescription: string,
  pageName: string,
): Promise<PagePlan> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You plan sections for a website sub-page. Return ONLY a JSON array — no markdown.

Available section types for sub-pages:
- page-header: REQUIRED first section — page title + subtitle banner
- services: Detailed service cards — deep descriptions, what's included, pricing
- features: Key capabilities, differentiators, or benefits specific to this page
- process: Step-by-step workflow, methodology, or how-it-works breakdown
- team: Team or specialist profiles relevant to this page topic
- testimonials: Client results and reviews specific to this service/topic
- faq: Frequently asked questions specific to this page — detailed real answers
- pricing: Pricing tiers or rate schedule
- contact: Contact form with fields relevant to this page
- about: Detailed story, mission, or background section

Rules:
- ALWAYS start with page-header
- Pick 4-5 sections that make real sense for THIS specific page — not generic ones
- NEVER include "hero" (homepage only)
- Services/solutions pages → page-header, services, process, testimonials, faq, contact
- About/company pages → page-header, about, team, features, contact
- Training/education pages → page-header, features, process, pricing, faq, contact
- Contact pages → page-header, contact
- Portfolio/work pages → page-header, testimonials, faq, contact

Return: [{"type":"page-header","label":"Label"},{"type":"services","label":"Label"}]`,
    messages: [{ role: 'user', content: `Plan the "${pageName}" page for "${siteName}" — ${businessDescription}. Return JSON array.` }]
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    return [
      { type: 'page-header', label: pageName },
      { type: 'features', label: `${pageName} Details` },
      { type: 'faq', label: 'Common Questions' },
      { type: 'contact', label: 'Get In Touch' },
    ]
  }
  const plan = JSON.parse(jsonMatch[0]) as PagePlan
  if (plan[0]?.type !== 'page-header') plan.unshift({ type: 'page-header', label: pageName })
  return plan
}

// ── Per-section content prompts ───────────────────────────────
function sectionPrompt(
  type: SectionType,
  siteName: string,
  pageContext: string,
  theme: Theme,
  homepageSummary: string,
): string {
  const avoidRepeat = homepageSummary
    ? `\n\nALREADY ON HOMEPAGE (do NOT repeat this): ${homepageSummary}\nThis page must go DEEPER and cover different angles than the homepage.`
    : ''

  const base = `Business: ${siteName}
Page context: ${pageContext}
Primary color: ${theme.primaryColor}${avoidRepeat}

Return ONLY valid JSON:`

  const shapes: Partial<Record<SectionType, string>> = {
    hero: `${base}
{
  "headline": "8-word max compelling headline — specific to this business",
  "subheadline": "2-sentence supporting line with specific value proposition",
  "ctaText": "Action-oriented button text",
  "ctaLink": "#contact",
  "backgroundType": "gradient",
  "backgroundValue": "linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)"
}`,

    'page-header': `${base}
{
  "heading": "Page title — specific and descriptive (not just the page name repeated)",
  "subheading": "2 sentences: what this page covers and what the visitor will learn or get",
  "backgroundValue": "linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)"
}`,

    about: `${base}
Go DEEP — this is not a generic about section. Write about THIS specific aspect of the business context.
{
  "heading": "Specific heading relevant to this page (not just 'About Us')",
  "body": "4-5 sentence paragraph — specific details about the company's history, approach, expertise, and what makes them different in this area. Include founding story or key milestone if relevant. Real, specific, not generic.",
  "mission": "1-2 sentence mission or philosophy statement",
  "stats": [
    { "value": "X+", "label": "Specific meaningful metric" },
    { "value": "X%", "label": "Specific outcome metric" },
    { "value": "X+", "label": "Another meaningful metric" }
  ]
}`,

    services: `${base}
Each service needs DEEP detail — this is a services PAGE, not a homepage overview. Cover 4-6 services with full descriptions.
{
  "heading": "Services heading specific to this page context",
  "subheading": "1-2 sentences about your overall approach or what clients get",
  "intro": "Full introductory paragraph (3-4 sentences) about these services, the problems they solve, and who they're for",
  "services": [
    {
      "title": "Specific Service Name",
      "description": "3-4 sentence detailed description. Explain the process, what's involved, the outcomes clients get, and why this service matters. Be specific to the industry.",
      "icon": "relevant emoji",
      "includes": ["Specific deliverable 1", "Specific deliverable 2", "Specific deliverable 3"],
      "idealFor": "One sentence about who this service is for",
      "price": "Starting at $X or $X-$Y range (realistic for the industry)"
    }
  ]
}`,

    features: `${base}
These should be real differentiators or capabilities — specific to this page context, not generic benefits.
{
  "heading": "Specific heading (e.g. 'What Sets Our Training Apart' not just 'Features')",
  "subheading": "1-2 sentences framing these advantages",
  "intro": "3 sentence paragraph introducing these features in context",
  "features": [
    {
      "title": "Specific capability or differentiator name",
      "description": "2-3 sentence explanation of WHY this matters and HOW it benefits the client. Be specific, not generic.",
      "icon": "relevant emoji"
    }
  ]
}
Include 5-6 features that are genuinely specific to this business and page context.`,

    process: `${base}
Real step-by-step process — specific to this business and page context. Should feel like their actual methodology.
{
  "heading": "How We [Do This Thing] — specific verb phrase",
  "subheading": "1-2 sentences framing the process",
  "intro": "2-3 sentence paragraph explaining the philosophy behind this process and why it works",
  "steps": [
    {
      "title": "Step name — action-oriented",
      "description": "2-3 sentence description of what happens, what the client does, and what the outcome is. Include realistic timeline if appropriate."
    }
  ]
}
Include 4-6 steps. Each should feel like a real workflow, not generic phases.`,

    team: `${base}
Real team members relevant to this business. Create 3-4 credible professionals with specific expertise.
{
  "heading": "Meet the [Team/Specialists/Experts] — specific to this business",
  "subheading": "1-2 sentences about the team's collective expertise",
  "members": [
    {
      "name": "Full Name (realistic for this industry/region)",
      "role": "Specific job title relevant to this business",
      "bio": "2-3 sentence bio highlighting: years of experience, specific expertise/certifications, and a concrete achievement or specialty"
    }
  ]
}`,

    testimonials: `${base}
Specific, believable client testimonials — mention actual results, timelines, and outcomes. NOT generic praise.
{
  "heading": "What Our Clients Say About [Specific Service/Topic]",
  "subheading": "Optional: a brief framing line about client outcomes",
  "testimonials": [
    {
      "quote": "3-4 sentence quote mentioning: specific problem they had, what TCRisk/the business did, the concrete result (e.g. passed inspection, reduced incidents by X%, saved $X). Should sound like a real person talking.",
      "author": "Full Name",
      "role": "Job Title",
      "company": "Company Name (industry-appropriate)",
      "rating": 5
    }
  ]
}
Include 3 testimonials. Each must reference specific outcomes, not just praise.`,

    faq: `${base}
REAL questions people ask about this specific service/page topic. Detailed, helpful answers — not one-liners.
{
  "heading": "Frequently Asked Questions",
  "subheading": "Optional framing line",
  "faqs": [
    {
      "question": "A specific question someone would actually Google or ask in a consultation",
      "answer": "3-4 sentence thorough answer. Address the concern fully, include specifics (timelines, costs, process details, regulations if relevant). Should feel like advice from an expert."
    }
  ]
}
Include 6-7 FAQs covering: cost/pricing, timeline, process, qualifications, compliance/legal if relevant, what makes them different.`,

    pricing: `${base}
Realistic pricing tiers for this business. Include what's in each tier and who it's for.
{
  "heading": "Investment & Pricing",
  "subheading": "1-2 sentence about pricing philosophy (transparent, custom, etc.)",
  "tiers": [
    {
      "name": "Tier name",
      "price": "Realistic price for the industry",
      "period": "/month or /project or /person",
      "description": "1-2 sentences about who this tier is for and what situation it fits",
      "features": [
        "Specific deliverable or inclusion",
        "Specific deliverable or inclusion",
        "Specific deliverable or inclusion",
        "Specific deliverable or inclusion",
        "Specific deliverable or inclusion"
      ],
      "ctaText": "Get Started",
      "ctaLink": "#contact",
      "featured": false,
      "badge": null
    }
  ]
}
Include 3 tiers. Set featured: true on the middle/recommended tier. Set badge: "Most Popular" on that tier.`,

    contact: `${base}
Contact form with fields relevant to this business and page context.
{
  "heading": "Get In Touch",
  "subheading": "1-2 sentences making it easy and inviting to reach out. Mention response time if known.",
  "email": "info@${siteName.toLowerCase().replace(/\s+/g, '')}.com",
  "phone": "(555) 000-0000",
  "address": "City, State (relevant to the business)",
  "submitLabel": "Action-specific button text (e.g. 'Request a Free Assessment')",
  "responseTime": "We respond within 1 business day.",
  "formFields": [
    { "type": "text", "name": "name", "label": "Full Name", "placeholder": "John Smith", "required": true },
    { "type": "email", "name": "email", "label": "Email Address", "placeholder": "john@company.com", "required": true },
    { "type": "tel", "name": "phone", "label": "Phone Number", "placeholder": "(555) 000-0000", "required": false },
    { "type": "select", "name": "service", "label": "Service of Interest", "required": true, "options": [
      { "value": "", "label": "Select a service..." }
    ]},
    { "type": "textarea", "name": "message", "label": "Tell us about your needs", "placeholder": "Describe your situation, timeline, and what you're hoping to achieve...", "required": true }
  ]
}
Add 1-2 more fields specific to this industry (e.g. company size, number of employees, location, project type).`,

    gallery: `${base}
{ "heading": "Our Work", "subheading": "A sample of recent projects and results", "images": [] }`,

    custom: `${base}
{ "html": "<section style=\"padding:4rem 1.5rem;text-align:center;\"><h2>Section</h2></section>", "description": "custom section" }`,
  }

  return shapes[type] || shapes.custom!
}

// ── Generate a single section ─────────────────────────────────
export async function generateSection(
  type: SectionType,
  label: string,
  siteName: string,
  pageContext: string,
  theme: Theme,
  homepageSummary = '',
): Promise<{ content: Record<string, unknown>; sectionCss: string | null; sectionJs: string | null }> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: COPY_SYSTEM,
    messages: [{
      role: 'user',
      content: sectionPrompt(type, siteName, pageContext, theme, homepageSummary)
    }]
  })
  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  // Extract first complete JSON object or array
  const jsonMatch = text.match(/[\[\{][\s\S]*[\]\}]/)
  if (!jsonMatch) throw new Error(`Section generator (${type}) returned invalid JSON`)
  const content = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  return { content, sectionCss: null, sectionJs: null }
}
