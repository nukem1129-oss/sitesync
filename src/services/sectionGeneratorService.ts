// ============================================================
// SiteSync v2 — Section Generator Service
// Calls Claude once per section, returns typed content JSON
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { SitePlan, SectionPlan, ThemeConfig } from '@/types/site'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Quality system prompt used for ALL section generation ─────────
const COPY_SYSTEM = `You are a professional web copywriter creating content for a real business website.

Your writing must be:
- SPECIFIC: Use the actual business name, industry, and services — never generic placeholders
- DEEP: Go beyond surface-level. Include real details, processes, outcomes, and expertise
- UNIQUE: Each page covers a distinct angle. Never repeat what is already on the homepage
- HUMAN: Varied sentence length, natural voice, professional but approachable
- CREDIBLE: Specific numbers, timelines, certifications, and outcomes where appropriate
- COMPLETE: Fill every field fully — no empty strings, no "Lorem ipsum", no "Coming soon"

Return ONLY valid JSON matching the exact schema requested. No markdown fences, no explanation.`

// ── Site planner (homepage) ───────────────────────────────────────
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

// ── Page plan result ──────────────────────────────────────────────
export interface PagePlanResult {
  sections: SectionPlan[]
  rationale: string
}

// ── Page planner — AI reasons about any page name ─────────────────
export async function planPage(
  pageTitle: string,
  siteName: string,
  siteStyle: string,
  existingPageTitles: string[],
  homepageSectionTypes: string[],
): Promise<PagePlanResult> {
  const otherPages = existingPageTitles.length
    ? existingPageTitles.join(', ')
    : 'none yet'
  const homepageCovers = homepageSectionTypes.length
    ? homepageSectionTypes.join(', ')
    : 'hero, about, services, contact'

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a senior web designer planning a page layout. Think creatively and specifically about what sections would make this exact page feel purposeful, engaging, and cohesive with the site's style.

Consider:
- What does a visitor want to accomplish on a page with this title?
- What sections would a top design agency put here?
- How should this page complement — not repeat — the homepage?
- What story arc carries a visitor from the top of the page to a clear next step?

Return ONLY valid JSON — no markdown, no explanation.`,
    messages: [{
      role: 'user',
      content: `Plan sections for this page:

Site: "${siteName}"
Site style: ${siteStyle}
Page title: "${pageTitle}"
Homepage already covers: ${homepageCovers}
Other pages on site: ${otherPages}

Return JSON with this exact shape:
{
  "sections": [
    { "type": "page-header", "label": "Short, specific label for this section" },
    { "type": "...", "label": "..." }
  ],
  "rationale": "2-3 sentences explaining why these sections suit this specific page and how they create a coherent story for a visitor"
}

Rules:
- ALWAYS start with page-header as the first section
- NEVER include hero (homepage only)
- Choose 4-6 sections total that genuinely match what a visitor to a "${pageTitle}" page expects to find
- Think creatively — "My Pets" might use gallery + testimonials as owner stories; "Our Process" might use process + faq; "The Team" might use team + about
- Labels must be specific and human, not generic (e.g. "Meet Our Animal Patients" not "Gallery")
- Valid section types: page-header, about, services, team, testimonials, faq, pricing, contact, gallery, process`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return {
      sections: [
        { type: 'page-header', label: pageTitle },
        { type: 'features', label: `${pageTitle} Details` },
        { type: 'faq', label: 'Common Questions' },
        { type: 'contact', label: 'Get In Touch' },
      ],
      rationale: `A focused ${pageTitle} page for ${siteName}, guiding visitors from an overview through key details to a clear next step.`,
    }
  }

  const result = JSON.parse(jsonMatch[0]) as { sections?: SectionPlan[]; rationale?: string }
  const sections = result.sections ?? []

  // Ensure page-header is always first
  if (sections[0]?.type !== 'page-header') {
    sections.unshift({ type: 'page-header', label: pageTitle })
  }

  return {
    sections,
    rationale: result.rationale ?? `A purposeful ${pageTitle} page for ${siteName}.`,
  }
}

// ── Per-section content prompts ──────────────────────────────────
function sectionPrompt(
  type: string,
  siteName: string,
  pageContext: string,
  theme: ThemeConfig,
  homepageSummary: string,
): string {
  const avoidRepeat = homepageSummary
    ? `\n\nALREADY ON HOMEPAGE (do NOT repeat this): ${homepageSummary}\nThis page must go DEEPER and cover different angles than the homepage.`
    : ''

  const base = `Business: ${siteName}
Page context: ${pageContext}
Primary color: ${theme.primaryColor}${avoidRepeat}

Return ONLY valid JSON:`

  const shapes: Record<string, string> = {
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
  "heading": "Page title — specific and descriptive, not just the page name repeated verbatim",
  "subheading": "2 sentences: what this page covers and what the visitor will learn or get",
  "backgroundValue": "linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)"
}`,

    about: `${base}
Go DEEP — write about THIS specific aspect of the business described in the page context.
{
  "heading": "Specific heading relevant to this page context (not just 'About Us')",
  "body": "4-5 sentence paragraph with specific details: company history, approach, expertise, and what makes them different. Include founding story or key milestone. Real and specific, not generic.",
  "mission": "1-2 sentence mission or philosophy statement",
  "stats": [
    { "value": "X+", "label": "Specific meaningful metric" },
    { "value": "X%", "label": "Specific outcome metric" },
    { "value": "X+", "label": "Another meaningful metric" }
  ]
}`,

    services: `${base}
Each service needs DEEP detail — this is a services page, not a homepage overview. Cover 4-6 services.
{
  "heading": "Services heading specific to this page context",
  "subheading": "1-2 sentences about your overall approach or what clients get",
  "intro": "Full introductory paragraph (3-4 sentences) about these services, the problems they solve, and who they're for",
  "services": [
    {
      "title": "Specific Service Name",
      "description": "3-4 sentence detailed description. Explain the process, what's involved, outcomes clients get, and why this service matters. Be specific to the industry.",
      "icon": "relevant emoji",
      "includes": ["Specific deliverable 1", "Specific deliverable 2", "Specific deliverable 3"],
      "idealFor": "One sentence about who this service is for",
      "price": "Starting at $X or $X-$Y range (realistic for the industry)"
    }
  ]
}`,

    features: `${base}
Real differentiators or capabilities — specific to this page context, not generic benefits.
{
  "heading": "Specific heading (e.g. 'What Sets Our Training Apart' not just 'Features')",
  "subheading": "1-2 sentences framing these advantages",
  "intro": "3-sentence paragraph introducing these features in context",
  "features": [
    {
      "title": "Specific capability or differentiator name",
      "description": "2-3 sentences explaining WHY this matters and HOW it benefits the client. Specific, not generic.",
      "icon": "relevant emoji"
    }
  ]
}
Include 5-6 features that are genuinely specific to this business and page context.`,

    process: `${base}
Real step-by-step process — specific to this business and page context. Their actual methodology.
{
  "heading": "How We [Do This Thing] — use a specific verb phrase",
  "subheading": "1-2 sentences framing the process",
  "intro": "2-3 sentence paragraph explaining the philosophy behind this process and why it works",
  "steps": [
    {
      "title": "Step name — action-oriented",
      "description": "2-3 sentences describing what happens, what the client does, and the outcome. Include realistic timeline if appropriate."
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
      "bio": "2-3 sentence bio: years of experience, specific expertise/certifications, and a concrete achievement or specialty"
    }
  ]
}`,

    testimonials: `${base}
Specific, believable client testimonials — mention actual results, timelines, and outcomes. NOT generic praise.
{
  "heading": "What Our Clients Say",
  "subheading": "Real results from real clients",
  "testimonials": [
    {
      "quote": "3-4 sentence quote mentioning: specific problem they had, what the business did, and the concrete result (e.g. passed inspection, reduced incidents by X%, saved $X). Should sound like a real person.",
      "author": "Full Name",
      "role": "Job Title",
      "company": "Company Name (industry-appropriate)",
      "rating": 5
    }
  ]
}
Include 3 testimonials. Each must reference specific outcomes, not just generic praise.`,

    faq: `${base}
REAL questions people ask about this specific topic. Detailed, helpful answers — not one-liners.
{
  "heading": "Frequently Asked Questions",
  "subheading": "Straight answers to the questions we hear most",
  "faqs": [
    {
      "question": "A specific question someone would actually Google or ask in a consultation",
      "answer": "3-4 sentence thorough answer. Address the concern fully with specifics (timelines, costs, process, regulations if relevant). Should feel like expert advice."
    }
  ]
}
Include 6-7 FAQs covering: cost/pricing, timeline, process, qualifications, compliance/legal if relevant, what makes them different.`,

    pricing: `${base}
Realistic pricing tiers for this business. Include what's in each tier and who it's for.
{
  "heading": "Investment & Pricing",
  "subheading": "Transparent pricing with no surprises",
  "tiers": [
    {
      "name": "Tier name",
      "price": "Realistic price for the industry",
      "period": "/month or /project or /person",
      "description": "1-2 sentences about who this tier is for",
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
Include 3 tiers. Set featured: true on the middle tier. Set badge: "Most Popular" on that tier.`,

    contact: `${base}
Contact form with fields relevant to this business and page context.
{
  "heading": "Get In Touch",
  "subheading": "1-2 sentences making it easy to reach out. Mention response time if known.",
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
{
  "heading": "Our Work",
  "subheading": "A sample of recent projects and results",
  "images": []
}`,

    custom: `${base}
{ "html": "<section style=\\"padding:4rem 1.5rem;text-align:center;\\"><h2>Section</h2></section>", "description": "custom section" }`,
  }

  return shapes[type] ?? shapes['custom']!
}

// ── Generate a single section ─────────────────────────────────────
export async function generateSection(
  type: string,
  label: string,
  siteName: string,
  pageContext: string,
  theme: ThemeConfig,
  homepageSummary = '',
): Promise<{ content: Record<string, unknown>; sectionCss: string | null; sectionJs: string | null }> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: COPY_SYSTEM,
    messages: [{ role: 'user', content: sectionPrompt(type, siteName, pageContext, theme, homepageSummary) }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  // Extract first complete JSON object or array
  const jsonMatch = text.match(/[\[\{][\s\S]*[\]\}]/)
  if (!jsonMatch) throw new Error(`Section generator (${type}) returned invalid JSON`)
  const content = JSON.parse(jsonMatch[0]) as Record<string, unknown>

  return { content, sectionCss: null, sectionJs: null }
}
