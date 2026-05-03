'use client'

import { useGenerateSite } from '@/hooks/useGenerateSite'

export function NewSiteForm() {
  const {
    siteName, subdomain, prompt, error, loading, progress, progressPct,
    setSiteName, setPrompt, handleSubdomain, handleSubmit,
  } = useGenerateSite()

  return (
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
        <p className="text-xs text-gray-500 mt-1">Lowercase letters, numbers, and hyphens only</p>
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
          {progressPct > 0 && (
            <div className="space-y-1">
              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-violet-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-right">{progressPct}%</p>
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
  )
}
