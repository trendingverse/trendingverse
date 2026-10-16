'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Row {
  id: string; campaign_name: string; status: string; approval_status: string
  start_date: string; end_date: string
  impressions: number; viewable_impressions: number; viewability_rate: number
  clicks: number; ctr: number; goal: number | null; delivered_pct: number | null
  conversions: number; conversion_rate: number; pixel_token: string | null
}
interface Summary {
  company_name: string; campaigns: number; active: number
  impressions: number; viewable_impressions: number; viewability_rate: number
  clicks: number; ctr: number; spend_inr: number
  conversions: number; conversion_rate: number
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700', scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-ink-100 text-ink-500', paused: 'bg-amber-100 text-amber-700',
  draft: 'bg-ink-100 text-ink-400',
}

export function AdvertiserDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/advertisers/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setSummary(d.summary); setRows(d.campaigns || [])
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="h-32 bg-ink-50 rounded-xl animate-pulse" />
  if (error) return <div className="card p-6 text-center text-sm text-ink-500">{error}</div>
  if (!summary) return null

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">
          {summary.company_name || 'Your'} Campaigns
        </h1>
        <p className="text-sm text-ink-400 mt-1">Live delivery for your campaigns — updated continuously.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: 'Impressions', v: summary.impressions.toLocaleString(), c: 'text-ink-900' },
          { l: 'Viewability', v: summary.viewability_rate + '%', c: 'text-green-600', sub: `${summary.viewable_impressions.toLocaleString()} viewable` },
          { l: 'Clicks', v: summary.clicks.toLocaleString(), c: 'text-ink-900', sub: summary.ctr + '% CTR' },
          { l: 'Conversions', v: (summary.conversions || 0).toLocaleString(), c: 'text-purple-600', sub: (summary.conversion_rate || 0) + '% conv. rate' },
          { l: 'Spend', v: '₹' + summary.spend_inr.toLocaleString(), c: 'text-amber-600' },
        ].map(s => (
          <div key={s.l} className="card p-4 text-center">
            <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
            <div className="text-xs text-ink-400 mt-1">{s.l}</div>
            {s.sub && <div className="text-[10px] text-ink-300 mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-ink-50 border-b border-ink-100">
          <p className="text-xs font-semibold text-ink-700">
            Your Campaigns ({summary.campaigns}) · {summary.active} active
          </p>
        </div>
        {rows.length === 0 ? (
          <div className="p-8 space-y-6">
            <p className="text-sm text-ink-400 text-center">No campaigns yet. Your account manager will set these up — here's what to expect:</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-4">
              {[
                { icon: '📋', step: '1', title: 'Campaign approved', desc: 'Your account manager reviews and approves your campaign brief and creative assets.' },
                { icon: '🚀', step: '2', title: 'Goes live', desc: 'Your ad is activated and starts serving across TrendingVerse publisher properties.' },
                { icon: '📊', step: '3', title: 'Track delivery', desc: 'Impressions, viewability, clicks, and conversions update in real time on this dashboard.' },
                { icon: '🎯', step: '4', title: 'Conversion pixel', desc: 'Paste the pixel snippet on your thank-you page to track post-click conversions.' },
              ].map(s => (
                <div key={s.step} className="flex flex-col items-center text-center gap-2 p-4 bg-ink-50 rounded-xl">
                  <div className="relative">
                    <span className="text-2xl">{s.icon}</span>
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">{s.step}</span>
                  </div>
                  <p className="text-xs font-semibold text-ink-900">{s.title}</p>
                  <p className="text-[11px] text-ink-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-400 text-center pt-2">
              Questions? Reach out to your account manager and we'll get your campaign set up quickly.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-ink-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Campaign</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Status</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Impressions</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Viewability</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Clicks</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">CTR</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Conv.</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-ink-500">Delivery</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Pixel</th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold text-ink-900">{r.campaign_name}</p>
                    <p className="text-[10px] text-ink-400">{r.start_date || '—'}{r.end_date ? ` → ${r.end_date}` : ''}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[r.status] || 'bg-ink-100 text-ink-500'}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs">{r.impressions.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-xs">
                    <span className="font-medium text-green-600">{r.viewability_rate}%</span>
                    <span className="text-[10px] text-ink-400 block">{r.viewable_impressions.toLocaleString()}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-xs">{r.clicks.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-xs text-green-600 font-medium">{r.ctr}%</td>
                  <td className="px-3 py-3 text-right text-xs">
                    <span className="font-medium text-purple-600">{(r.conversions || 0).toLocaleString()}</span>
                    {r.clicks > 0 && <span className="text-[10px] text-ink-400 block">{r.conversion_rate}% CVR</span>}
                  </td>
                  <td className="px-3 py-3 text-right text-xs">
                    {r.delivered_pct !== null ? (
                      <div>
                        <span className="font-medium text-ink-700">{r.delivered_pct}%</span>
                        <div className="w-16 h-1.5 bg-ink-100 rounded-full overflow-hidden mt-1 ml-auto">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.delivered_pct}%` }} />
                        </div>
                      </div>
                    ) : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.pixel_token ? (
                      <button
                        onClick={() => {
                          const snippet = `<img src="${window.location.origin}/api/track/pixel?t=${r.pixel_token}" width="1" height="1" style="display:none" alt="" />`
                          navigator.clipboard.writeText(snippet).then(() => toast.success('Pixel copied! Paste on your thank-you page.'))
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium"
                        title="Copy conversion pixel snippet"
                      >
                        Copy pixel
                      </button>
                    ) : <span className="text-[10px] text-ink-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-ink-400 text-center">
        Viewability measured on the MRC display standard (50% of the ad in view for 1+ second).
      </p>
    </div>
  )
}
