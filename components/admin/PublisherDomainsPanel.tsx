'use client'
// components/admin/PublisherDomainsPanel.tsx
// Drop this inside the publisher detail row / modal in your Publishers page.
// Props: publisherId (UUID string)

import { useState, useEffect, useCallback } from 'react'

interface SiteDomain {
  id: string
  site_id: string
  domain: string
  label: string
  is_pwa: boolean
  is_active: boolean
  created_at: string
}

interface Props {
  publisherId: string
  publisherName?: string
}

export function PublisherDomainsPanel({ publisherId, publisherName }: Props) {
  const [domains, setDomains]   = useState<SiteDomain[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState('')
  const [newDomain, setNewDomain] = useState('')
  const [newLabel,  setNewLabel]  = useState('')
  const [newIsPwa,  setNewIsPwa]  = useState(false)
  const [showForm,  setShowForm]  = useState(false)

  const BASE = `/api/publisher/${publisherId}/domains`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(BASE)
      const j = await r.json()
      setDomains(j.domains ?? [])
    } catch {
      setError('Failed to load domains')
    } finally {
      setLoading(false)
    }
  }, [BASE])

  useEffect(() => { load() }, [load])

  async function addDomain() {
    if (!newDomain.trim()) return
    setSaving(true); setError('')
    try {
      const r = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain.trim(), label: newLabel.trim() || 'Additional Domain', is_pwa: newIsPwa })
      })
      if (!r.ok) {
        const j = await r.json()
        setError(j.error ?? 'Failed to add domain')
      } else {
        setNewDomain(''); setNewLabel(''); setNewIsPwa(false); setShowForm(false)
        await load()
      }
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function removeDomain(id: string) {
    if (!confirm('Remove this domain?')) return
    setSaving(true)
    try {
      await fetch(BASE, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      await load()
    } catch { setError('Failed to remove domain') }
    finally { setSaving(false) }
  }

  async function toggleActive(d: SiteDomain) {
    setSaving(true)
    try {
      await fetch(BASE, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, is_active: !d.is_active })
      })
      await load()
    } catch { setError('Failed to update') }
    finally { setSaving(false) }
  }

  return (
    <div style={{
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: 16,
      marginTop: 8,
    }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <span style={{ fontWeight:600, fontSize:14, color:'var(--txt)' }}>
            Domains
          </span>
          {publisherName && (
            <span style={{ fontSize:12, color:'var(--txt-3)', marginLeft:6 }}>
              — {publisherName}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Domain
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--txt-3)', display:'block', marginBottom:4 }}>
                Domain / URL *
              </label>
              <input
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                placeholder="e.g. pwa.trendingverse.online"
                style={{
                  width:'100%', padding:'7px 10px', borderRadius:7, fontSize:13,
                  border:'1px solid var(--border)', background:'var(--bg-subtle)',
                  color:'var(--txt)', outline:'none', boxSizing:'border-box'
                }}
              />
              <p style={{ fontSize:10, color:'var(--txt-3)', marginTop:3 }}>
                Strip https:// — just the hostname (e.g. pwa.example.com)
              </p>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--txt-3)', display:'block', marginBottom:4 }}>
                Label
              </label>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. PWA, AMP, Hindi"
                style={{
                  width:'100%', padding:'7px 10px', borderRadius:7, fontSize:13,
                  border:'1px solid var(--border)', background:'var(--bg-subtle)',
                  color:'var(--txt)', outline:'none', boxSizing:'border-box'
                }}
              />
            </div>
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--txt-2)' }}>
            <input
              type="checkbox"
              checked={newIsPwa}
              onChange={e => setNewIsPwa(e.target.checked)}
              style={{ accentColor:'var(--accent)', width:14, height:14 }}
            />
            This is a PWA (Progressive Web App)
          </label>

          {error && (
            <p style={{ fontSize:12, color:'#ef4444', margin:0 }}>{error}</p>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={addDomain}
              disabled={saving || !newDomain.trim()}
              style={{
                background:'var(--accent)', color:'#fff', border:'none',
                borderRadius:8, padding:'7px 16px', fontSize:13, fontWeight:600,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Add Domain'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError('') }}
              style={{
                background:'var(--bg-subtle)', color:'var(--txt-2)',
                border:'1px solid var(--border)', borderRadius:8,
                padding:'7px 16px', fontSize:13, fontWeight:600, cursor:'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Domain list */}
      {loading ? (
        <p style={{ fontSize:13, color:'var(--txt-3)', margin:0 }}>Loading…</p>
      ) : domains.length === 0 ? (
        <p style={{ fontSize:13, color:'var(--txt-3)', margin:0 }}>
          No additional domains yet. The publisher's primary site URL is still used for ad targeting.
        </p>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {domains.map(d => (
            <div
              key={d.id}
              style={{
                display:'flex', alignItems:'center', gap:10,
                background:'var(--bg-card)',
                border:`1px solid ${d.is_active ? 'var(--border)' : 'var(--border-dim)'}`,
                borderRadius:8, padding:'8px 12px',
                opacity: d.is_active ? 1 : 0.55,
              }}
            >
              {/* PWA badge */}
              {d.is_pwa && (
                <span style={{
                  background:'#3b82f620', color:'#3b82f6',
                  fontSize:10, fontWeight:700, borderRadius:4, padding:'2px 6px',
                  flexShrink:0,
                }}>PWA</span>
              )}

              {/* Domain + label */}
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--txt)', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {d.domain}
                </span>
                {d.label && (
                  <span style={{ fontSize:11, color:'var(--txt-3)' }}>{d.label}</span>
                )}
              </div>

              {/* Active toggle */}
              <button
                onClick={() => toggleActive(d)}
                title={d.is_active ? 'Disable' : 'Enable'}
                style={{
                  background: d.is_active ? '#22c55e20' : 'var(--bg-subtle)',
                  color:       d.is_active ? '#22c55e'   : 'var(--txt-3)',
                  border: 'none', borderRadius:6, padding:'3px 10px',
                  fontSize:11, fontWeight:600, cursor:'pointer', flexShrink:0,
                }}
              >
                {d.is_active ? 'Active' : 'Disabled'}
              </button>

              {/* Remove */}
              <button
                onClick={() => removeDomain(d.id)}
                title="Remove domain"
                style={{
                  background:'transparent', border:'none',
                  color:'#ef444480', fontSize:16, cursor:'pointer',
                  padding:'0 4px', lineHeight:1, flexShrink:0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
