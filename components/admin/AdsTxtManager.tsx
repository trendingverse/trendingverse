'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Site { id: string; name: string; site_url: string }
interface Entry {
  id: string; site_id: string | null
  ad_system: string; publisher_id: string; relationship: string
  cert_authority_id: string | null; notes: string | null; is_active: boolean
}

// Common ad systems for one-click preset add
const PRESETS = [
  { label: 'Google AdSense', ad_system: 'google.com', relationship: 'DIRECT', cert: 'f08c47fec0942fa0', hint: 'pub-XXXXXXXXXXXXXXXX' },
  { label: 'Google Ad Manager', ad_system: 'google.com', relationship: 'DIRECT', cert: 'f08c47fec0942fa0', hint: 'pub-XXXXXXXXXXXXXXXX' },
  { label: 'Amazon (aps)', ad_system: 'aps.amazon.com', relationship: 'DIRECT', cert: '', hint: 'seller ID' },
  { label: 'Media.net', ad_system: 'media.net', relationship: 'DIRECT', cert: '', hint: '8CU...' },
  { label: 'Magnite/Rubicon', ad_system: 'rubiconproject.com', relationship: 'RESELLER', cert: '0bfd66d529a55807', hint: 'account ID' },
  { label: 'PubMatic', ad_system: 'pubmatic.com', relationship: 'RESELLER', cert: '5d62403b186f2ace', hint: 'publisher ID' },
]

export function AdsTxtManager({ isBase = false }: { isBase?: boolean }) {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'list' | 'bulk'>('list')
  const [bulkText, setBulkText] = useState('')
  const [bulkResult, setBulkResult] = useState<any>(null)
  const [preview, setPreview] = useState('')

  // Manual add form
  const [form, setForm] = useState({ ad_system: '', publisher_id: '', relationship: 'DIRECT', cert_authority_id: '', notes: '' })

  useEffect(() => { fetchSites() }, [])
  useEffect(() => { if (selectedSite) fetchEntries() }, [selectedSite])

  async function fetchSites() {
    try {
      const res = await fetch('/api/sites')
      if (res.ok) {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data.sites || data.data || [])
        const s = arr.map((x: any) => ({ id: x.id, name: x.name || x.site_url, site_url: x.site_url }))
        setSites(s)
        if (s.length && !selectedSite) setSelectedSite(s[0].id)
      }
    } catch { /* silent */ }
  }

  async function fetchEntries() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/ads-txt?site_id=${selectedSite}`)
      if (res.ok) setEntries(await res.json())
    } catch { /* silent */ }
    setLoading(false)
    buildPreview()
  }

  function buildPreview() {
    // Live preview of what the served ads.txt will look like
    const active = entries.filter(e => e.is_active)
    const lines = active.map(e => {
      let l = `${e.ad_system}, ${e.publisher_id}, ${e.relationship}`
      if (e.cert_authority_id) l += `, ${e.cert_authority_id}`
      return l
    })
    setPreview(lines.join('\n'))
  }

  useEffect(() => { buildPreview() }, [entries])

  async function addEntry() {
    if (!form.ad_system || !form.publisher_id) { toast.error('Ad system and publisher ID required'); return }
    const res = await fetch('/api/admin/ads-txt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, site_id: selectedSite, site_url: sites.find(s => s.id === selectedSite)?.site_url }),
    })
    if (res.ok) {
      toast.success('Entry added')
      setForm({ ad_system: '', publisher_id: '', relationship: 'DIRECT', cert_authority_id: '', notes: '' })
      fetchEntries()
    } else toast.error('Failed to add')
  }

  function applyPreset(p: typeof PRESETS[0]) {
    setForm(f => ({ ...f, ad_system: p.ad_system, relationship: p.relationship, cert_authority_id: p.cert }))
    toast.success(`${p.label} preset — now enter the publisher ID`)
  }

  async function toggleEntry(e: Entry) {
    await fetch('/api/admin/ads-txt', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id, is_active: !e.is_active }),
    })
    setEntries(prev => prev.map(x => x.id === e.id ? { ...x, is_active: !x.is_active } : x))
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this seller entry?')) return
    await fetch(`/api/admin/ads-txt?id=${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(x => x.id !== id))
    toast.success('Deleted')
  }

  async function submitBulk() {
    if (!bulkText.trim()) { toast.error('Paste an ads.txt block first'); return }
    setBulkResult(null)
    const res = await fetch('/api/admin/ads-txt', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: selectedSite, site_url: sites.find(s => s.id === selectedSite)?.site_url, raw: bulkText }),
    })
    const data = await res.json()
    if (res.ok) {
      setBulkResult(data)
      toast.success(`${data.inserted} added · ${data.skipped_duplicates} duplicates skipped`)
      setBulkText('')
      fetchEntries()
    } else toast.error(data.error || 'Parse failed')
  }

  const site = sites.find(s => s.id === selectedSite)
  const verifyUrl = site ? `${site.site_url.replace(/\/$/, '')}/ads.txt` : ''

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="font-display text-xl font-bold text-ink-950">🔐 ads.txt Manager</h2>
        <p className="text-sm text-ink-400 mt-1">Manage authorized sellers per publisher. Served live at each publisher's /ads.txt — no file uploads.</p>
      </div>

      {/* Site selector */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-ink-600">Publisher Site:</label>
        <select className="input w-auto min-w-[240px]" value={selectedSite} onChange={e => setSelectedSite(e.target.value)}>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name} — {s.site_url.replace(/^https?:\/\//, '')}</option>)}
        </select>
        {verifyUrl && (
          <a href={verifyUrl} target="_blank" rel="noreferrer"
            className="text-xs px-3 py-1.5 bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200 ml-auto">
            ↗ Verify live /ads.txt
          </a>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit">
        {[{ k: 'list', l: '📋 Entries' }, { k: 'bulk', l: '📥 Bulk Paste' }].map(m => (
          <button key={m.k} onClick={() => setMode(m.k as any)}
            className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${mode === m.k ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
            {m.l}
          </button>
        ))}
      </div>

      {/* BULK PASTE */}
      {mode === 'bulk' && (
        <div className="card p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-ink-900 text-sm">Paste ads.txt block from a demand partner</h3>
            <p className="text-xs text-ink-400 mt-1">Paste raw seller lines. New entries are appended, duplicates skipped, and CONTACT=/OWNERDOMAIN= variables extracted automatically.</p>
          </div>
          <textarea className="input font-mono text-xs resize-none" rows={10}
            value={bulkText} onChange={e => setBulkText(e.target.value)}
            placeholder={'google.com, pub-1234567890, DIRECT, f08c47fec0942fa0\nrubiconproject.com, 12345, RESELLER, 0bfd66d529a55807\nCONTACT=ads@publisher.com'} />
          <button onClick={submitBulk} className="btn-primary text-sm">📥 Parse & Append</button>
          {bulkResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs space-y-1">
              <p className="text-green-800 font-semibold">✓ Parsed {bulkResult.parsed} seller lines</p>
              <p className="text-green-700">{bulkResult.inserted} added · {bulkResult.skipped_duplicates} duplicates skipped</p>
              {bulkResult.variables_found > 0 && (
                <p className="text-green-700">{bulkResult.variables_found} variable(s) found{bulkResult.variables_updated ? ' and merged' : ' (already present)'}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ENTRIES LIST + MANUAL ADD */}
      {mode === 'list' && (
        <>
          {/* Manual add */}
          <div className="card p-5 space-y-4">
            <h3 className="font-semibold text-ink-900 text-sm">Add a seller entry</h3>
            {/* Presets */}
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => applyPreset(p)}
                  className="text-xs px-3 py-1.5 bg-ink-50 border border-ink-200 text-ink-700 rounded-lg hover:border-ink-300">
                  + {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Ad System</label><input className="input" value={form.ad_system} onChange={e => setForm(f => ({ ...f, ad_system: e.target.value }))} placeholder="google.com" /></div>
              <div><label className="label">Publisher / Seller ID</label><input className="input" value={form.publisher_id} onChange={e => setForm(f => ({ ...f, publisher_id: e.target.value }))} placeholder="pub-1234567890" /></div>
              <div>
                <label className="label">Relationship</label>
                <div className="flex gap-1 p-1 bg-ink-100 rounded-xl">
                  {['DIRECT', 'RESELLER'].map(r => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, relationship: r }))}
                      className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${form.relationship === r ? 'bg-white shadow text-ink-900' : 'text-ink-500'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label">Cert Authority ID <span className="text-ink-300">(optional)</span></label><input className="input font-mono text-xs" value={form.cert_authority_id} onChange={e => setForm(f => ({ ...f, cert_authority_id: e.target.value }))} placeholder="f08c47fec0942fa0" /></div>
              <div className="col-span-2"><label className="label">Notes <span className="text-ink-300">(internal — which deal/SSP)</span></label><input className="input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Q1 direct deal with BrandX" /></div>
            </div>
            <button onClick={addEntry} className="btn-primary text-sm">+ Add Entry</button>
          </div>

          {/* Entries table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 bg-ink-50 border-b border-ink-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-700">Authorized Sellers ({entries.length})</p>
            </div>
            {loading ? (
              <div className="h-24 bg-ink-50 animate-pulse" />
            ) : entries.length === 0 ? (
              <p className="text-xs text-ink-400 p-6 text-center">No entries for this publisher yet</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-ink-100">
                  <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Ad System</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Publisher ID</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Notes</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500">Active</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-ink-500"></th>
                </tr></thead>
                <tbody>
                  {entries.map(e => (
                    <tr key={e.id} className={`border-b border-ink-50 ${!e.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5 text-xs font-medium text-ink-900">{e.ad_system}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-ink-600">{e.publisher_id}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${e.relationship === 'DIRECT' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{e.relationship}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-400 truncate max-w-[160px]">{e.notes || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => toggleEntry(e)} className={`text-xs px-2 py-1 rounded-lg ${e.is_active ? 'bg-green-50 text-green-600' : 'bg-ink-100 text-ink-400'}`}>
                          {e.is_active ? '✓' : '○'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => deleteEntry(e.id)} className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Live preview */}
          {preview && (
            <div className="card p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink-900 text-sm">Live /ads.txt Preview</h3>
                <button onClick={() => { navigator.clipboard.writeText(preview); toast.success('Copied') }}
                  className="text-xs px-3 py-1.5 bg-ink-100 text-ink-700 rounded-lg hover:bg-ink-200">⎘ Copy</button>
              </div>
              <pre className="bg-ink-950 text-green-300 text-xs font-mono p-4 rounded-xl overflow-x-auto whitespace-pre-wrap">{preview}</pre>
              <p className="text-xs text-ink-400">This is served live at {verifyUrl || 'the publisher domain'}/ads.txt (plus any network base entries).</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
