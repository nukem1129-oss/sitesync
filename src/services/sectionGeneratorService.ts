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
- CLEAN: Write tight, direct sentences. Never use em dashes (—), en dashes (–), or spaced hyphens ( - ) as separators. Never insert parenthetical asides mid-sentence. If extra context is needed, start a new sentence instead.

Return ONLY valid JSON matching the exact schema requested. No markdown fences, no explanation.`

// ── Layout options per section type — randomly picked at generation time ─
export const LAYOUT_OPTIONS: Record<string, string[]> = {
  hero:         ['centered', 'left-text', 'minimal', 'bold-impact'],
  about:        ['split-stats', 'mission-first', 'narrative', 'timeline', 'numbers-hero', 'icon-pillars'],
  services:     ['card-grid', 'icon-rows', 'showcase', 'accordion', 'feature-strip'],
  features:     ['card-grid', 'icon-left-rows', 'bold-list'],
  team:         ['card-grid', 'horizontal-bio', 'featured-lead', 'minimal-list'],
  testimonials: ['card-grid', 'featured-quote', 'dark-band', 'stacked'],
  process:      ['numbered-rows', 'cards-horizontal', 'diagonal-steps'],
  faq:          ['accordion', 'two-column', 'numbered'],
}

export function pickRandomLayout(type: string, usedLayouts?: Set<string>): string | null {
  const options = LAYOUT_OPTIONS[type]
  if (!options?.length) return null

  // Prefer layouts not already used elsewhere on this page
  if (usedLayouts?.size) {
    const fresh = options.filter(l => !usedLayouts.has(l))
    if (fresh.length) return fresh[Math.floor(Math.random() * fresh.length)]
  }

  return options[Math.floor(Math.random() * options.length)]
}

// ── Site planner (homepage) ───────────────────────────────────────
export async function planSite(siteName: string, prompt: string, existingContent = ''): Promise<SitePlan> {
  const contentBlock = existingContent
    ? `\n\nREAL CONTENT FROM CLIENT'S EXISTING WEBSITE — use brand colors, tone, and page structure that match this:\n${existingContent.slice(0, 2000)}\n`
    : ''

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `You are a web design planner. Return valid JSON matching this shape exactly — no markdown, no explanation:
{
  "theme": {
    "primaryColor": "#hex", "secondaryColor": "#hex", "accentColor": "#hex",
    "backgroundColor": "#hex", "textColor": "#hex",
    "fontFamily": "'Font Name', sans-serif", "headingFont": "'Font Name', sans-serif",
    "borderRadius": "Npx"
  },
  "heroImageQuery": "3-5 comma-separated visual keywords for a stock photo search that would produce a beautiful, relevant hero background for this business (e.g. 'veterinary clinic animals pets' or 'landscaping garden lawn outdoor' or 'restaurant kitchen cooking food' or 'construction workers building site' or 'law office professional attorney')",
  "pages": [
    {
      "slug": "home", "title": "Home", "navLabel": "Home", "isHomepage": true,
      "sections": [
        { "type": "hero", "label": "Hero" },
        { "type": "about", "label": "About Us" },
        { "type": "services", "label": "Our Services" },
        { "type": "contact", "label": "Contact" }
      ]
    },
    { "slug": "about", "title": "About", "navLabel": "About", "isHomepage": false, "sections": [] },
    { "slug": "services", "title": "Services", "navLabel": "Services", "isHomepage": false, "sections": [] }
  ]
}

Available section types for homepage: hero, about, services, features, team, testimonials, process, faq, pricing, gallery, contact

Rules:
- Always start with hero and end with contact.
- Pick 4-6 sections BETWEEN hero and contact that genuinely fit this specific business — think like a designer, not a template.
- NOT every site needs about+services+testimonials. A restaurant might do: hero → gallery → menu/pricing → process (how to book) → contact. A law firm might do: hero → features (practice areas) → process (how we work) → team → testimonials → contact. A gym: hero → services → pricing → testimonials → faq → contact.
- Vary the selection based on what would actually help a potential customer make a decision for THIS type of business.
- Include 2-4 additional pages beyond homepage. Non-homepage pages have empty sections arrays.
- Use Google Fonts matching brand personality.
- borderRadius: "4px" corporate, "12px" friendly/modern, "0px" minimal
- heroImageQuery: pick vivid, photogenic keywords — prioritize what the BUSINESS LOOKS LIKE in real life, not abstract concepts`,
    messages: [{ role: 'user', content: `Business: ${siteName}\nDescription: ${prompt}${contentBlock}\nReturn site plan JSON.` }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error('planSite: No JSON found in response. Full text:', text)
    throw new Error('Site planner returned invalid JSON')
  }
  try {
    return JSON.parse(jsonMatch[0]) as SitePlan
  } catch (parseErr) {
    console.error('planSite: JSON.parse failed. Matched text:', jsonMatch[0].slice(0, 500))
    throw parseErr
  }
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

// ── Layout-specific schema helpers ────────────────────────────────

function aboutSchema(layout: string, base: string): string {
  const schemas: Record<string, string> = {
    'split-stats': `${base}
Use layout "split-stats" — two columns: bold stats panel left, text right.
{
  "layout": "split-stats",
  "heading": "Specific heading (not just 'About Us')",
  "body": "4-5 sentences: company history, founding story or key milestone, approach, what makes them different. Real and specific.",
  "mission": "1-2 sentence core philosophy (optional)",
  "stats": [
    { "value": "X+", "label": "Years in Business or similar milestone" },
    { "value": "XXX+", "label": "Clients Served or projects completed" },
    { "value": "X%", "label": "Satisfaction rate or another outcome metric" }
  ]
}
Make stat values and labels realistic and specific to this industry.`,

    'mission-first': `${base}
Use layout "mission-first" — centered mission statement with 3 value pillars below.
{
  "layout": "mission-first",
  "heading": "Specific heading",
  "mission": "1-2 sentence mission statement or guiding philosophy — the WHY behind this business",
  "body": "3-4 sentence paragraph about the company background and approach",
  "values": [
    { "title": "Core Value Name", "description": "2 sentences explaining what this means in practice for clients" },
    { "title": "Core Value Name", "description": "2 sentences explaining what this means in practice for clients" },
    { "title": "Core Value Name", "description": "2 sentences explaining what this means in practice for clients" }
  ]
}`,

    'narrative': `${base}
Use layout "narrative" — immersive full-width storytelling layout.
{
  "layout": "narrative",
  "heading": "Story-driven heading (e.g. 'How We Got Here' or 'Built From the Ground Up')",
  "body": "5-7 sentence narrative. Tell the founding story: who started it, the problem they saw, how they built the solution, challenges overcome, and what they have achieved. Write as a compelling story — not a corporate bio.",
  "mission": "1 sentence mission (optional)"
}`,

    'timeline': `${base}
Use layout "timeline" — vertical chronological milestones.
{
  "layout": "timeline",
  "heading": "Specific heading about company history (e.g. 'Our Journey' or 'Two Decades of Excellence')",
  "subheading": "1-2 sentences about this business's growth arc",
  "milestones": [
    { "year": "YYYY", "title": "Specific milestone (e.g. 'Founded in Downtown Austin')", "description": "2-3 sentences about this milestone and its significance to the company" },
    { "year": "YYYY", "title": "Growth milestone", "description": "2-3 sentences" },
    { "year": "YYYY", "title": "Expansion or achievement milestone", "description": "2-3 sentences" },
    { "year": "YYYY", "title": "Recent focus or current chapter", "description": "2-3 sentences" }
  ]
}
Use realistic years spread across the company's history. Each milestone must feel real and significant.`,

    'numbers-hero': `${base}
Use layout "numbers-hero" — bold numbers on dark background, data-forward presentation.
{
  "layout": "numbers-hero",
  "heading": "Specific heading",
  "subheading": "1-2 sentences",
  "body": "3-4 sentence description of the company and what they do",
  "stats": [
    { "value": "500+", "label": "Specific outcome metric (e.g. 'Projects Completed')" },
    { "value": "15", "label": "Years of Experience" },
    { "value": "98%", "label": "Client Satisfaction Rate or similar" },
    { "value": "24/7", "label": "Availability or another impactful operational metric" }
  ]
}
Make stats bold, specific, and realistic for this industry.`,

    'icon-pillars': `${base}
Use layout "icon-pillars" — grid of pillars each with an emoji icon, title, and description.
{
  "layout": "icon-pillars",
  "heading": "Specific heading (e.g. 'What Drives Us' or 'Our Approach to Excellence')",
  "subheading": "1-2 sentences",
  "pillars": [
    { "icon": "🎯", "title": "Pillar Name", "description": "2-3 sentences describing this value or capability and what it means for clients" },
    { "icon": "🔬", "title": "Pillar Name", "description": "2-3 sentences" },
    { "icon": "🤝", "title": "Pillar Name", "description": "2-3 sentences" },
    { "icon": "🏆", "title": "Pillar Name", "description": "2-3 sentences" }
  ]
}
Choose 4-6 pillars. Pick relevant emojis that match the industry and each pillar's meaning.`,
  }
  return schemas[layout] ?? schemas['split-stats']!
}

function servicesSchema(layout: string, base: string): string {
  const schemas: Record<string, string> = {
    'card-grid': `${base}
Use layout "card-grid" — clean 3-column card grid.
{
  "layout": "card-grid",
  "heading": "Services heading specific to this context",
  "subheading": "1-2 sentences about your overall approach",
  "services": [
    {
      "title": "Specific Service Name",
      "description": "3-4 sentence description: what it is, the process, outcomes, and why it matters.",
      "price": "Starting at $X or $X-$Y range (realistic for the industry)"
    }
  ]
}
Include 4-6 services.`,

    'icon-rows': `${base}
Use layout "icon-rows" — numbered rows with detailed descriptions and included items.
{
  "layout": "icon-rows",
  "heading": "Services heading specific to this context",
  "subheading": "1-2 sentences about your overall approach",
  "services": [
    {
      "title": "Specific Service Name",
      "description": "3-4 sentence description: process, what is involved, outcomes, why it matters.",
      "includes": ["Specific deliverable 1", "Specific deliverable 2", "Specific deliverable 3"],
      "price": "Starting at $X or $X-$Y range"
    }
  ]
}
Include 4-6 services. Each must have 3-4 specific includes.`,

    'showcase': `${base}
Use layout "showcase" — alternating large feature blocks for premium services.
{
  "layout": "showcase",
  "heading": "Services heading specific to this context",
  "subheading": "1-2 sentences about your signature approach",
  "services": [
    {
      "title": "Signature Service Name",
      "description": "4-5 sentence description: what makes this service premium, the full process, and the concrete outcomes clients achieve.",
      "includes": ["Key deliverable 1", "Key deliverable 2", "Key deliverable 3", "Key deliverable 4"],
      "price": "Starting at $X or $X-$Y range"
    }
  ]
}
Include 3-4 signature services. These should be the most premium, detailed offerings.`,

    'accordion': `${base}
Use layout "accordion" — expandable service list, great for businesses with many offerings.
{
  "layout": "accordion",
  "heading": "Services heading specific to this context",
  "subheading": "1-2 sentences about your overall approach",
  "services": [
    {
      "title": "Specific Service Name",
      "description": "3-4 sentence description: process, scope, timeline, and outcomes.",
      "includes": ["Specific deliverable 1", "Specific deliverable 2", "Specific deliverable 3"],
      "price": "Starting at $X or $X-$Y range (realistic for the industry)"
    }
  ]
}
Include 5-7 services. The accordion layout handles more items cleanly.`,

    'feature-strip': `${base}
Use layout "feature-strip" — full-width strips with a colored accent bar, clean and scannable.
{
  "layout": "feature-strip",
  "heading": "Services heading specific to this context",
  "subheading": "1-2 sentences about your overall approach",
  "services": [
    {
      "title": "Specific Service Name",
      "description": "2-3 sentence description: what it includes and the key outcome.",
      "price": "Starting at $X or $X-$Y range"
    }
  ]
}
Include 4-6 services.`,
  }
  return schemas[layout] ?? schemas['card-grid']!
}

// ── Per-section content prompts ──────────────────────────────────
function sectionPrompt(
  type: string,
  siteName: string,
  pageContext: string,
  theme: ThemeConfig,
  homepageSummary: string,
  layout?: string | null,
): string {
  const avoidRepeat = homepageSummary
    ? `\n\nALREADY ON HOMEPAGE (do NOT repeat this): ${homepageSummary}\nThis page must go DEEPER and cover different angles than the homepage.`
    : ''

  const base = `Business: ${siteName}
Page context: ${pageContext}
Primary color: ${theme.primaryColor}${avoidRepeat}

Return ONLY valid JSON:`

  const ly = layout ?? ''

  const shapes: Record<string, string> = {
    hero: `${base}
{
  "layout": "${ly || 'centered'}",
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

    about: aboutSchema(ly || 'split-stats', base),

    services: servicesSchema(ly || 'card-grid', base),

    features: `${base}
Real differentiators or capabilities — specific to this page context, not generic benefits.
{
  "layout": "${ly || 'card-grid'}",
  "heading": "Specific heading (e.g. 'What Sets Our Training Apart' not just 'Features')",
  "subheading": "1-2 sentences framing these advantages",
  "features": [
    {
      "title": "Specific capability or differentiator name",
      "description": "2-3 sentences explaining WHY this matters and HOW it benefits the client. Specific, not generic."
    }
  ]
}
Include 5-6 features genuinely specific to this business and page context.`,

    process: `${base}
Real step-by-step process — specific to this business and page context. Their actual methodology.
{
  "layout": "${ly || 'numbered-rows'}",
  "heading": "How We [Do This Thing] — use a specific verb phrase",
  "subheading": "1-2 sentences framing the process",
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
  "layout": "${ly || 'card-grid'}",
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
  "layout": "${ly || 'card-grid'}",
  "heading": "What Our Clients Say",
  "subheading": "Real results from real clients",
  "testimonials": [
    {
      "quote": "3-4 sentence quote mentioning: specific problem they had, what the business did, and the concrete result. Should sound like a real person.",
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
  "layout": "${ly || 'accordion'}",
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
  "items": [
    { "title": "Project Name", "description": "Brief outcome or what was delivered." },
    { "title": "Project Name", "description": "Brief outcome or what was delivered." },
    { "title": "Project Name", "description": "Brief outcome or what was delivered." }
  ]
}
Generate 3-6 realistic, specific portfolio items or work samples for this business. Make titles and descriptions specific to their industry.`,

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
  existingContent = '',
  layoutOverride?: string | null,
): Promise<{ content: Record<string, unknown>; sectionCss: string | null; sectionJs: string | null }> {
  const layout = layoutOverride ?? pickRandomLayout(type)
  const rawPrompt = sectionPrompt(type, siteName, pageContext, theme, homepageSummary, layout)

  // Inject real content BEFORE the "Return ONLY valid JSON:" line so the AI
  // reads the real data first, then follows the JSON schema instruction.
  const finalPrompt = existingContent
    ? rawPrompt.replace(
        'Return ONLY valid JSON:',
        `REAL BUSINESS CONTENT FROM CLIENT'S EXISTING WEBSITE — extract and use real names, services, certifications, prices, team members, and copy from this. Do NOT invent details that contradict this content:\n\n${existingContent.slice(0, 3000)}\n\nReturn ONLY valid JSON:`
      )
    : rawPrompt

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: COPY_SYSTEM,
    messages: [{ role: 'user', content: finalPrompt }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  // Extract first complete JSON object or array
  const jsonMatch = text.match(/[\[\{][\s\S]*[\]\}]/)
  if (!jsonMatch) {
    console.error(`generateSection(${type}): No JSON found. Full text:`, text.slice(0, 500))
    throw new Error(`Section generator (${type}) returned invalid JSON`)
  }
  let content: Record<string, unknown>
  try {
    content = JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch (parseErr) {
    console.error(`generateSection(${type}): JSON.parse failed. Matched:`, jsonMatch[0].slice(0, 500))
    throw parseErr
  }

  // Ensure layout is always stored in content so renderer can dispatch correctly
  if (layout && !content.layout) {
    content.layout = layout
  }

  return { content, sectionCss: null, sectionJs: null }
}
