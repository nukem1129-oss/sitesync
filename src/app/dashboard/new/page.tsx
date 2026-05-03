'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NewWebsitePage() {
  const router = useRouter()
  const [siteName, setSiteName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [sectionCurrent, setSectionCurrent] = useState(0)
  const [sectionTotal, setSectionTotal] = useState(0)

  function handleSubdomain(value: string) {
    setSubdomain(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setSectionCurrent(0)
    setSectionTotal(0)
    setProgress('Connecting…')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      setProgress('AI is building your site…')

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteName,
          subdomain,
          prompt,
          userId: session.user.id,
          userEmail: session.user.email,
        }),
      })

      // Non-streaming error (validation failures return plain JSON)
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        setProgress('')
        return
      }

      // Read the SSE stream
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep any incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === 'progress') {
              setSectionCurrent(event.current ?? 0)
              setSectionTotal(event.total ?? 0)
              setProgress(event.message ?? `Building section ${event.current} of ${event.total}…`)
            } else if (event.type === 'status') {
              setProgress(event.message ?? '')
            } else if (event.type === 'done') {
              setProgress('Website created! Redirecting…')
              router.push('/dashboard')
              return
            } else if (event.type === 'error') {
              setError(event.message)
              setLoading(false)
              setProgress('')
              return
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
      setProgress('')
    }
  }

  // Progress bar width based on sections built
  const progressPct = sectionTotal > 0
    ? Math.min(Math.round((sectionCurrent / sectionTotal) * 100), 98)
    : 0

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-white transition">
          ← Dashboard
        </Link>
        <h1 className="text-xl font-bold">New Website</h1>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Create your website</h2>
          <p className="text-gray-400">
            Describe what you want and our AI will build a complete, professional website for you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Website name
            </label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              required
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition disabled:opacity-50"
              placeholder="My Awesome Business"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Subdomain
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={subdomain}
                onChange={(e) => handleSubdomain(e.target.value)}
                required
                disabled={loading}
                pattern="[a-z0-9-]+"
                minLength={3}
                maxLength={30}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition font-mono disabled:opacity-50"
                placeholder="my-business"
              />
              <span className="text-gray-500 text-sm whitespace-nowrap">.sitesync.app</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Describe your website
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              disabled={loading}
              rows={6}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none disabled:opacity-50"
              placeholder="Create a professional website for my plumbing business in Austin, TX. We offer emergency repairs, installation, and maintenance. Our team has 20 years of experience. Include a services section, about us, and contact form."
            />
            <p className="text-xs text-gray-500 mt-1">
              Be specific — mention your business type, services, tone, and any key information to include.
            </p>
          </div>

          {loading ? (
            <div className="py-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="inline-block w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <p className="text-gray-300 text-sm">{progress}</p>
              </div>
              {sectionTotal > 0 && (
                <div className="space-y-1">
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-right">
                    Section {sectionCurrent} of {sectionTotal}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition text-lg"
            >
              Generate website →
            </button>
          )}
        </form>
      </main>
    </div>
  )
}
