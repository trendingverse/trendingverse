'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { PublisherAdAssignment } from '@/components/admin/PublisherAdAssignment'

interface AdUnit {
  id: string; name: string; ad_type: 'gam' | 'direct'; position: string
  ad_code: string; gam_network_code?: string; gam_unit_path?: string
  size_width: number; size_height: number; is_active: boolean
}
interface AdsTxtEntry {
  id: string; domain: string; publisher_id: string; relationship: string
  certification_authority_id?: string; notes?: string
}
interface RevenueReport {
  report_date: string; impressions: number; clicks: number
  revenue_usd: number; publisher_earnings_usd: number; platform_earnings_usd: number
  sites?: { name: string }; ad_units?: { name: string; position: string }
}
interface RevenueStats {
  totalRevenue: number; totalImpressions: number; totalClicks: number
  publisherEarnings: number; platformEarnings: number
}

const POSITIONS = ['header', 'footer', 'in_content', 'sidebar']
const SIZES = [
  { label: 'Leaderboard 728×90', w: 728, h: 90 },
  { label: 'Medium Rectangle 300×250', w: 300, h: 250 },
  { label: 'Half Page 300×600', w: 300, h: 600 },
  { label: 'Large Rectangle 336×280', w: 336, h: 280 },
  { label: 'Mobile Banner 320×50', w: 320, h: 50 },
]

export function MonetizationPanel({ isAdmin = false }: { isAdmin?: boolean }) {
  const [tab, setTab] = useState<'ad_units' | 'assign' | 'ads_txt' | 'revenue'>('ad_units')

  // Ad units state
  const [adUnits, setAdUnits] = useState<AdUnit[]>([])
  const [showAdForm, setShowAdForm] = useState(false)
  const [adForm, setAdForm] = useState({ name: '', ad_type: 'direct', position: 'in_content', ad_code: '', gam_network_code: '', gam_unit_path: '', size_width: 728, size_height: 90 })

  // Ads.txt state
  const [adsTxt, setAdsTxt] = useState<AdsTxtEntry[]>([])
  const [showTxtForm, setShowTxtForm] = useState(false)
  const [txtForm, setTxtForm] = useState({ domain: '', publisher_id: '', relationship: 'DIRECT', certification_authority_id: '', notes: '' })
  const [pushing, setPushing] = useState(false)

  // Revenue state
  const [revenue, setRevenue] = useState<{ reports: RevenueReport[]; stats: RevenueStats; ctr: number; ecpm: number } | null>(null)
  const [period, setPeriod] = useState('30')
  const [showRevenueForm, setShowRevenueForm] = useState(false)
  const [revForm, setRevForm] = useState({ publisher_id: '', report_date: new Date().toISOString().split('T')[0], impressions: '', clicks: '', revenue_usd: '', revenue_share_pct: '70', network: 'GAM' })

  useEffect(() => { fetchAdUnits(); fetchAdsTxt(); fetchRevenue() }, [])
  useEffect(() => { fetchRevenue() }, [period])

  async function fetchAdUnits() {
    const res = await fetch('/api/monetization/ad-units')
    if (res.ok) setAdUnits(await res.json())
  }
  async function fetchAdsTxt() {
    const res = await fetch('/api/monetization/ads-txt')
    if (res.ok) setAdsTxt(await res.json())
  }
  async function fetchRevenue() {
    const res = await fetch(`/api/monetization/revenue?period=${period}`)
    if (res.ok) setRevenue(await res.json())
  }

  async function createAdUnit() {
    const res = await fetch('/api/monetization/ad-units', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adForm)
    })
    if (res.ok) { toast.success('Ad unit created'); setShowAdForm(false); fetchAdUnits(); setAdForm({ name: '', ad_type: 'direct', position: 'in_content', ad_code: '', gam_network_code: '', gam_unit_path: '', size_width: 728, size_height: 90 }) }
    else toast.error('Failed to create ad unit')
  }

  async function deleteAdUnit(id: string) {
    if (!confirm('Delete this ad unit?')) return
    await fetch('/api/monetization/ad-units', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast.success('Deleted'); fetchAdUnits()
  }

  async function addAdsTxt() {
    const res = await fetch('/api/monetization/ads-txt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(txtForm)
    })
    if (res.ok) { toast.success('Entry added'); setShowTxtForm(false); fetchAdsTxt(); setTxtForm({ domain: '', publisher_id: '', relationship: 'DIRECT', certification_authority_id: '', notes: '' }) }
    else toast.error('Failed to add entry')
  }

  async function pushAdsTxt() {
    setPushing(true)
    const res = await fetch('/api/monetization/ads-txt/push', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
    })
    const data = await res.json()
    toast.success(`Pushed to ${data.successful}/${data.total_sites} sites`)
    setPushing(false)
  }

  async function addRevenue() {
    const res = await fetch('/api/monetization/revenue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...revForm, impressions: parseInt(revForm.impressions), clicks: parseInt(revForm.clicks), revenue_usd: parseFloat(revForm.revenue_usd), revenue_share_pct: parseInt(revForm.revenue_share_pct) })
    })
    if (res.ok) { toast.success('Revenue report added'); setShowRevenueForm(false); fetchRevenue() }
    else toast.error('Failed to add report')
  }

  const tabs = [
    { key: 'ad_units', label: '📢 Ad Units' },
    ...(isAdmin ? [{ key: 'assign', label: '🎯 Assign to Publishers' }] : []),
    { key: 'ads_txt', label: '📄 ads.txt' },
    { key: 'revenue', label: '💰 Revenue' },
  ] as { key: 'ad_units' | 'assign' | 'ads_txt' | 'revenue'; label: string }[]

  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 bg-ink-100 rounded-xl w-fit overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white shadow text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* AD UNITS */}
      {tab === 'ad_units' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">Ad Units</h3>
              <p className="text-xs text-ink-400">Create and manage ad slots — assign them to publishers with custom revenue splits</p>
            </div>
            {isAdmin && (
              <button onClick={() => setShowAdForm(!showAdForm)} className="btn-primary btn-sm">
                + New Ad Unit
              </button>
            )}
          </div>

          {showAdForm && isAdmin && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h4 className="font-semibold text-ink-900">Create Ad Unit</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={adForm.name} onChange={e => setAdForm({...adForm, name: e.target.value})} placeholder="e.g. In-content 300x250"/>
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={adForm.ad_type} onChange={e => setAdForm({...adForm, ad_type: e.target.value as 'gam' | 'direct'})}>
                    <option value="direct">Direct (paste ad code)</option>
                    <option value="gam">Google Ad Manager (GAM)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Position</label>
                  <select className="input" value={adForm.position} onChange={e => setAdForm({...adForm, position: e.target.value})}>
                    {POSITIONS.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Size</label>
                  <select className="input" onChange={e => {
                    const s = SIZES[parseInt(e.target.value)]
                    setAdForm({...adForm, size_width: s.w, size_height: s.h})
                  }}>
                    {SIZES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {adForm.ad_type === 'gam' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">GAM Network Code</label>
                    <input className="input font-mono text-xs" value={adForm.gam_network_code} onChange={e => setAdForm({...adForm, gam_network_code: e.target.value})} placeholder="123456789"/>
                  </div>
                  <div>
                    <label className="label">GAM Ad Unit Path</label>
                    <input className="input font-mono text-xs" value={adForm.gam_unit_path} onChange={e => setAdForm({...adForm, gam_unit_path: e.target.value})} placeholder="/123456/unit-name"/>
                  </div>
                </div>
              )}
              <div>
                <label className="label">Ad Code {adForm.ad_type === 'direct' ? '(paste full JS tag)' : '(optional override)'}</label>
                <textarea className="input font-mono text-xs resize-none" rows={4}
                  value={adForm.ad_code} onChange={e => setAdForm({...adForm, ad_code: e.target.value})}
                  placeholder={adForm.ad_type === 'gam' ? '<script>/* GPT tag */</script>' : '<script async src="//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>...'}/>
              </div>
              <div className="flex gap-3">
                <button onClick={createAdUnit} className="btn-primary">Create Ad Unit</button>
                <button onClick={() => setShowAdForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {adUnits.length === 0 && <p className="text-center py-8 text-ink-300 text-sm">No ad units yet. Create your first one.</p>}
            {adUnits.map(unit => (
              <div key={unit.id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${unit.ad_type === 'gam' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {unit.ad_type.toUpperCase()}
                  </span>
                  <div>
                    <p className="font-medium text-ink-900 text-sm">{unit.name}</p>
                    <p className="text-xs text-ink-400">{unit.position} · {unit.size_width}×{unit.size_height}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${unit.is_active ? 'bg-green-500' : 'bg-ink-300'}`}/>
                  {isAdmin && (
                    <button onClick={() => deleteAdUnit(unit.id)} className="text-xs text-red-500 hover:text-red-600 px-2 py-1">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ASSIGN TO PUBLISHERS — admin only */}
      {tab === 'assign' && isAdmin && <PublisherAdAssignment />}

      {/* ADS.TXT */}
      {tab === 'ads_txt' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-ink-900">ads.txt Manager</h3>
              <p className="text-xs text-ink-400">Manage demand partner declarations — push to all publisher sites at once</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {isAdmin && (
                <>
                  <button onClick={() => setShowTxtForm(!showTxtForm)} className="btn-secondary btn-sm">+ Add entry</button>
                  <button onClick={pushAdsTxt} disabled={pushing} className="btn-primary btn-sm">
                    {pushing ? '⟳ Pushing...' : '📤 Push to all sites'}
                  </button>
                  <button onClick={() => {
                    const lines = ['# TrendingVerse CMS ads.txt', `# Updated: ${new Date().toISOString().split('T')[0]}`, '']
                    adsTxt.forEach(e => {
                      const parts = [e.domain, e.publisher_id, e.relationship]
                      if (e.certification_authority_id) parts.push(e.certification_authority_id)
                      lines.push(parts.join(', '))
                    })
                    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'ads.txt'; a.click()
                    URL.revokeObjectURL(url)
                  }} className="btn-secondary btn-sm">
                    ⬇ Download ads.txt
                  </button>
                </>
              )}
            </div>
          </div>

          {showTxtForm && isAdmin && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h4 className="font-semibold text-ink-900">Add ads.txt Entry</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Domain</label>
                  <input className="input font-mono text-xs" value={txtForm.domain} onChange={e => setTxtForm({...txtForm, domain: e.target.value})} placeholder="google.com"/>
                </div>
                <div>
                  <label className="label">Publisher/Seller ID</label>
                  <input className="input font-mono text-xs" value={txtForm.publisher_id} onChange={e => setTxtForm({...txtForm, publisher_id: e.target.value})} placeholder="pub-1234567890"/>
                </div>
                <div>
                  <label className="label">Relationship</label>
                  <select className="input" value={txtForm.relationship} onChange={e => setTxtForm({...txtForm, relationship: e.target.value})}>
                    <option value="DIRECT">DIRECT</option>
                    <option value="RESELLER">RESELLER</option>
                  </select>
                </div>
                <div>
                  <label className="label">Cert Authority ID (optional)</label>
                  <input className="input font-mono text-xs" value={txtForm.certification_authority_id} onChange={e => setTxtForm({...txtForm, certification_authority_id: e.target.value})} placeholder="f08c47fec0942fa0"/>
                </div>
                <div className="col-span-2">
                  <label className="label">Notes (optional)</label>
                  <input className="input" value={txtForm.notes} onChange={e => setTxtForm({...txtForm, notes: e.target.value})} placeholder="Google AdSense"/>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addAdsTxt} className="btn-primary">Add Entry</button>
                <button onClick={() => setShowTxtForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="card p-4">
            <p className="text-xs font-medium text-ink-500 mb-3">CURRENT ads.txt ({adsTxt.length} entries)</p>
            <div className="bg-ink-950 rounded-xl p-4 font-mono text-xs text-green-400 max-h-48 overflow-y-auto">
              {adsTxt.length === 0 && <span className="text-ink-500">No entries yet</span>}
              {adsTxt.map((e, i) => (
                <div key={i} className="flex items-center justify-between group">
                  <span>{e.domain}, {e.publisher_id}, {e.relationship}{e.certification_authority_id ? `, ${e.certification_authority_id}` : ''}</span>
                  {isAdmin && (
                    <button onClick={async () => {
                      await fetch('/api/monetization/ads-txt', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: e.id }) })
                      fetchAdsTxt()
                    }} className="opacity-0 group-hover:opacity-100 text-red-400 ml-4">×</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* REVENUE */}
      {tab === 'revenue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-ink-900">Revenue Dashboard</h3>
              <p className="text-xs text-ink-400">{isAdmin ? 'All publishers — earnings and splits' : 'Your earnings'}</p>
            </div>
            <div className="flex gap-2">
              <select className="input text-sm w-32" value={period} onChange={e => setPeriod(e.target.value)}>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              {isAdmin && (
                <button onClick={() => setShowRevenueForm(!showRevenueForm)} className="btn-primary btn-sm">+ Add report</button>
              )}
            </div>
          </div>

          {revenue && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', value: `$${revenue.stats.totalRevenue.toFixed(4)}`, icon: '💰', color: 'text-green-600' },
                { label: isAdmin ? 'Publisher Earnings' : 'Your Earnings', value: `$${revenue.stats.publisherEarnings.toFixed(4)}`, icon: '👤', color: 'text-blue-600' },
                { label: isAdmin ? 'Platform Earnings' : 'Platform Fee', value: `$${revenue.stats.platformEarnings.toFixed(4)}`, icon: '🏢', color: 'text-violet-600' },
                { label: 'eCPM', value: `$${revenue.ecpm.toFixed(3)}`, icon: '📊', color: 'text-amber-600' },
                { label: 'Impressions', value: revenue.stats.totalImpressions.toLocaleString(), icon: '👁', color: 'text-ink-900' },
                { label: 'Clicks', value: revenue.stats.totalClicks.toLocaleString(), icon: '👆', color: 'text-ink-900' },
                { label: 'CTR', value: `${revenue.ctr}%`, icon: '📈', color: revenue.ctr > 1 ? 'text-green-600' : 'text-amber-500' },
                { label: 'INR equiv', value: `₹${(revenue.stats.publisherEarnings * 83).toFixed(2)}`, icon: '₹', color: 'text-ink-900' },
              ].map(s => (
                <div key={s.label} className="card p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-400">{s.label}</span>
                    <span>{s.icon}</span>
                  </div>
                  <div className={`text-xl font-display font-bold ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {showRevenueForm && isAdmin && (
            <div className="card p-5 space-y-4 border-2 border-accent/20">
              <h4 className="font-semibold text-ink-900">Add Revenue Report</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Publisher ID</label>
                  <input className="input font-mono text-xs" value={revForm.publisher_id} onChange={e => setRevForm({...revForm, publisher_id: e.target.value})} placeholder="uuid"/>
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={revForm.report_date} onChange={e => setRevForm({...revForm, report_date: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Network</label>
                  <select className="input" value={revForm.network} onChange={e => setRevForm({...revForm, network: e.target.value})}>
                    {['GAM', 'AdSense', 'PubMatic', 'AppNexus', 'Taboola', 'Manual'].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Impressions</label>
                  <input type="number" className="input" value={revForm.impressions} onChange={e => setRevForm({...revForm, impressions: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Clicks</label>
                  <input type="number" className="input" value={revForm.clicks} onChange={e => setRevForm({...revForm, clicks: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Revenue (USD)</label>
                  <input type="number" step="0.0001" className="input" value={revForm.revenue_usd} onChange={e => setRevForm({...revForm, revenue_usd: e.target.value})}/>
                </div>
                <div>
                  <label className="label">Publisher share %</label>
                  <input type="number" min="0" max="100" className="input" value={revForm.revenue_share_pct} onChange={e => setRevForm({...revForm, revenue_share_pct: e.target.value})}/>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addRevenue} className="btn-primary">Save Report</button>
                <button onClick={() => setShowRevenueForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-ink-50 border-b border-ink-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-ink-500">Date</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Impressions</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Clicks</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Revenue</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-ink-500">Your share</th>
              </tr></thead>
              <tbody>
                {(revenue?.reports || []).length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-ink-300 text-sm">No revenue data yet. Add your first report.</td></tr>
                )}
                {(revenue?.reports || []).map((r, i) => (
                  <tr key={i} className="border-b border-ink-50 hover:bg-ink-50/50">
                    <td className="px-4 py-3 text-xs">{r.report_date}</td>
                    <td className="px-4 py-3 text-xs text-right">{r.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-right">{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-right font-medium text-green-600">${r.revenue_usd.toFixed(4)}</td>
                    <td className="px-4 py-3 text-xs text-right font-medium text-blue-600">${r.publisher_earnings_usd.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
