import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export interface GenerateSiteState {
  siteName: string
  subdomain: string
  prompt: string
  error: string
  loading: boolean
  progress: string
  progressPct: number
  setSiteName: (v: string) => void
  setPrompt: (v: string) => void
  handleSubdomain: (v: string) => void
  handleSubmit: (e: FormEvent) => Promise<void>
}

export function useGenerateSite(): GenerateSiteState {
  const router = useRouter()
  const [siteName, setSiteName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [chars, setChars] = useState(0)

  function handleSubdomain(value: string) {
    setSubdomain(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setChars(0)
    setProgress('Connecting…')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/login')
        return
      }

      setProgress('Building your site…')

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

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        setProgress('')
        return
      }

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
            if (event.type === 'progress') {
              setChars(event.chars)
              setProgress(`Building your site… (${Number(event.chars).toLocaleString()} chars)`)
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

  const progressPct = Math.min(Math.round((chars / 16000) * 100), 98)

  return {
    siteName, subdomain, prompt, error, loading, progress, progressPct,
    setSiteName, setPrompt, handleSubdomain, handleSubmit,
  }
}
