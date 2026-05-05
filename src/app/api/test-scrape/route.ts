// ============================================================
// SiteSync — /api/test-scrape  (dev/debug only)
// Returns raw scrape result for a given URL so you can see
// exactly what the migrator will use.
// ============================================================
import { NextResponse } from 'next/server'
import { scrapeSite } from '@/lib/siteScraper'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const secret = searchParams.get('secret')

  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!url) {
    return NextResponse.json({ error: 'Missing ?url= param' }, { status: 400 })
  }

  const result = await scrapeSite(url)
  return NextResponse.json(result)
}
