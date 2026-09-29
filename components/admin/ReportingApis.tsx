'use client'
// components/admin/ReportingApis.tsx
// Configure each network's reporting API (for the Earnings sync). Admin only.
import { useEffect, useState } from 'react'

const blank = { adapter: 'generic', endpoint: '', auth_type: 'query', auth_name: 'key', api_key: '', date_format: 'YYYY-MM-DD', site_fallback: '', currency: 'USD', rows_path: '' }

export function ReportingApis() {
  const [partners, setPartners] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null) // { partner, form }
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [test, setTest] = useState<any>(null)
  const [busy, setBusy] = useState('')

  async function load() {
    const r = await fetch('/api/mediation/revenue/config', { cache: 'no-store' })
    const d = await r.json()
    if (!r.ok) { setErr(d.error || 'Failed to load'); return }
    setPartners(d.partners || [])
  }
  useEffect(() => { load() }, [])

  function open(p: any) {
    setMsg(''); setErr(''); setTest(null)
    const guess = /adsterra/i.test(p.slug) ? 'adsterra' : 'generic'
    setEditing({ partner: p, form: { ...blank, adapter: guess, ...(p.report || {}), api_key: '' } })
  }

  async function call(action: 'test' | 'save' | 'disable') {
    setBusy(action); setErr(''); setMsg(''); if (action !== 'save') setTest(null)
    try {
      const r = await fetch('/api/mediation/revenue/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, partner_id: editing.partner.id, report: editing.form }),
      })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Failed'); return }
      if (action === 'test') setTest(d)
      if (action === 'save') { setMsg(`Saved reporting settings for ${editing.partner.name}. Use “Sync now” on Earnings to pull revenue.`); setEditing(null); load() }
      if (action === 'disable') { setMsg(`Reporting turned off for ${editing.partner.name}.`); setEditing(null); load() }
    } finally { setBusy('') }
  }

  const f = editing?.form
  const set = (k: string, v: string) => setEditing({ ...editing, form: { ...editing.form, [k]: v } })
  const inp = 'border border-ink-200 rounded-lg px-3 py-2 text-sm w-full'
  const lab = 'block text-xs font-semibold uppercase tracking-wide text-ink-400 mb-1'

  return (
    <div className="space-y-6">
      {msg && <div className="card p-3 text-sm text-green-700">{msg}</div>}
      {err && !editing && <div className="card p-3 text-sm text-red-600">{err}</div>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2 text-ink-500 text-left">
              <th className="px-4 py-2 font-semibold">Network</th>
              <th className="px-4 py-2 font-semibold">Reporting</th>
              <th className="px-4 py-2 font-semibold">Last sync</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-400">No networks yet — add them under Ad Networks.</td></tr>}
            {partners.map(p => {
              const ls = p.last_sync
              return (
                <tr key={p.id} className="border-t border-ink-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{p.name}<div className="text-xs text-ink-400">{p.slug}</div></td>
                  <td className="px-4 py-3">
                    {!p.report ? <span className="text-ink-400">Not set up</span>
                      : p.placeholder ? <span className="text-amber-600">Example values — needs real settings</span>
                      : <span className="text-green-700">{p.report.adapter === 'adsterra' ? 'Adsterra API' : 'Generic API'}{p.has_key ? ' · key saved' : ' · no key'}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {!ls ? <span className="text-ink-400">Never</span>
                      : ls.status === 'failed' ? <span className="text-red-600" title={ls.error || ''}>Failed {new Date(ls.ran_at).toLocaleString('en-IN')} — {(ls.error || '').slice(0, 80)}</span>
                      : <span className="text-ink-600">{ls.status} · {ls.rows_ingested} rows · {new Date(ls.ran_at).toLocaleString('en-IN')}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => open(p)} className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1">{p.report ? 'Edit' : 'Set up'}</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card p-5 space-y-4 border-2 border-accent/20">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-ink-900">Reporting API — {editing.partner.name}</p>
            <button onClick={() => setEditing(null)} className="text-xs text-ink-400 hover:text-ink-600">✕ Close</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={lab}>Type</label>
              <select className={inp} value={f.adapter} onChange={e => set('adapter', e.target.value)}>
                <option value="adsterra">Adsterra (built-in)</option>
                <option value="generic">Any other network (generic)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={lab}>API key {editing.partner.has_key && <span className="normal-case font-normal text-green-700">— key saved; leave empty to keep it</span>}</label>
              <input className={inp + ' font-mono'} type="password" autoComplete="off" value={f.api_key} onChange={e => set('api_key', e.target.value)} placeholder={editing.partner.has_key ? '•••••••• (unchanged)' : 'Paste the API key'} />
            </div>
          </div>

          {f.adapter === 'generic' && (
            <>
              <div>
                <label className={lab}>Stats URL — use {'{start}'} and {'{end}'} where the dates go</label>
                <input className={inp + ' font-mono text-xs'} value={f.endpoint} onChange={e => set('endpoint', e.target.value)}
                  placeholder="https://api.network.com/publisher/stats?date_from={start}&date_to={end}" />
                <p className="text-xs text-ink-400 mt-1">Don’t put the key in this URL — it’s added automatically from the field above.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className={lab}>Key goes in</label>
                  <select className={inp} value={f.auth_type} onChange={e => set('auth_type', e.target.value)}>
                    <option value="query">URL parameter</option>
                    <option value="header">Header</option>
                  </select>
                </div>
                <div>
                  <label className={lab}>{f.auth_type === 'header' ? 'Header name' : 'Parameter name'}</label>
                  <input className={inp + ' font-mono'} value={f.auth_name} onChange={e => set('auth_name', e.target.value)} placeholder={f.auth_type === 'header' ? 'X-API-Key' : 'key'} />
                </div>
                <div>
                  <label className={lab}>Date format</label>
                  <select className={inp} value={f.date_format} onChange={e => set('date_format', e.target.value)}>
                    <option value="YYYY-MM-DD">2026-09-20</option>
                    <option value="YYYYMMDD">20260920</option>
                    <option value="YYYY/MM/DD">2026/09/20</option>
                  </select>
                </div>
                <div>
                  <label className={lab}>Currency</label>
                  <select className={inp} value={f.currency} onChange={e => set('currency', e.target.value)}>
                    <option>USD</option><option>INR</option><option>EUR</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={lab}>Site (if the report has no domain)</label>
                  <input className={inp} value={f.site_fallback} onChange={e => set('site_fallback', e.target.value)} placeholder="kannadadunia.com" />
                </div>
                <div className="col-span-2">
                  <label className={lab}>Rows path (optional, advanced)</label>
                  <input className={inp + ' font-mono'} value={f.rows_path} onChange={e => set('rows_path', e.target.value)} placeholder="auto-detected — e.g. result.items" />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-3">
            <button onClick={() => call('test')} disabled={!!busy} className="px-5 py-2.5 rounded-lg border border-ink-300 text-ink-700 hover:bg-surface-2 text-sm font-medium disabled:opacity-50">
              {busy === 'test' ? 'Testing…' : '⚡ Test connection'}
            </button>
            <button onClick={() => call('save')} disabled={!!busy} className="btn-primary px-5 py-2.5 disabled:opacity-50">
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            {editing.partner.report && (
              <button onClick={() => { if (confirm('Turn off revenue reporting for this network?')) call('disable') }} disabled={!!busy}
                className="ml-auto text-xs text-red-500 hover:text-red-600 px-2">Turn off reporting</button>
            )}
          </div>

          {err && <div className="text-sm text-red-600 break-words">{err}</div>}
          {test && (
            <div className={`rounded-lg p-3 text-sm ${test.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
              {test.ok ? (
                <>
                  <p className="font-medium">✓ Connected — {test.rows} row(s) for {test.range.start} → {test.range.end}{test.sites?.length ? ` · sites: ${test.sites.join(', ')}` : ''}</p>
                  {test.rows === 0 && <p className="text-xs mt-1">No data in the last 3 days. That’s fine if the network had no impressions; otherwise check the URL’s date parameters.</p>}
                  {test.preview?.length > 0 && (
                    <table className="w-full text-xs mt-2">
                      <thead><tr className="text-left text-green-900"><th>Date</th><th>Site</th><th className="text-right">Impressions</th><th className="text-right">Clicks</th><th className="text-right">Revenue</th></tr></thead>
                      <tbody>{test.preview.map((r: any, i: number) => (
                        <tr key={i}><td>{r.date}</td><td>{r.site}</td><td className="text-right">{r.impressions}</td><td className="text-right">{r.clicks}</td><td className="text-right">{r.revenue} {r.currency}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                  <p className="text-xs mt-2">Looks right? Click <b>Save</b>, then “Sync now” on Earnings.</p>
                </>
              ) : (
                <p className="break-words">✗ {test.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
