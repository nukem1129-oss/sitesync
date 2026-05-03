import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabase-server'

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const VERCEL_TEAM_SLUG = process.env.VERCEL_TEAM_SLUG ?? 'nukem1129-oss-projects'
const VERCEL_PROJECT_SLUG = 'sitesync'

export async function POST(request: Request) {
  try {
    const { siteId, domain } = await request.json()

    // Basic domain format validation
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
    const clean = domain?.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!clean || !domainRegex.test(clean)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 })
    }

    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify user owns this site
    const { data: site } = await supabaseAdmin
      .from('sites')
      .select('id, subdomain, custom_domain')
      .eq('id', siteId)
      .eq('owner_id', user.id)
      .single()

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    // Add domain to Vercel project (if token is configured)
    let vercelWarning: string | null = null
    if (VERCEL_TOKEN) {
      const vercelRes = await fetch(
        `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_SLUG}/domains?slug=${VERCEL_TEAM_SLUG}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: clean }),
        }
      )
      if (!vercelRes.ok) {
        const err = await vercelRes.json()
        // domain_already_in_project is fine — just updating the mapping
        if (err.error?.code !== 'domain_already_in_project') {
          console.error('Vercel add domain error:', err)
          vercelWarning = 'Domain saved, but could not register with Vercel automatically. Add it manually in Vercel → Settings → Domains.'
        }
      }
    } else {
      vercelWarning = 'VERCEL_TOKEN not set — add the domain manually in Vercel → Settings → Domains.'
    }

    // Save custom_domain to Supabase
    const { error: dbErr } = await supabaseAdmin
      .from('sites')
      .update({ custom_domain: clean })
      .eq('id', siteId)

    if (dbErr) {
      console.error('Supabase update error:', dbErr)
      return NextResponse.json({ error: 'Failed to save domain' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      domain: clean,
      warning: vercelWarning,
      dns: [
        { type: 'A',     name: '@',   value: '76.76.21.21',        ttl: '1 hour', note: 'Required — points apex domain to Vercel' },
        { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com', ttl: '1 hour', note: 'Optional — routes www to Vercel' },
      ],
    })
  } catch (err) {
    console.error('Add domain error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Remove a custom domain
export async function DELETE(request: Request) {
  try {
    const { siteId } = await request.json()

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabaseAdmin
      .from('sites')
      .update({ custom_domain: null })
      .eq('id', siteId)
      .eq('owner_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Remove domain error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
