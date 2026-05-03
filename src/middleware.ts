import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_ROUTES = ['/dashboard']
const AUTH_ROUTES = ['/auth/login', '/auth/signup']
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'mail', 'mg', 'admin', 'dashboard'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host') || ''

  // ── Client site serving ───────────────────────────────────
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
    if (hostname === 'sceneengineering.com' || hostname === 'www.sceneengineering.com') {
      const url = request.nextUrl.clone()
      url.pathname = '/sites/scene-engineering'
      return NextResponse.rewrite(url)
    }
    const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.sitesync\.app$/)
    if (subdomainMatch) {
      const subdomain = subdomainMatch[1]
      if (!RESERVED_SUBDOMAINS.has(subdomain)) {
        const url = request.nextUrl.clone()
        url.pathname = `/sites/${subdomain}`
        return NextResponse.rewrite(url)
      }
    }
  }

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
