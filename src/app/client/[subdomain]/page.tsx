'use client'

// ============================================================
// SiteSync — Client Portal
// Mobile-first PWA for clients to manage their website.
// Auth: magic link → token stored in localStorage (30 days)
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────
type Session = { email: string; subdomain: string; siteName: string; exp: number }
type Tab = 'update' | 'preview' | 'editors' | 'history'
type HistoryItem = {
  id: string
  trigger: string
  triggeredBy: string
  instructions: string
  pageName: string
  createdAt: string
}

// ── Session helpers ───────────────────────────────────────────
const SESSION_KEY = (sub: string) => `ss_client_${sub}`
const SESSION_DAYS = 30

function loadSession(subdomain: string): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY(subdomain))
    if (!raw) return null
    const s: Session = JSON.parse(raw)
    if (s.exp < Date.now()) { localStorage.removeItem(SESSION_KEY(subdomain)); return null }
    return s
  } catch { return null }
}

function saveSession(s: Session) {
  localStorage.setItem(SESSION_KEY(s.subdomain), JSON.stringify(s))
}

function clearSession(subdomain: string) {
  localStorage.removeItem(SESSION_KEY(subdomain))
}

// ── Component ─────────────────────────────────────────────────
export default function ClientPortal() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const subdomain = (params?.subdomain as string) ?? ''

  const [phase, setPhase] = useState<'loading' | 'login' | 'check-email' | 'portal'>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [tab, setTab] = useState<Tab>('update')

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Update form
  const [instructions, setInstructions] = useState('')
  const [updateLoading, setUpdateLoading] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [updateMsg, setUpdateMsg] = useState('')

  // Editors
  const [editors, setEditors] = useState<string[]>([])
  const [editorsLoading, setEditorsLoading] = useState(false)
  const [newEditor, setNewEditor] = useState('')
  const [editorError, setEditorError] = useState('')

  // History
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Boot: check for token in URL or existing session ─────
  useEffect(() => {
    const token = searchParams?.get('token')

    if (token) {
      // Verify the magic link token
      fetch('/api/client/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok) {
            const s: Session = {
              email: data.email,
              subdomain: data.subdomain,
              siteName: data.siteName,
              exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
            }
            saveSession(s)
            setSession(s)
            setPhase('portal')
            // Remove token from URL without reload
            router.replace(`/client/${subdomain}`)
          } else {
            setLoginError(data.error ?? 'Invalid or expired link — please request a new one.')
            setPhase('login')
          }
        })
        .catch(() => {
          setLoginError('Something went wrong — please try again.')
          setPhase('login')
        })
      return
    }

    // Check existing session
    const existing = loadSession(subdomain)
    if (existing) {
      setSession(existing)
      setPhase('portal')
    } else {
      setPhase('login')
    }
  }, [subdomain, searchParams, router])

  // ── Load tab data when tab changes ───────────────────────
  const loadEditors = useCallback(async (s: Session) => {
    setEditorsLoading(true)
    setEditorError('')
    try {
      const res = await fetch(`/api/client/editors?subdomain=${s.subdomain}&email=${encodeURIComponent(s.email)}`)
      const data = await res.json()
      if (data.editors) setEditors(data.editors)
    } catch { /* silent */ }
    setEditorsLoading(false)
  }, [])

  const loadHistory = useCallback(async (s: Session) => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/client/history?subdomain=${s.subdomain}&email=${encodeURIComponent(s.email)}`)
      const data = await res.json()
      if (data.history) setHistory(data.history)
    } catch { /* silent */ }
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    if (!session || phase !== 'portal') return
    if (tab === 'editors') loadEditors(session)
    if (tab === 'history') loadHistory(session)
  }, [tab, session, phase, loadEditors, loadHistory])

  // ── Handlers ──────────────────────────────────────────────
  async function handleSendLink(e: React.FormEvent) {
    e.preventDefault()
    const email = loginEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError('Please enter a valid email address.')
      return
    }
    setLoginLoading(true)
    setLoginError('')
    try {
      await fetch('/api/client/send-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, email }),
      })
      // Always show success to avoid enumeration
      setPhase('check-email')
    } catch {
      setLoginError('Something went wrong. Please try again.')
    }
    setLoginLoading(false)
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !instructions.trim() || updateLoading) return
    setUpdateLoading(true)
    setUpdateStatus('loading')
    setUpdateMsg('')
    try {
      const res = await fetch('/api/client/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: session.subdomain, email: session.email, instructions: instructions.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setUpdateStatus('done')
        setUpdateMsg('Your site has been updated! Changes will be live within a few seconds.')
        setInstructions('')
      } else {
        setUpdateStatus('error')
        setUpdateMsg(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setUpdateStatus('error')
      setUpdateMsg('Something went wrong. Please try again.')
    }
    setUpdateLoading(false)
    setTimeout(() => setUpdateStatus('idle'), 8000)
  }

  async function handleAddEditor(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !newEditor.trim()) return
    setEditorError('')
    const res = await fetch('/api/client/editors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: session.subdomain, email: session.email, newEditor: newEditor.trim().toLowerCase() }),
    })
    const data = await res.json()
    if (data.ok) {
      setEditors(data.editors)
      setNewEditor('')
    } else {
      setEditorError(data.error ?? 'Failed to add editor.')
    }
  }

  async function handleRemoveEditor(target: string) {
    if (!session) return
    const res = await fetch('/api/client/editors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subdomain: session.subdomain, email: session.email, removeEditor: target }),
    })
    const data = await res.json()
    if (data.ok) setEditors(data.editors)
  }

  function handleSignOut() {
    clearSession(subdomain)
    setSession(null)
    setPhase('login')
    setLoginEmail('')
  }

  // ── Render ────────────────────────────────────────────────
  const accent = '#7c3aed' // violet-700

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (phase === 'check-email') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
          <h1 style={styles.heading}>Check your email</h1>
          <p style={styles.subtext}>
            We sent a login link to <strong style={{ color: '#e2e8f0' }}>{loginEmail}</strong>.
            Click it to access your site portal.
          </p>
          <p style={{ ...styles.subtext, marginTop: 8, fontSize: 13, color: '#475569' }}>
            The link expires in 1 hour. Check your spam folder if you don&apos;t see it.
          </p>
          <button onClick={() => { setPhase('login'); setLoginEmail('') }} style={{ ...styles.btnSecondary, marginTop: 24 }}>
            Back
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
          <h1 style={styles.heading}>Welcome to your site</h1>
          <p style={styles.subtext}>Enter your email to receive a one-click login link.</p>
          <form onSubmit={handleSendLink} style={{ marginTop: 24 }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              style={styles.input}
              autoFocus
              required
            />
            {loginError && <p style={styles.error}>{loginError}</p>}
            <button type="submit" disabled={loginLoading} style={{ ...styles.btnPrimary, width: '100%', marginTop: 12 }}>
              {loginLoading ? 'Sending…' : 'Send login link'}
            </button>
          </form>
          <p style={{ ...styles.subtext, marginTop: 20, fontSize: 12 }}>
            Only authorized email addresses can access this portal.
          </p>
        </div>
      </div>
    )
  }

  // ── Portal ────────────────────────────────────────────────
  const siteUrl = `https://sitesync-psi.vercel.app/sites/${session!.subdomain}`

  return (
    <div style={{ minHeight: '100dvh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{session!.siteName}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{session!.email}</div>
        </div>
        <button onClick={handleSignOut} style={{ fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px' }}>
          Sign out
        </button>
      </header>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: '#1e293b', borderBottom: '1px solid #334155' }}>
        {(['update', 'preview', 'editors', 'history'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '12px 4px', fontSize: 12, fontWeight: 600,
              textTransform: 'capitalize', background: 'none', border: 'none',
              borderBottom: tab === t ? `2px solid ${accent}` : '2px solid transparent',
              color: tab === t ? '#a78bfa' : '#64748b',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {t === 'update' ? '✏️ Update' : t === 'preview' ? '👁 Preview' : t === 'editors' ? '👥 Editors' : '📋 History'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Update tab ── */}
        {tab === 'update' && (
          <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Update your site</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              Describe what you&apos;d like to change and our AI will update your site automatically.
            </p>
            <form onSubmit={handleUpdate}>
              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={'Examples:\n• "Update our hours to Mon–Fri 8am–6pm"\n• "Add a new service: Senior Pet Wellness"\n• "Change our tagline to: Your pets deserve the best"\n• "On the About page, update our team to include Dr. Martinez"'}
                rows={7}
                style={{ ...styles.input, resize: 'vertical', lineHeight: 1.6 }}
              />
              {updateStatus === 'done' && (
                <div style={{ background: '#14532d', border: '1px solid #16a34a', borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: 13, color: '#86efac' }}>
                  {updateMsg}
                </div>
              )}
              {updateStatus === 'error' && (
                <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: 13, color: '#fca5a5' }}>
                  {updateMsg}
                </div>
              )}
              <button
                type="submit"
                disabled={updateLoading || !instructions.trim()}
                style={{ ...styles.btnPrimary, width: '100%', marginTop: 12, opacity: updateLoading || !instructions.trim() ? 0.5 : 1 }}
              >
                {updateLoading ? 'Updating your site…' : 'Apply update'}
              </button>
            </form>
            <div style={{ marginTop: 24, padding: '14px', background: '#1e293b', borderRadius: 10, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              <strong style={{ color: '#94a3b8' }}>Tips</strong><br />
              Be specific about what page to update. Changes apply to the homepage by default. You can also mention the team, services, contact info, pricing, or any other section.
            </div>
          </div>
        )}

        {/* ── Preview tab ── */}
        {tab === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 113px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
              <span style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{siteUrl}</span>
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#a78bfa', marginLeft: 12, whiteSpace: 'nowrap', textDecoration: 'none' }}>
                Open ↗
              </a>
            </div>
            <iframe
              src={siteUrl}
              style={{ flex: 1, border: 'none', width: '100%' }}
              title="Site preview"
            />
          </div>
        )}

        {/* ── Editors tab ── */}
        {tab === 'editors' && (
          <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Authorized editors</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              These email addresses can send updates to your site — both via this portal and by emailing your update address.
            </p>
            {editorsLoading ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Loading…</div>
            ) : (
              <div style={{ marginBottom: 20 }}>
                {editors.length === 0 ? (
                  <p style={{ color: '#475569', fontSize: 13 }}>No editors added yet.</p>
                ) : (
                  editors.map(ed => (
                    <div key={ed} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#1e293b', borderRadius: 10, marginBottom: 8, border: '1px solid #334155' }}>
                      <span style={{ fontSize: 14, wordBreak: 'break-all' }}>{ed}</span>
                      {ed !== session!.email && (
                        <button onClick={() => handleRemoveEditor(ed)} style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, whiteSpace: 'nowrap' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
            <form onSubmit={handleAddEditor}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  placeholder="Add editor email…"
                  value={newEditor}
                  onChange={e => setNewEditor(e.target.value)}
                  style={{ ...styles.input, flex: 1, marginBottom: 0 }}
                />
                <button type="submit" disabled={!newEditor.trim()} style={{ ...styles.btnPrimary, whiteSpace: 'nowrap', opacity: newEditor.trim() ? 1 : 0.5 }}>
                  Add
                </button>
              </div>
              {editorError && <p style={styles.error}>{editorError}</p>}
            </form>
          </div>
        )}

        {/* ── History tab ── */}
        {tab === 'history' && (
          <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Update history</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              Recent changes made to your site.
            </p>
            {historyLoading ? (
              <div style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>Loading…</div>
            ) : history.length === 0 ? (
              <p style={{ color: '#475569', fontSize: 13 }}>No updates yet.</p>
            ) : (
              history.map(item => (
                <div key={item.id} style={{ padding: '14px', background: '#1e293b', borderRadius: 10, marginBottom: 10, border: '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>{item.pageName}</span>
                    <span style={{ fontSize: 11, color: '#475569', marginLeft: 8, whiteSpace: 'nowrap' }}>
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                    {item.instructions?.length > 160 ? item.instructions.slice(0, 160) + '…' : item.instructions ?? 'Initial generation'}
                  </p>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
                    {item.trigger === 'initial_generation' ? 'Site created' : `Updated by ${item.triggeredBy}`}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </main>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    padding: '20px 16px',
    fontFamily: 'system-ui, sans-serif',
  } as React.CSSProperties,
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: '32px 24px',
    width: '100%',
    maxWidth: 400,
    textAlign: 'center',
    color: '#e2e8f0',
  } as React.CSSProperties,
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
    color: '#f1f5f9',
  } as React.CSSProperties,
  subtext: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 1.6,
    margin: 0,
  } as React.CSSProperties,
  input: {
    width: '100%',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 8,
    fontFamily: 'system-ui, sans-serif',
  } as React.CSSProperties,
  btnPrimary: {
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  btnSecondary: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '10px 20px',
    fontSize: 14,
    cursor: 'pointer',
  } as React.CSSProperties,
  error: {
    fontSize: 13,
    color: '#f87171',
    margin: '6px 0 0',
    textAlign: 'left',
  } as React.CSSProperties,
}
