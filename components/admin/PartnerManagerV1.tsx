'use client'
import { useState, useEffect } from 'react'

// Full management screen: register ad networks (partners), and for each,
// paste per-site/position/size tags with a manual serving order.
interface Partner { id: string; name: string; slug: string; waterfall_order: number; is_active: boolean; ad_code_template?: string }
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
                    order {p.waterfall_order} · {placements.filter(pl => pl.partner_id === p.id).length} tags
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
                    <p className="text-xs text-ink-400">slug: {selectedPartner.slug} · fires at order {selectedPartner.waterfall_order}</p>
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
  return (
    <Modal title="Add ad network" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Network name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PropellerAds" className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Default serving order (lower = fires first)</label>
          <input type="number" value={order} onChange={e => setOrder(e.target.value)} className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={() => name && onSave({ name, waterfall_order: order })} disabled={!name} className="btn-primary w-full py-2.5 disabled:opacity-50">Save network</button>
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
