'use client'
import { useState, useEffect } from 'react'
// Full management screen: register ad networks (partners), and for each,
// paste per-site/position/size tags with a manual serving order.
interface Partner { id: string; name: string; slug: string; waterfall_order: number; is_active: boolean; ad_code_template?: string; _has_report_key?: boolean; _report_adapter?: string }
interface Placement {
  id: string; partner_id: string; site_url?: string; position?: string
  size_width?: number; size_height?: number; ad_code?: string
  waterfall_order?: number; is_active: boolean
}
const POSITIONS = ['in_content', 'header', 'footer', 'sidebar']
const COMMON_SIZES = ['300x250', '336x280', '728x90', '320x50', '300x600', '160x600']
export function PartnerManager() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [showPartnerForm, setShowPartnerForm] = useState(false)
  const [showPlacementForm, setShowPlacementForm] = useState(false)
  const [editingPlacement, setEditingPlacement] = useState<Placement | null>(null)
  const [msg, setMsg] = useState('')
  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/mediation/partners')
      const d = await r.json()
      setPartners(d.partners || [])
      setPlacements(d.placements || [])
      if (!selected && d.partners?.length) setSelected(d.partners[0].id)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  async function api(payload: any) {
    setMsg('')
    const r = await fetch('/api/mediation/partners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (!r.ok) { setMsg(d.error || 'Error'); return null }
    await load()
    return d
  }
  const partnerPlacements = placements.filter(p => p.partner_id === selected)
  const selectedPartner = partners.find(p => p.id === selected)
  return (
    <div className="space-y-6">
      {msg && <div className="card p-3 text-sm text-red-600">{msg}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ── Networks list ── */}
        <div className="card p-4 h-fit">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Ad Networks</p>
            <button onClick={() => setShowPartnerForm(true)} className="text-xs font-semibold text-red-500 hover:text-red-600">+ Add</button>
          </div>
          {loading ? <p className="text-sm text-ink-400">Loading…</p> : (
            <div className="space-y-1">
              {partners.map(p => (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selected === p.id ? 'bg-ink-900 text-white' : 'hover:bg-surface-2 text-ink-700'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-400'}`}>
                      {p.is_active ? 'on' : 'off'}
                    </span>
                  </div>
                  <span className={`text-[11px] ${selected === p.id ? 'text-ink-300' : 'text-ink-400'}`}>
                    order {p.waterfall_order} · {placements.filter(pl => pl.partner_id === p.id).length} tags{p._has_report_key ? ' · 📊 API' : ''}
                  </span>
                </button>
              ))}
              {partners.length === 0 && <p className="text-sm text-ink-400">No networks yet. Add one to start.</p>}
            </div>
          )}
        </div>
        {/* ── Selected network's placements ── */}
        <div className="space-y-4">
          {selectedPartner && (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-ink-900">{selectedPartner.name}</h3>
                    <p className="text-xs text-ink-400">
                      slug: {selectedPartner.slug} · fires at order {selectedPartner.waterfall_order}
                      {selectedPartner._has_report_key ? ` · reporting: ${selectedPartner._report_adapter}` : ' · no reporting API'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => api({ action: 'partner', id: selectedPartner.id, name: selectedPartner.name, slug: selectedPartner.slug, waterfall_order: selectedPartner.waterfall_order, is_active: !selectedPartner.is_active })}
                      className="text-xs px-3 py-1.5 rounded-lg border border-ink-200 hover:border-ink-400">
                      {selectedPartner.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => { if (confirm('Delete this network and all its tags?')) api({ action: 'delete_partner', id: selectedPartner.id }) }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                </div>
              </div>
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
                  <p className="text-sm font-medium text-ink-700">Tags for this network</p>
                  <button onClick={() => { setEditingPlacement(null); setShowPlacementForm(true) }}
                    className="btn-primary text-xs px-3 py-1.5">+ Add tag</button>
                </div>
                {partnerPlacements.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-ink-400">No tags yet. Add a tag scoped to a site + position + size.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-surface-2 text-ink-500 text-left">
                          <th className="px-4 py-2 font-semibold">Site</th>
                          <th className="px-4 py-2 font-semibold">Position</th>
                          <th className="px-4 py-2 font-semibold">Size</th>
                          <th className="px-4 py-2 font-semibold">Order</th>
                          <th className="px-4 py-2 font-semibold">Status</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {partnerPlacements.map(pl => (
                          <tr key={pl.id} className="border-t border-ink-50">
                            <td className="px-4 py-2.5 text-ink-800">{pl.site_url || <span className="text-ink-300">all sites</span>}</td>
                            <td className="px-4 py-2.5 text-ink-600">{pl.position || 'all'}</td>
                            <td className="px-4 py-2.5 text-ink-600">{pl.size_width ? `${pl.size_width}x${pl.size_height}` : 'any'}</td>
                            <td className="px-4 py-2.5 text-ink-600">{pl.waterfall_order ?? '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${pl.is_active ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-400'}`}>{pl.is_active ? 'on' : 'off'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <button onClick={() => { setEditingPlacement(pl); setShowPlacementForm(true) }} className="text-xs text-ink-500 hover:text-ink-900 mr-3">Edit</button>
                              <button onClick={() => { if (confirm('Delete this tag?')) api({ action: 'delete_placement', id: pl.id }) }} className="text-xs text-red-500 hover:text-red-600">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
          {!selectedPartner && !loading && <div className="card p-10 text-center text-ink-400 text-sm">Select or add an ad network to manage its tags.</div>}
        </div>
      </div>
      {showPartnerForm && <PartnerForm onClose={() => setShowPartnerForm(false)} onSave={async (data) => { await api({ action: 'partner', ...data }); setShowPartnerForm(false) }} />}
      {showPlacementForm && selected && (
        <PlacementForm partnerId={selected} placement={editingPlacement}
          onClose={() => setShowPlacementForm(false)}
          onSave={async (data) => { await api({ action: 'placement', partner_id: selected, ...(editingPlacement ? { id: editingPlacement.id } : {}), ...data }); setShowPlacementForm(false) }} />
      )}
    </div>
  )
}
function Modal({ children, onClose, title }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg text-ink-900">{title}</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}


function PartnerForm({ onClose, onSave }: any) {
  const [name, setName] = useState('')
  const [order, setOrder] = useState('100')
  const [adapter, setAdapter] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [authType, setAuthType] = useState('header')
  const [authName, setAuthName] = useState('')
  const [siteFallback, setSiteFallback] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testing, setTesting] = useState(false)

  function payload() {
    const base: any = { name, waterfall_order: order }
    if (adapter) {
      base.report_adapter = adapter
      base.report_api_key = apiKey || undefined
      if (adapter === 'generic') {
        Object.assign(base, {
          report_endpoint: endpoint, report_date_format: dateFormat,
          report_auth_type: authType, report_auth_name: authName,
          report_site_fallback: siteFallback,
        })
      }
    }
    return base
  }

  async function testConnection() {
    setTesting(true); setTestMsg('')
    try {
      const r = await fetch('/api/mediation/revenue/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const d = await r.json()
      if (d.ok) setTestMsg(`✓ Pulled ${d.rows} row(s). Sample: ${JSON.stringify(d.sample || {}).slice(0, 180)}`)
      else setTestMsg(`✗ ${d.error || 'Test failed'}`)
    } catch { setTestMsg('✗ Test request failed') }
    finally { setTesting(false) }
  }

  return (
    <Modal title="Add ad network" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Network name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ValueImpression" className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Serving order (lower = fires first)</label>
          <input type="number" value={order} onChange={e => setOrder(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="border-t border-ink-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400 mb-2">Reporting API (optional)</p>
          <label className="block text-sm font-medium text-ink-700 mb-1">Adapter</label>
          <select value={adapter} onChange={e => setAdapter(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm">
            <option value="">None</option>
            <option value="generic">Generic REST API (auto-detect)</option>
            <option value="adsterra">Adsterra (built-in)</option>
          </select>

          {adapter === 'adsterra' && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-ink-700 mb-1">API key / token</label>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="paste token" className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
          )}

          {adapter === 'generic' && (
            <div className="mt-3 space-y-3 bg-surface-2 rounded-lg p-3">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">API URL (use {'{start}'} and {'{end}'} for the dates)</label>
                <input value={endpoint} onChange={e => setEndpoint(e.target.value)}
                  placeholder="https://apps.valueimpression.com/report/api-report-publisher/?from={start}&to={end}"
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-xs font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Date format</label>
                  <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className="w-full border border-ink-200 rounded-lg px-2 py-2 text-xs">
                    <option value="YYYY-MM-DD">2023-11-01</option>
                    <option value="YYYYMMDD">20231101</option>
                    <option value="YYYY/MM/DD">2023/11/01</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Auth location</label>
                  <select value={authType} onChange={e => setAuthType(e.target.value)} className="w-full border border-ink-200 rounded-lg px-2 py-2 text-xs">
                    <option value="header">Header</option>
                    <option value="query">URL param</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">Auth name</label>
                  <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Token-Key" className="w-full border border-ink-200 rounded-lg px-2 py-2 text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-700 mb-1">API key</label>
                  <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="a23f588c…" className="w-full border border-ink-200 rounded-lg px-2 py-2 text-xs font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Site (only if the API doesn't return one)</label>
                <input value={siteFallback} onChange={e => setSiteFallback(e.target.value)} placeholder="optional" className="w-full border border-ink-200 rounded-lg px-2 py-2 text-xs font-mono" />
              </div>
              <button onClick={testConnection} disabled={testing || !endpoint || !authName}
                className="text-xs px-3 py-1.5 rounded-lg border border-ink-300 bg-white hover:bg-ink-50 disabled:opacity-50">
                {testing ? 'Testing…' : 'Test connection'}
              </button>
              {testMsg && <p className={`text-[11px] mt-1 break-all ${testMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{testMsg}</p>}
              <p className="text-[11px] text-ink-400">The system auto-detects revenue, impressions, clicks, date and site fields from the response.</p>
            </div>
          )}
        </div>

        <button onClick={() => name && onSave(payload())} disabled={!name} className="btn-primary w-full py-2.5 disabled:opacity-50">Save network</button>
      </div>
    </Modal>
  )
}
function PlacementForm({ partnerId, placement, onClose, onSave }: any) {
  const [site, setSite] = useState(placement?.site_url || '')
  const [position, setPosition] = useState(placement?.position || 'in_content')
  const [size, setSize] = useState(placement?.size_width ? `${placement.size_width}x${placement.size_height}` : '300x250')
  const [order, setOrder] = useState(placement?.waterfall_order?.toString() || '')
  const [code, setCode] = useState(placement?.ad_code || '')
  const [active, setActive] = useState(placement?.is_active !== false)
  function save() {
    const [w, h] = size.split('x').map(s => parseInt(s, 10))
    onSave({ site_url: site, position, size_width: w, size_height: h, ad_code: code, waterfall_order: order, is_active: active })
  }
  return (
    <Modal title={placement ? 'Edit tag' : 'Add tag'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Site (leave blank for all sites)</label>
          <input value={site} onChange={e => setSite(e.target.value)} placeholder="kannadadunia.com" className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Position</label>
            <select value={position} onChange={e => setPosition(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm">
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Size</label>
            <select value={size} onChange={e => setSize(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm">
              {COMMON_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Serving order for this tag (optional — overrides network default)</label>
          <input type="number" value={order} onChange={e => setOrder(e.target.value)} placeholder="e.g. 10" className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Ad tag (paste the network's code)</label>
          <textarea value={code} onChange={e => setCode(e.target.value)} rows={5} placeholder="Paste the tag you generated on the network for this site+size…"
            className="w-full border border-ink-200 rounded-lg px-3 py-2 text-xs font-mono" />
          <p className="text-[11px] text-ink-400 mt-1">Tip: you can use {'{{WIDTH}}'} and {'{{HEIGHT}}'} placeholders — they'll be filled with the slot size.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Active
        </label>
        <button onClick={save} disabled={!code} className="btn-primary w-full py-2.5 disabled:opacity-50">Save tag</button>
      </div>
    </Modal>
  )
}
