'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type DnsRecord = { type: string; name: string; value: string; ttl: string; note: string }

type Website = {
  id: string
  name: string
  subdomain: string
  update_email: string
  status: string
  custom_domain: string | null
  created_at: string
  updated_at: string
}

type DomainState = {
  input: string
  loading: boolean
  error: string | null
  warning: string | null
  dns: DnsRecord[] | null
}

const defaultDomainState = (): DomainState => ({
  input: '',
  loading: false,
  error: null,
  warning: null,
  dns: null,
})

export default function DashboardPage() {
  const router = useRouter()
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  // Per-site domain UI state keyed by site ID
  const [domainPanels, setDomainPanels] = useState<Record<string, DomainState>>({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setUserEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('sites')
        .select('id, name, subdomain, update_email, status, custom_domain, created_at, updated_at')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })
      setWebsites(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function toggleDomainPanel(siteId: string, existingDomain: string | null) {
    setDomainPanels(prev => {
      if (prev[siteId]) {
        const { [siteId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [siteId]: { ...defaultDomainState(), input: existingDomain ?? '' } }
    })
  }

  function updatePanel(siteId: string, patch: Partial<DomainState>) {
    setDomainPanels(prev => ({ ...prev, [siteId]: { ...prev[siteId], ...patch } }))
  }

  async function handleAddDomain(siteId: string) {
    const panel = domainPanels[siteId]
    if (!panel?.input.trim()) return
    updatePanel(siteId, { loading: true, error: null, warning: null, dns: null })

    const res = await fetch('/api/add-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, domain: panel.input.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      updatePanel(siteId, { loading: false, error: data.error ?? 'Something went wrong' })
      return
    }

    // Update local state so card reflects new domain immediately
    setWebsites(prev => prev.map(s => s.id === siteId ? { ...s, custom_domain: data.domain } : s))
    updatePanel(siteId, { loading: false, dns: data.dns, warning: data.warning ?? null })
  }

  async function handleRemoveDomain(siteId: string) {
    await fetch('/api/add-domain', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId }),
    })
    setWebsites(prev => prev.map(s => s.id === siteId ? { ...s, custom_domain: null } : s))
    setDomainPanels(prev => { const { [siteId]: _, ...rest } = prev; return rest })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">SiteSync</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{userEmail}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white transition">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Your Websites</h2>
            <p className="text-gray-400 mt-1">Manage and update your AI-generated websites</p>
          </div>
          <Link
            href="/dashboard/new"
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition"
          >
            + New Website
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading…</div>
        ) : websites.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-2xl">
            <div className="text-5xl mb-4">🌐</div>
            <h3 className="text-lg font-semibold mb-2">No websites yet</h3>
            <p className="text-gray-400 mb-6">Create your first AI-powered website in seconds</p>
            <Link
              href="/dashboard/new"
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition"
            >
              Create your first website
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {websites.map((site) => {
              const panel = domainPanels[site.id]
              return (
                <div
                  key={site.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition"
                >
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">{site.name}</h3>
                    {site.status === 'building' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-800">
                        building
                      </span>
                    )}
                  </div>

                  {/* Demo URL */}
                  <p className="text-sm text-gray-500 mb-1 font-mono">
                    Demo: {site.subdomain}.sitesync.app
                  </p>

                  {/* Custom domain badge */}
                  {site.custom_domain && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800 font-mono">
                        🌐 {site.custom_domain}
                      </span>
                      <button
                        onClick={() => handleRemoveDomain(site.id)}
                        className="text-xs text-gray-600 hover:text-red-400 transition"
                        title="Remove custom domain"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Update email */}
                  <div className="bg-gray-800 rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs text-gray-500 mb-0.5">Email to update your site</p>
                    <p className="text-sm text-violet-300 font-mono break-all">{site.update_email}</p>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2 mb-3">
                    <a
                      href={`https://sitesync-psi.vercel.app/sites/${site.subdomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                    >
                      Preview →
                    </a>
                    <button
                      onClick={() => toggleDomainPanel(site.id, site.custom_domain)}
                      className={`flex-1 text-center py-1.5 text-sm rounded-lg transition ${
                        panel
                          ? 'bg-violet-900/50 text-violet-300 border border-violet-800'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      {site.custom_domain ? '✎ Edit domain' : '+ Custom domain'}
                    </button>
                    <span className="text-xs text-gray-600 whitespace-nowrap">
                      {new Date(site.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Domain panel */}
                  {panel && (
                    <div className="mt-2 border-t border-gray-800 pt-4">
                      {!panel.dns ? (
                        <>
                          <p className="text-xs text-gray-400 mb-2">
                            Enter the client&apos;s domain (e.g. <span className="font-mono">blueridgecoffee.com</span>)
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={panel.input}
                              onChange={e => updatePanel(site.id, { input: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && handleAddDomain(site.id)}
                              placeholder="example.com"
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-violet-500"
                            />
                            <button
                              onClick={() => handleAddDomain(site.id)}
                              disabled={panel.loading || !panel.input.trim()}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                            >
                              {panel.loading ? '…' : 'Save'}
                            </button>
                          </div>
                          {panel.error && (
                            <p className="text-xs text-red-400 mt-2">{panel.error}</p>
                          )}
                        </>
                      ) : (
                        <div>
                          <p className="text-xs text-green-400 font-semibold mb-3">
                            ✓ Domain saved — give the client these DNS records:
                          </p>
                          {panel.warning && (
                            <p className="text-xs text-yellow-400 mb-3 bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2">
                              ⚠ {panel.warning}
                            </p>
                          )}
                          <div className="bg-gray-800 rounded-lg overflow-hidden text-xs font-mono">
                            <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-gray-500 border-b border-gray-700">
                              <span>Type</span><span>Name</span><span className="col-span-2">Value</span>
                            </div>
                            {panel.dns?.map((r, i) => (
                              <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-gray-700/50 last:border-0">
                                <span className="text-violet-400">{r.type}</span>
                                <span className="text-gray-300">{r.name}</span>
                                <span className="col-span-2 text-green-300 break-all">{r.value}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            DNS changes can take up to 48 hours to propagate.
                          </p>
                          <button
                            onClick={() => updatePanel(site.id, { dns: null })}
                            className="text-xs text-gray-500 hover:text-gray-300 mt-2 transition"
                          >
                            ← Change domain
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
