import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_ROUTES = ['/dashboard']
const AUTH_ROUTES = ['/auth/login', '/auth/signup']
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'mail', 'mg', 'admin', 'dashboard'])

// Known internal hosts — skip custom-domain DB lookup for these
const INTERNAL_HOST_SUFFIXES = ['.vercel.app', '.sitesync.app']
const INTERNAL_HOSTS = new Set(['sceneengineering.com', 'www.sceneengineering.com'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''
  const hostWithoutPort = hostname.split(':')[0]

  // ── Skip assets/API ──────────────────────────────────────────
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  // ── sceneengineering.com → scene-engineering ─────────────────
  if (hostWithoutPort === 'sceneengineering.com' || hostWithoutPort === 'www.sceneengineering.com') {
    const url = request.nextUrl.clone()
    url.pathname = '/sites/scene-engineering'
    return NextResponse.rewrite(url)
  }

  // ── *.sitesync.app subdomain routing ─────────────────────────
  const subdomainMatch = hostWithoutPort.match(/^([a-z0-9-]+)\.sitesync\.app$/)
  if (subdomainMatch) {
    const subdomain = subdomainMatch[1]
    if (!RESERVED_SUBDOMAINS.has(subdomain)) {
      const url = request.nextUrl.clone()
      url.pathname = `/sites/${subdomain}`
      return NextResponse.rewrite(url)
    }
  }

  // ── Custom domain routing ─────────────────────────────────────
  // Only query DB for unknown external hosts (not localhost, not *.vercel.app, not *.sitesync.app)
  const isInternalHost =
    hostWithoutPort === 'localhost' ||
    INTERNAL_HOSTS.has(hostWithoutPort) ||
    INTERNAL_HOST_SUFFIXES.some(s => hostWithoutPort.endsWith(s))

  if (!isInternalHost && hostWithoutPort.includes('.')) {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const res = await fetch(
        `${supabaseUrl}/rest/v1/sites?custom_domain=eq.${encodeURIComponent(hostWithoutPort)}&select=subdomain&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          signal: AbortSignal.timeout(3000),
        }
      )
      if (res.ok) {
        const sites: { subdomain: string }[] = await res.json()
        if (sites.length > 0) {
          const url = request.nextUrl.clone()
          url.pathname = `/sites/${sites[0].subdomain}`
          return NextResponse.rewrite(url)
        }
      }
    } catch {
      // If lookup fails, fall through to normal routing
    }
  }

  // ── Auth guard ────────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))

  if (!isProtected && !isAuthRoute) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
