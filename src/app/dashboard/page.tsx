'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

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

type PageInfo = {
  id: string
  slug: string
  nav_label: string
  is_homepage: boolean
  published: boolean
}

type PagePanelState = {
  open: boolean
  loading: boolean          // loading existing pages list
  pages: PageInfo[]
  adding: boolean           // add-page form visible
  addName: string           // text input value
  generating: boolean       // SSE in progress
  genStatus: string
  genCurrent: number
  genTotal: number
  genError: string | null
  genDoneSlug: string | null
  deletingPageId: string | null  // page currently being deleted
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const defaultDomainState = (): DomainState => ({
  input: '',
  loading: false,
  error: null,
  warning: null,
  dns: null,
})

const defaultPagePanel = (): PagePanelState => ({
  open: false,
  loading: false,
  pages: [],
  adding: false,
  addName: '',
  generating: false,
  genStatus: '',
  genCurrent: 0,
  genTotal: 0,
  genError: null,
  genDoneSlug: null,
  deletingPageId: null,
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  // Per-site domain UI state keyed by site ID
  const [domainPanels, setDomainPanels] = useState<Record<string, DomainState>>({})
  // Per-site pages UI state keyed by site ID
  const [pagePanels, setPagePanels] = useState<Record<string, PagePanelState>>({})

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setUserEmail(session.user.email ?? '')
      setUserId(session.user.id)
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

  // ── Domain panel helpers ──────────────────────────────────────────────────

  function toggleDomainPanel(siteId: string, existingDomain: string | null) {
    setDomainPanels(prev => {
      if (prev[siteId]) {
        const { [siteId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [siteId]: { ...defaultDomainState(), input: existingDomain ?? '' } }
    })
  }

  function updateDomainPanel(siteId: string, patch: Partial<DomainState>) {
    setDomainPanels(prev => ({ ...prev, [siteId]: { ...prev[siteId], ...patch } }))
  }

  async function handleAddDomain(siteId: string) {
    const panel = domainPanels[siteId]
    if (!panel?.input.trim()) return
    updateDomainPanel(siteId, { loading: true, error: null, warning: null, dns: null })

    const res = await fetch('/api/add-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, domain: panel.input.trim() }),
    })
    const data = await res.json()

    if (!res.ok) {
      updateDomainPanel(siteId, { loading: false, error: data.error ?? 'Something went wrong' })
      return
    }

    setWebsites(prev => prev.map(s => s.id === siteId ? { ...s, custom_domain: data.domain } : s))
    updateDomainPanel(siteId, { loading: false, dns: data.dns, warning: data.warning ?? null })
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

  // ── Pages panel helpers ───────────────────────────────────────────────────

  function updatePagePanel(siteId: string, patch: Partial<PagePanelState>) {
    setPagePanels(prev => ({
      ...prev,
      [siteId]: { ...(prev[siteId] ?? defaultPagePanel()), ...patch },
    }))
  }

  async function togglePagesPanel(siteId: string) {
    const current = pagePanels[siteId]

    if (current?.open) {
      updatePagePanel(siteId, { open: false })
      return
    }

    // Open and load pages
    updatePagePanel(siteId, { open: true, loading: true })

    const { data } = await supabase
      .from('pages')
      .select('id, slug, nav_label, is_homepage, published')
      .eq('site_id', siteId)
      .order('nav_order', { ascending: true })

    updatePagePanel(siteId, { loading: false, pages: (data ?? []) as PageInfo[] })
  }

  async function handleAddPage(siteId: string) {
    const panel = pagePanels[siteId]
    const pageName = panel?.addName?.trim()
    if (!pageName || panel?.generating) return

    const pageSlug = toSlug(pageName)
    if (!pageSlug || pageSlug.length < 2) {
      updatePagePanel(siteId, { genError: 'Please enter a valid page name.' })
      return
    }

    // Check slug collision client-side
    if (panel.pages.some(p => p.slug === pageSlug)) {
      updatePagePanel(siteId, { genError: `A page with slug "${pageSlug}" already exists.` })
      return
    }

    updatePagePanel(siteId, {
      generating: true,
      genError: null,
      genDoneSlug: null,
      genStatus: 'Starting…',
      genCurrent: 0,
      genTotal: 0,
    })

    try {
      const res = await fetch('/api/generate-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, pageName, pageSlug, userId }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        updatePagePanel(siteId, {
          generating: false,
          genError: err.error ?? 'Failed to start page generation.',
        })
        return
      }

      // Read SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'status') {
              updatePagePanel(siteId, { genStatus: event.message })
            } else if (event.type === 'progress') {
              updatePagePanel(siteId, {
                genStatus: event.message,
                genCurrent: event.current,
                genTotal: event.total,
              })
            } else if (event.type === 'done') {
              const site = websites.find(s => s.id === siteId)
              updatePagePanel(siteId, {
                generating: false,
                adding: false,
                addName: '',
                genDoneSlug: event.slug,
                genStatus: '',
                // Append new page to local list
                pages: [
                  ...(pagePanels[siteId]?.pages ?? []),
                  {
                    id: event.pageId,
                    slug: event.slug,
                    nav_label: pageName,
                    is_homepage: false,
                    published: true,
                  },
                ],
              })
              // Refresh the pages list from DB to be sure
              const { data } = await supabase
                .from('pages')
                .select('id, slug, nav_label, is_homepage, published')
                .eq('site_id', siteId)
                .order('nav_order', { ascending: true })
              updatePagePanel(siteId, { pages: (data ?? []) as PageInfo[] })
              void site // suppress unused warning
            } else if (event.type === 'error') {
              updatePagePanel(siteId, {
                generating: false,
                genError: event.message,
                genStatus: '',
              })
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch (err) {
      console.error('handleAddPage error:', err)
      updatePagePanel(siteId, {
        generating: false,
        genError: 'Connection error. Please try again.',
      })
    }
  }

  async function handleDeletePage(siteId: string, pageId: string) {
    updatePagePanel(siteId, { deletingPageId: pageId })
    try {
      const res = await fetch('/api/delete-page', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, pageId, userId }),
      })
      if (res.ok) {
        // Remove from local state immediately
        updatePagePanel(siteId, {
          deletingPageId: null,
          pages: (pagePanels[siteId]?.pages ?? []).filter(p => p.id !== pageId),
          genDoneSlug: null,
          genError: null,
        })
      } else {
        const data = await res.json().catch(() => ({}))
        updatePagePanel(siteId, {
          deletingPageId: null,
          genError: data.error ?? 'Failed to delete page.',
        })
      }
    } catch {
      updatePagePanel(siteId, { deletingPageId: null, genError: 'Delete failed. Please try again.' })
    }
  }


  // ── Render ────────────────────────────────────────────────────────────────

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
              const domainPanel = domainPanels[site.id]
              const pagePanel = pagePanels[site.id]
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
                        domainPanel
                          ? 'bg-violet-900/50 text-violet-300 border border-violet-800'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      {site.custom_domain ? '✎ Domain' : '+ Domain'}
                    </button>
                    <button
                      onClick={() => togglePagesPanel(site.id)}
                      className={`flex-1 text-center py-1.5 text-sm rounded-lg transition ${
                        pagePanel?.open
                          ? 'bg-violet-900/50 text-violet-300 border border-violet-800'
                          : 'bg-gray-800 hover:bg-gray-700'
                      }`}
                    >
                      Pages {pagePanel?.open && pagePanel.pages.length > 0
                        ? `(${pagePanel.pages.length})`
                        : ''}
                    </button>
                  </div>

                  {/* Date */}
                  <p className="text-xs text-gray-600 text-right mb-1">
                    Updated {new Date(site.updated_at).toLocaleDateString()}
                  </p>

                  {/* ── Domain panel ── */}
                  {domainPanel && (
                    <div className="mt-2 border-t border-gray-800 pt-4">
                      {!domainPanel.dns ? (
                        <>
                          <p className="text-xs text-gray-400 mb-2">
                            Enter the client&apos;s domain (e.g. <span className="font-mono">blueridgecoffee.com</span>)
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={domainPanel.input}
                              onChange={e => updateDomainPanel(site.id, { input: e.target.value })}
                              onKeyDown={e => e.key === 'Enter' && handleAddDomain(site.id)}
                              placeholder="example.com"
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-violet-500"
                            />
                            <button
                              onClick={() => handleAddDomain(site.id)}
                              disabled={domainPanel.loading || !domainPanel.input.trim()}
                              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                            >
                              {domainPanel.loading ? '…' : 'Save'}
                            </button>
                          </div>
                          {domainPanel.error && (
                            <p className="text-xs text-red-400 mt-2">{domainPanel.error}</p>
                          )}
                        </>
                      ) : (
                        <div>
                          <p className="text-xs text-green-400 font-semibold mb-3">
                            ✓ Domain saved — give the client these DNS records:
                          </p>
                          {domainPanel.warning && (
                            <p className="text-xs text-yellow-400 mb-3 bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2">
                              ⚠ {domainPanel.warning}
                            </p>
                          )}
                          <div className="bg-gray-800 rounded-lg overflow-hidden text-xs font-mono">
                            <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-gray-500 border-b border-gray-700">
                              <span>Type</span><span>Name</span><span className="col-span-2">Value</span>
                            </div>
                            {domainPanel.dns?.map((r, i) => (
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
                            onClick={() => updateDomainPanel(site.id, { dns: null })}
                            className="text-xs text-gray-500 hover:text-gray-300 mt-2 transition"
                          >
                            ← Change domain
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Pages panel ── */}
                  {pagePanel?.open && (
                    <div className="mt-2 border-t border-gray-800 pt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Pages
                      </p>

                      {pagePanel.loading ? (
                        <p className="text-xs text-gray-500">Loading pages…</p>
                      ) : (
                        <>
                          {/* Pages list */}
                          <div className="space-y-1 mb-3">
                            {pagePanel.pages.map((page) => (
                              <div key={page.id} className="flex items-center justify-between text-xs py-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-gray-300 font-medium truncate">{page.nav_label}</span>
                                  <span className="text-gray-600 font-mono shrink-0">
                                    /{page.is_homepage ? '' : page.slug}
                                  </span>
                                  {!page.published && (
                                    <span className="text-yellow-500">draft</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <a
                                    href={
                                      page.is_homepage
                                        ? `https://sitesync-psi.vercel.app/sites/${site.subdomain}`
                                        : `https://sitesync-psi.vercel.app/sites/${site.subdomain}/${page.slug}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-violet-400 hover:text-violet-300 transition"
                                  >
                                    Preview →
                                  </a>
                                  {!page.is_homepage && (
                                    <button
                                      onClick={() => handleDeletePage(site.id, page.id)}
                                      disabled={pagePanel.deletingPageId === page.id || pagePanel.generating}
                                      className="text-gray-600 hover:text-red-400 disabled:opacity-40 transition"
                                      title="Delete page"
                                    >
                                      {pagePanel.deletingPageId === page.id ? '…' : '🗑'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {pagePanel.pages.length === 0 && (
                              <p className="text-xs text-gray-600">No pages found.</p>
                            )}
                          </div>

                          {/* Success banner */}
                          {pagePanel.genDoneSlug && !pagePanel.adding && (
                            <div className="bg-green-900/30 border border-green-800 rounded-lg px-3 py-2 mb-3 text-xs text-green-400">
                              ✓ &ldquo;{pagePanel.genDoneSlug}&rdquo; page created successfully!
                            </div>
                          )}

                          {/* Generation progress */}
                          {pagePanel.generating && (
                            <div className="bg-gray-800 rounded-lg px-3 py-3 mb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-300">{pagePanel.genStatus}</span>
                              </div>
                              {pagePanel.genTotal > 0 && (
                                <div className="w-full bg-gray-700 rounded-full h-1">
                                  <div
                                    className="bg-violet-500 h-1 rounded-full transition-all duration-300"
                                    style={{ width: `${(pagePanel.genCurrent / pagePanel.genTotal) * 100}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {/* Add page form */}
                          {pagePanel.adding && !pagePanel.generating ? (
                            <div className="border border-gray-700 rounded-lg p-3">
                              <p className="text-xs text-gray-400 mb-2">
                                Page name (e.g. &ldquo;About Us&rdquo;, &ldquo;Services&rdquo;, &ldquo;Menu&rdquo;)
                              </p>
                              <div className="flex gap-2 mb-1">
                                <input
                                  type="text"
                                  value={pagePanel.addName}
                                  onChange={e => updatePagePanel(site.id, { addName: e.target.value, genError: null })}
                                  onKeyDown={e => e.key === 'Enter' && handleAddPage(site.id)}
                                  placeholder="About Us"
                                  autoFocus
                                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500"
                                />
                                <button
                                  onClick={() => handleAddPage(site.id)}
                                  disabled={!pagePanel.addName.trim()}
                                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
                                >
                                  Generate
                                </button>
                                <button
                                  onClick={() => updatePagePanel(site.id, { adding: false, addName: '', genError: null })}
                                  className="px-2 py-1.5 text-gray-500 hover:text-gray-300 transition"
                                >
                                  ✕
                                </button>
                              </div>
                              {pagePanel.addName && (
                                <p className="text-xs text-gray-600 font-mono">
                                  slug: /{toSlug(pagePanel.addName)}
                                </p>
                              )}
                              {pagePanel.genError && (
                                <p className="text-xs text-red-400 mt-2">{pagePanel.genError}</p>
                              )}
                            </div>
                          ) : !pagePanel.generating && (
                            <button
                              onClick={() => updatePagePanel(site.id, { adding: true, genDoneSlug: null, genError: null })}
                              className="w-full py-1.5 text-xs text-gray-400 hover:text-white border border-dashed border-gray-700 hover:border-gray-500 rounded-lg transition"
                            >
                              + Add Page
                            </button>
                          )}
                        </>
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
