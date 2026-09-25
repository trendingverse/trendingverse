'use client'
// app/(admin)/admin/monetization/ad-units/page.tsx
import { useEffect, useState } from 'react'

const API = '/api/tvads/admin'
const PLUGIN_ZIP_NOTE = 'Publisher installs the TrendingVerse Ads plugin and pastes this key in Settings → TrendingVerse Ads.'

const card: any = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const input: any = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--txt)', fontSize: 13, width: '100%', boxSizing: 'border-box' }
const label: any = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--txt-3)', display: 'block', marginBottom: 6 }
const btn: any = { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--txt)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnPrimary: any = { ...btn, background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
const pill = (bg: string, color: string): any => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color })

const SIZES = ['300x250', '336x280', '320x50', '320x100', '728x90', '970x90', '970x250', '300x600', '160x600', '320x480']

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}
function campStatus(c: any): string {
  if (!c.enabled) return 'Paused'
  const now = Date.now()
  if (c.start_at && now < new Date(c.start_at).getTime()) return 'Scheduled'
  if (c.end_at && now >= new Date(c.end_at).getTime()) return 'Ended'
  return 'Live'
}
function statusPill(s: string) {
  const m: Record<string, [string, string]> = {
    Live: ['rgba(16,185,129,0.14)', '#34d399'],
    Scheduled: ['rgba(245,158,11,0.14)', '#fbbf24'],
    Ended: ['var(--bg-subtle)', 'var(--txt-3)'],
    Paused: ['var(--bg-subtle)', 'var(--txt-3)'],
  }
  const [bg, c] = m[s] || m.Paused
  return <span style={pill(bg, c)}>{s}</span>
}

async function call(method: 'GET' | 'POST', qs: string, body?: any) {
  const r = await fetch(API + qs, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const j = await r.json().catch(() => ({ ok: false, error: 'Bad response' }))
  if (!j.ok) throw new Error(j.error || 'Request failed')
  return j
}

const blankSite = () => ({ id: '', name: '', domain: '', publisher_emails: '', enabled: true, settings: {} as any })
const blankUnit = () => ({ id: '', name: '', enabled: true, placement: 'after_para', para: 1, size: '300x250', device: 'all', net_code: '', net_mode: 'auto', sort: 0, campaigns: [] as any[] })
const blankCamp = () => ({ id: '', name: '', enabled: true, type: 'image', code: '', mode: 'auto', img: '', url: '', pixel: '', start_at: null, end_at: null })

export default function AdUnitsPage() {
  const [sites, setSites] = useState<any[]>([])
  const [meta, setMeta] = useState<any>({ placements: {}, devices: {}, defaults: {} })
  const [siteId, setSiteId] = useState('')
  const [site, setSite] = useState<any>(null)
  const [units, setUnits] = useState<any[]>([])
  const [edit, setEdit] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const flash = (m: string) => { setMsg(m); setErr(''); setTimeout(() => setMsg(''), 3000) }
  const fail = (e: any) => { setErr(e?.message || String(e)); setMsg('') }

  async function loadSites(selectId?: string) {
    try {
      const j = await call('GET', '?op=sites')
      setSites(j.sites)
      setMeta({ placements: j.placements, devices: j.devices, defaults: j.defaults })
      const id = selectId || siteId || j.sites[0]?.id || ''
      selectSite(id, j.sites)
    } catch (e) { fail(e) }
  }

  function selectSite(id: string, list = sites) {
    setSiteId(id)
    setEdit(null)
    const s = list.find((x: any) => x.id === id)
    setSite(s ? { ...s, publisher_emails: (s.publisher_emails || []).join(', ') } : null)
    if (id) loadUnits(id)
    else setUnits([])
  }

  async function loadUnits(id: string) {
    try { const j = await call('GET', `?op=units&site=${id}`); setUnits(j.units) } catch (e) { fail(e) }
  }

  useEffect(() => { loadSites() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSite() {
    setBusy(true)
    try {
      const j = await call('POST', '', { op: 'site_save', site })
      flash(site.id ? 'Site saved' : 'Site created with the standard 5 ad units')
      await loadSites(j.id)
    } catch (e) { fail(e) }
    setBusy(false)
  }

  async function rekey() {
    if (!confirm('Generate a new key? The plugin on this site will stop serving until the new key is pasted in.')) return
    try { await call('POST', '', { op: 'site_rekey', id: site.id }); flash('New key generated'); await loadSites(site.id) } catch (e) { fail(e) }
  }

  async function saveUnit() {
    setBusy(true)
    try {
      await call('POST', '', { op: 'unit_save', site_id: siteId, unit: edit })
      flash('Ad unit saved — live on the site within about a minute')
      setEdit(null)
      await loadUnits(siteId)
    } catch (e) { fail(e) }
    setBusy(false)
  }

  async function archiveUnit(id: string) {
    if (!confirm('Remove this ad unit? Its report history is kept.')) return
    try { await call('POST', '', { op: 'unit_archive', id }); flash('Ad unit removed'); setEdit(null); await loadUnits(siteId) } catch (e) { fail(e) }
  }

  const setS = (k: string, v: any) => setSite({ ...site, [k]: v })
  const setSt = (k: string, v: any) => setSite({ ...site, settings: { ...(site.settings || {}), [k]: v } })
  const st = { ...(meta.defaults || {}), ...(site?.settings || {}) }
  const setU = (k: string, v: any) => setEdit({ ...edit, [k]: v })
  const setC = (i: number, k: string, v: any) => {
    const c = [...edit.campaigns]
    c[i] = { ...c[i], [k]: v }
    setEdit({ ...edit, campaigns: c })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 40, color: 'var(--txt)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Ad Units</h1>
          <p style={{ fontSize: 12, color: 'var(--txt-3)', marginTop: 4 }}>Network ads always serve. A direct campaign takes over its unit only between its start and end time.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ ...input, width: 240 }} value={siteId} onChange={e => selectSite(e.target.value)}>
            {sites.length === 0 && <option value="">No sites yet</option>}
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.enabled ? '' : ' (off)'}</option>)}
          </select>
          <button style={btn} onClick={() => { setSiteId(''); setUnits([]); setEdit(null); setSite(blankSite()) }}>+ Add site</button>
        </div>
      </div>

      {msg && <div style={{ ...card, padding: 12, borderColor: '#34d399', color: '#34d399', fontSize: 13 }}>{msg}</div>}
      {err && <div style={{ ...card, padding: 12, borderColor: '#f87171', color: '#f87171', fontSize: 13 }}>{err}</div>}

      {site && (
        <div style={card}>
          <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 14px' }}>{site.id ? 'Publisher site' : 'New publisher site'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <div><span style={label}>Site name</span><input style={input} value={site.name} onChange={e => setS('name', e.target.value)} placeholder="Kannada Dunia" /></div>
            <div><span style={label}>Domain</span><input style={input} value={site.domain} onChange={e => setS('domain', e.target.value)} placeholder="kannadadunia.com" /></div>
            <div style={{ gridColumn: 'span 2' }}><span style={label}>Publisher login emails (see reports)</span><input style={input} value={site.publisher_emails} onChange={e => setS('publisher_emails', e.target.value)} placeholder="owner@site.com, editor@site.com" /></div>
            <div><span style={label}>Ad label</span><input style={input} value={st.label || ''} onChange={e => setSt('label', e.target.value)} /></div>
            <div><span style={label}>Long article: min words</span><input type="number" style={input} value={st.longWords} onChange={e => setSt('longWords', e.target.value)} /></div>
            <div><span style={label}>Long article: min paragraphs</span><input type="number" style={input} value={st.longMinParas} onChange={e => setSt('longMinParas', e.target.value)} /></div>
            <div><span style={label}>Interstitial: once every (min)</span><input type="number" style={input} value={st.interFreq} onChange={e => setSt('interFreq', e.target.value)} /></div>
            <div><span style={label}>Interstitial: close after (sec)</span><input type="number" style={input} value={st.interDelay} onChange={e => setSt('interDelay', e.target.value)} /></div>
            <div><span style={label}>Interstitial: from pageview</span><input type="number" style={input} value={st.interMinPv} onChange={e => setSt('interMinPv', e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap', fontSize: 13 }}>
            <label><input type="checkbox" checked={site.enabled !== false} onChange={e => setS('enabled', e.target.checked)} /> Ads enabled on this site</label>
            <label><input type="checkbox" checked={!!st.trackLoggedIn} onChange={e => setSt('trackLoggedIn', e.target.checked)} /> Count logged-in WordPress users</label>
          </div>
          {site.id && (
            <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'var(--bg-subtle)', fontSize: 13 }}>
              <span style={label}>Site key</span>
              <code style={{ fontSize: 14, fontWeight: 700 }}>{site.site_key}</code>
              <button style={{ ...btn, marginLeft: 10, padding: '4px 10px' }} onClick={() => { navigator.clipboard?.writeText(site.site_key); flash('Key copied') }}>Copy</button>
              <button style={{ ...btn, marginLeft: 6, padding: '4px 10px' }} onClick={rekey}>Regenerate</button>
              <p style={{ fontSize: 12, color: 'var(--txt-3)', margin: '8px 0 0' }}>{PLUGIN_ZIP_NOTE}</p>
            </div>
          )}
          <div style={{ marginTop: 16 }}><button style={btnPrimary} disabled={busy} onClick={saveSite}>{site.id ? 'Save site' : 'Create site'}</button></div>
        </div>
      )}

      {siteId && !edit && (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Ad units — {site?.name}</p>
            <button style={btnPrimary} onClick={() => setEdit({ ...blankUnit(), sort: units.length })}>+ Add ad unit</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--txt-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {['Name', 'Placement', 'Size', 'Device', 'Network', 'Direct', 'Serving now', ''].map(h => <th key={h} style={{ padding: '10px 20px', fontWeight: 700 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {units.length === 0 && <tr><td colSpan={8} style={{ padding: 20, color: 'var(--txt-3)' }}>No ad units yet.</td></tr>}
                {units.map(u => {
                  const live = u.campaigns.filter((c: any) => campStatus(c) === 'Live')
                  const sch = u.campaigns.filter((c: any) => campStatus(c) === 'Scheduled').length
                  const hasNet = !!String(u.net_code || '').trim()
                  const now = !u.enabled ? statusPill('Paused')
                    : live.length ? <span style={pill('rgba(59,130,246,0.14)', '#60a5fa')}>Direct: {live[0].name}{live.length > 1 ? ` +${live.length - 1}` : ''}</span>
                    : hasNet ? <span style={pill('rgba(16,185,129,0.14)', '#34d399')}>Network</span>
                    : <span style={pill('var(--bg-subtle)', 'var(--txt-3)')}>Nothing to serve</span>
                  const place = u.placement === 'after_para' ? `After paragraph ${u.para}` : (meta.placements[u.placement] || u.placement)
                  return (
                    <tr key={u.id} style={{ borderTop: '1px solid var(--border-dim, var(--border))' }}>
                      <td style={{ padding: '10px 20px', fontWeight: 700 }}>{u.name}</td>
                      <td style={{ padding: '10px 20px' }}>{place}{u.placement === 'shortcode' && <div><code style={{ fontSize: 11 }}>[tvas_ad id=&quot;{u.id}&quot;]</code></div>}</td>
                      <td style={{ padding: '10px 20px' }}>{u.size}</td>
                      <td style={{ padding: '10px 20px' }}>{meta.devices[u.device] || u.device}</td>
                      <td style={{ padding: '10px 20px' }}>{hasNet ? '✓' : '—'}</td>
                      <td style={{ padding: '10px 20px' }}>{live.length ? `${live.length} live` : ''}{live.length && sch ? ', ' : ''}{sch ? `${sch} scheduled` : ''}{!live.length && !sch ? '—' : ''}</td>
                      <td style={{ padding: '10px 20px' }}>{now}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                        <button style={{ ...btn, padding: '4px 12px' }} onClick={() => setEdit(JSON.parse(JSON.stringify(u)))}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{edit.id ? `Edit: ${edit.name}` : 'New ad unit'} — {site?.name}</p>
              <button style={btn} onClick={() => setEdit(null)}>← Back to units</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
              <div><span style={label}>Name</span><input style={input} value={edit.name} onChange={e => setU('name', e.target.value)} /></div>
              <div><span style={label}>Placement</span>
                <select style={input} value={edit.placement} onChange={e => setU('placement', e.target.value)}>
                  {Object.entries(meta.placements).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {edit.placement === 'after_para' && <div><span style={label}>Paragraph number</span><input type="number" min={1} style={input} value={edit.para} onChange={e => setU('para', e.target.value)} /></div>}
              <div><span style={label}>Size (WxH)</span><input style={input} list="tvads-sizes" value={edit.size} onChange={e => setU('size', e.target.value)} />
                <datalist id="tvads-sizes">{SIZES.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div><span style={label}>Device</span>
                <select style={input} value={edit.device} onChange={e => setU('device', e.target.value)}>
                  {Object.entries(meta.devices).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <label style={{ display: 'block', marginTop: 12, fontSize: 13 }}><input type="checkbox" checked={edit.enabled !== false} onChange={e => setU('enabled', e.target.checked)} /> Unit enabled</label>
          </div>

          <div style={card}>
            <p style={{ fontSize: 14, fontWeight: 800, margin: '0 0 4px' }}>Network ad</p>
            <p style={{ fontSize: 12, color: 'var(--txt-3)', margin: '0 0 10px' }}>Always on — serves whenever no direct campaign is live.</p>
            <textarea style={{ ...input, minHeight: 120, fontFamily: 'monospace', fontSize: 12 }} value={edit.net_code} onChange={e => setU('net_code', e.target.value)} placeholder="Paste the network ad tag" />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <span style={{ ...label, margin: 0 }}>Render</span>
              <select style={{ ...input, width: 320 }} value={edit.net_mode} onChange={e => setU('net_mode', e.target.value)}>
                <option value="auto">Auto</option>
                <option value="inline">Inline (most ad tags)</option>
                <option value="iframe">Isolated iframe (for tags that break the page)</option>
              </select>
            </div>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Direct campaigns</p>
                <p style={{ fontSize: 12, color: 'var(--txt-3)', margin: '4px 0 0' }}>Take over this unit only between start and end. If several are live, they rotate. Times are in your local time.</p>
              </div>
              <button style={btn} onClick={() => setEdit({ ...edit, campaigns: [...edit.campaigns, blankCamp()] })}>+ Add campaign</button>
            </div>
            {edit.campaigns.length === 0 && <p style={{ fontSize: 13, color: 'var(--txt-3)' }}>No direct campaigns.</p>}
            {edit.campaigns.map((c: any, i: number) => (
              <div key={c.id || `new-${i}`} style={{ border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', borderRadius: 10, padding: 14, marginTop: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, alignItems: 'end' }}>
                  <div><span style={label}>Campaign / advertiser</span><input style={input} value={c.name} onChange={e => setC(i, 'name', e.target.value)} /></div>
                  <div><span style={label}>Start</span><input type="datetime-local" style={input} value={toLocalInput(c.start_at)} onChange={e => setC(i, 'start_at', fromLocalInput(e.target.value))} /></div>
                  <div><span style={label}>End</span><input type="datetime-local" style={input} value={toLocalInput(c.end_at)} onChange={e => setC(i, 'end_at', fromLocalInput(e.target.value))} /></div>
                  <div><span style={label}>Creative</span>
                    <select style={input} value={c.type} onChange={e => setC(i, 'type', e.target.value)}>
                      <option value="image">Image + click URL</option>
                      <option value="code">Ad tag / HTML</option>
                    </select>
                  </div>
                </div>
                {c.type === 'image' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, marginTop: 12 }}>
                    <div><span style={label}>Image URL</span><input style={input} value={c.img} onChange={e => setC(i, 'img', e.target.value)} placeholder="https://..." /></div>
                    <div><span style={label}>Click URL</span><input style={input} value={c.url} onChange={e => setC(i, 'url', e.target.value)} placeholder="https://..." /></div>
                    <div><span style={label}>Impression pixel (optional)</span><input style={input} value={c.pixel} onChange={e => setC(i, 'pixel', e.target.value)} placeholder="https://..." /></div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <textarea style={{ ...input, minHeight: 100, fontFamily: 'monospace', fontSize: 12 }} value={c.code} onChange={e => setC(i, 'code', e.target.value)} placeholder="Paste the direct ad tag" />
                    <select style={{ ...input, width: 320, marginTop: 8 }} value={c.mode} onChange={e => setC(i, 'mode', e.target.value)}>
                      <option value="auto">Render: Auto</option>
                      <option value="inline">Render: Inline (most ad tags)</option>
                      <option value="iframe">Render: Isolated iframe</option>
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12, fontSize: 13 }}>
                  {c.id ? statusPill(campStatus(c)) : <span style={pill('rgba(245,158,11,0.14)', '#fbbf24')}>New</span>}
                  <label><input type="checkbox" checked={c.enabled !== false} onChange={e => setC(i, 'enabled', e.target.checked)} /> Active</label>
                  <button style={{ ...btn, marginLeft: 'auto', color: '#f87171', padding: '4px 10px' }} onClick={() => setEdit({ ...edit, campaigns: edit.campaigns.filter((_: any, j: number) => j !== i) })}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnPrimary} disabled={busy} onClick={saveUnit}>{edit.id ? 'Save ad unit' : 'Create ad unit'}</button>
            <button style={btn} onClick={() => setEdit(null)}>Cancel</button>
            {edit.id && <button style={{ ...btn, marginLeft: 'auto', color: '#f87171' }} onClick={() => archiveUnit(edit.id)}>Remove unit</button>}
          </div>
        </div>
      )}
    </div>
  )
}
