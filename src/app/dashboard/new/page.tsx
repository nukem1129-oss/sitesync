import Link from 'next/link'
import { NewSiteForm } from '@/components/features/NewSiteForm'

export default function NewWebsitePage() {
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
            Describe what you want and we will build a complete, professional website for you.
          </p>
        </div>

        <NewSiteForm />
      </main>
    </div>
  )
}
