// ============================================================
// SiteSync — Site Scraper
// Fetches an existing website, extracts key pages, strips to
// clean text, and returns it as context for site generation.
// ============================================================

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Strip HTML to readable plain text ─────────────────────────
function stripHtml(html: string): string {
  return html
    // Remove noise blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Collapse block elements to newlines
    .replace(/<\/?(p|div|section|article|h[1-6]|li|br|tr)[^>]*>/gi, '\n')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    // Collapse whitespace
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000) // cap per page to avoid token overrun
}

// ── Extract internal links from a page ────────────────────────
function extractLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin
  const linkPattern = /href=["']([^"'#?]+)["']/gi
  const seen = new Set<string>()
  let match

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1].trim()
    if (!href || href === '/' || href.startsWith('mailto:') || href.startsWith('tel:')) continue
    try {
      const resolved = new URL(href, baseUrl)
      // Internal only, skip binary files
      if (
        resolved.origin === origin &&
        !resolved.pathname.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|css|js|xml|json|ico|zip|woff|ttf)$/i) &&
        !resolved.pathname.includes('/wp-admin') &&
        !resolved.pathname.includes('/wp-login') &&
        !resolved.pathname.includes('/cart') &&
        !resolved.pathname.includes('/checkout') &&
        !resolved.pathname.includes('/account') &&
        !resolved.pathname.includes('/login') &&
        !resolved.pathname.includes('/register')
      ) {
        const clean = resolved.origin + resolved.pathname
        seen.add(clean)
      }
    } catch {
      // skip invalid URLs
    }
  }

  return [...seen]
}

// ── AI picks the most valuable pages to read ──────────────────
async function pickRelevantPages(links: string[], homepageSnippet: string): Promise<string[]> {
  if (links.length === 0) return []

  const list = links.slice(0, 60).map((l, i) => `${i + 1}. ${l}`).join('\n')
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `You are selecting pages from a business website to read for a website migration.

Homepage text snippet: "${homepageSnippet.slice(0, 400)}"

Available pages:
${list}

Select up to 6 pages most likely to contain real business content: About Us, Services, Team, Pricing, Contact, Portfolio/Gallery, Process, Testimonials.

SKIP: blog posts, individual news articles, press releases, individual project/product detail pages, tag/category archive pages, sitemap, privacy policy, terms of service.

Return ONLY a JSON array of the exact selected URLs (no other text).
Example: ["https://example.com/about", "https://example.com/services"]`,
    }]
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]'
  const arrayMatch = text.match(/\[[\s\S]*?\]/)
  if (!arrayMatch) return []
  try {
    const urls = JSON.parse(arrayMatch[0]) as string[]
    // Validate that returned URLs actually exist in our list
    return urls
      .filter(u => typeof u === 'string' && links.some(l => l === u || l === u.replace(/\/$/, '')))
      .slice(0, 6)
  } catch {
    return []
  }
}

// ── Fetch a URL with a timeout ────────────────────────────────
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SiteSync/1.0 (website migration; +https://sitesync-psi.vercel.app)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('html')) return null
    return await res.text()
  } catch {
    return null
  }
}

// ── Public result type ────────────────────────────────────────
export interface ScrapeResult {
  success: boolean
  content: string   // labeled sections joined with \n\n
  pagesRead: number
  message: string   // human-readable status
}

// ── Main entry point ──────────────────────────────────────────
export async function scrapeSite(rawUrl: string): Promise<ScrapeResult> {
  try {
    // Normalize URL
    const url = rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`
    const baseUrl = new URL(url).href.replace(/\/$/, '')

    // 1. Fetch homepage
    const homeHtml = await fetchWithTimeout(baseUrl, 8000)
    if (!homeHtml) {
      return { success: false, content: '', pagesRead: 0, message: 'Could not fetch website — it may be unreachable.' }
    }

    const homeText = stripHtml(homeHtml)
    if (homeText.length < 50) {
      return { success: false, content: '', pagesRead: 0, message: 'Website returned minimal content (may be JavaScript-only).' }
    }

    // 2. Extract links and let AI pick the good ones
    const allLinks = extractLinks(homeHtml, baseUrl)
    const selectedLinks = await pickRelevantPages(allLinks, homeText)

    // 3. Build content sections
    const sections: string[] = [`=== HOME PAGE ===\n${homeText}`]
    let pagesRead = 1

    for (const link of selectedLinks) {
      const html = await fetchWithTimeout(link, 6000)
      if (!html) continue
      const text = stripHtml(html)
      if (text.length < 100) continue

      // Label from pathname
      const pathname = new URL(link).pathname
      const label = pathname
        .replace(/^\//, '')
        .replace(/\/$/, '')
        .replace(/[-_/]/g, ' ')
        .toUpperCase() || 'PAGE'

      sections.push(`=== ${label} ===\n${text}`)
      pagesRead++
    }

    const content = sections.join('\n\n')
    return {
      success: true,
      content,
      pagesRead,
      message: `Read ${pagesRead} page${pagesRead !== 1 ? 's' : ''} from ${new URL(baseUrl).hostname}`,
    }
  } catch (err) {
    console.error('siteScraper error:', err)
    return { success: false, content: '', pagesRead: 0, message: 'Scrape failed — site will be generated from your description instead.' }
  }
}
