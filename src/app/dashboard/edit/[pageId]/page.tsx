'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────
type Section = {
  id: string
  type: string
  order_index: number
  label: string | null
  content: Record<string, unknown>
  published: boolean
  site_id: string
}

type PageWithSite = {
  id: string
  title: string
  nav_label: string | null
  slug: string
  is_homepage: boolean
  site_id: string
  sites: { name: string; subdomain: string } | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Field helpers ─────────────────────────────────────────────

/** Returns top-level string/number/boolean entries — directly editable as inputs */
function simpleEntries(c: Record<string, unknown>): [string, string | number | boolean][] {
  return Object.entries(c).filter(
    ([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  ) as [string, string | number | boolean][]
}

/** Returns top-level array/object entries — shown as JSON textarea */
function complexEntries(c: Record<string, unknown>): [string, unknown][] {
  return Object.entries(c).filter(
    ([, v]) => Array.isArray(v) || (typeof v === 'object' && v !== null)
  )
}

function labelFor(key: string): string {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, l => l.toUpperCase())
}

// ── Section editor ────────────────────────────────────────────
function SectionEditor({
  section, userId, onSaved,
}: {
  section: Section
  userId: string
  onSaved: () => void
}) {
  const [content, setContent] = useState<Record<string, unknown>>({ ...section.content })
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({})

  function setSimple(key: string, value: string) {
    setContent(prev => ({ ...prev, [key]: value }))
  }

  function setJson(key: string, raw: string) {
    setJsonDrafts(prev => ({ ...prev, [key]: raw }))
    try {
      const parsed = JSON.parse(raw)
      setContent(prev => ({ ...prev, [key]: parsed }))
      setJsonErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    } catch {
      setJsonErrors(prev => ({ ...prev, [key]: 'Invalid JSON' }))
    }
  }

  async function handleSave() {
    if (Object.keys(jsonErrors).length > 0) return
    setSaveState('saving')
    try {
      const res = await fetch('/api/save-section', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId: section.id, content, siteId: section.site_id, userId }),
      })
      if (res.ok) {
        setSaveState('saved')
        onSaved()
        setTimeout(() => setSaveState('idle'), 2500)
      } else {
        setSaveState('error')
      }
    } catch {
      setSaveState('error')
    }
  }

  const simple = simpleEntries(content)
  const complex = complexEntries(content)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/50 text-violet-300 border border-violet-800 font-mono">
          {section.type}
        </span>
        {section.label && <span className="text-sm text-gray-400">{section.label}</span>}
        {!section.published && <span className="text-xs text-yellow-500">draft</span>}
      </div>

      <div className="space-y-3 mb-4">
        {simple.map(([key, value]) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-gray-400 mb-1">{labelFor(key)}</label>
            {key === 'body' || key === 'description' || String(value).length > 80 ? (
              <textarea
                value={String(value)}
                onChange={e => setSimple(key, e.target.value)}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 resize-y"
              />
            ) : (
              <input
                type="text"
                value={String(value)}
                onChange={e => setSimple(key, e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            )}
          </div>
        ))}

        {complex.map(([key, value]) => {
          const draft = key in jsonDrafts ? jsonDrafts[key] : JSON.stringify(value, null, 2)
          return (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                {labelFor(key)}
                <span className="ml-2 text-gray-600 font-normal font-mono">
                  {Array.isArray(value) ? `(${(value as unknown[]).length} items)` : '(object)'}
                </span>
              </label>
              <textarea
                value={draft}
                onChange={e => setJson(key, e.target.value)}
                rows={Math.min(Math.max(draft.split('\n').length, 4), 16)}
                spellCheck={false}
                className={`w-full bg-gray-950 border rounded-lg px-3 py-2 text-xs text-green-300 font-mono focus:outline-none resize-y ${
                  jsonErrors[key] ? 'border-red-700' : 'border-gray-700 focus:border-violet-500'
                }`}
              />
              {jsonErrors[key] && (
                <p className="text-xs text-red-400 mt-1">{jsonErrors[key]}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saveState === 'saving' || Object.keys(jsonErrors).length > 0}
          className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-semibold rounded-lg transition"
        >
          {saveState === 'saving' ? 'Saving…' : 'Save Section'}
        </button>
        {saveState === 'saved' && <span className="text-xs text-green-400">✓ Saved — live site will refresh</span>}
        {saveState === 'error' && <span className="text-xs text-red-400">Save failed. Try again.</span>}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export default function EditPageContent({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = use(params)
  const router = useRouter()
  const [page, setPage] = useState<PageWithSite | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      setUserId(session.user.id)

      const { data: pageData } = await supabase
        .from('pages')
        .select('id, title, nav_label, slug, is_homepage, site_id, sites(name, subdomain)')
        .eq('id', pageId)
        .single()

      if (!pageData) { router.push('/dashboard'); return }
      setPage(pageData as unknown as PageWithSite)

      const { data: sectionData } = await supabase
        .from('sections')
        .select('id, type, order_index, label, content, published, site_id')
        .eq('page_id', pageId)
        .order('order_index', { ascending: true })

      setSections((sectionData ?? []) as Section[])
      setLoading(false)
    }
    load()
  }, [pageId, router])

  const site = page?.sites
  const siteUrl = site
    ? `https://sitesync-psi.vercel.app/sites/${site.subdomain}${page?.is_homepage ? '' : `/${page?.slug}`}`
    : null

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
          ← Dashboard
        </Link>
        {siteUrl && (
          <a href={siteUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-violet-400 hover:text-violet-300 transition">
            View live page →
          </a>
        )}
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading sections…</div>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-xs text-gray-500 mb-1 font-mono">{site?.name}</p>
              <h1 className="text-2xl font-bold">{page?.nav_label ?? page?.title}</h1>
              <p className="text-gray-500 text-sm mt-1">
                {sections.length} section{sections.length !== 1 ? 's' : ''} — edit below and save each one
              </p>
            </div>

            <div className="space-y-4">
              {sections.map(s => (
                <SectionEditor
                  key={s.id}
                  section={s}
                  userId={userId}
                  onSaved={() => {}}
                />
              ))}
              {sections.length === 0 && (
                <p className="text-gray-600 text-sm">No sections found for this page.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
