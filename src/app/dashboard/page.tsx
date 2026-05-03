'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Website = {
  id: string
  name: string
  subdomain: string
  update_email: string
  status: string
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [websites, setWebsites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      setUserEmail(session.user.email ?? '')

      const { data } = await supabase
        .from('sites')
        .select('id, name, subdomain, update_email, status, created_at, updated_at')
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">SiteSync</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">Your Websites</h2>
            <p className="text-gray-400 mt-1">
              Manage and update your AI-generated websites
            </p>
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
            <p className="text-gray-400 mb-6">
              Create your first AI-powered website in seconds
            </p>
            <Link
              href="/dashboard/new"
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg transition"
            >
              Create your first website
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {websites.map((site) => (
              <div
                key={site.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-600 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-semibold">{site.name}</h3>
                  {site.status === 'building' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400 border border-yellow-800">
                      building
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-4 font-mono">
                  {site.subdomain}.sitesync.app
                </p>

                <div className="bg-gray-800 rounded-lg px-3 py-2 mb-4">
                  <p className="text-xs text-gray-500 mb-0.5">Email to update your site</p>
                  <p className="text-sm text-violet-300 font-mono break-all">{site.update_email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`https://sitesync-psi.vercel.app/sites/${site.subdomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition"
                  >
                    Preview site →
                  </a>
                  <span className="text-xs text-gray-600 self-center ml-2 whitespace-nowrap">
                    {new Date(site.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
