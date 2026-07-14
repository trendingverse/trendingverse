'use client'
import { useState, useEffect } from 'react'

interface HealthRow {
  id: string
  campaign_name: string
  priority_tier: number
  position: string
  recent_impressions_24h: number
  total_impressions: number
  geo_scoped: boolean
}
interface HealthData {
  summary: { silent: number; healthy: number; inactive: number }
  silent: HealthRow[]
  generated_at: string
}

// Drop <DeliveryHealthBanner /> at the top of the admin ads dashboard.
// It quietly shows nothing when all active campaigns are delivering, and
// raises a visible alert the moment an active campaign goes dark for 24h.
export function DeliveryHealthBanner() {
  const [data, setData] = useState<HealthData | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    fetch('/api/audience/delivery-health')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data || dismissed) return null
  const silent = data.silent || []
  if (silent.length === 0) {
    // Healthy — a small green confirmation, easy to ignore.
    return (
      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2">
        <span>✓</span>
        <span>All active campaigns delivered in the last 24h.</span>
      </div>
    )
  }

  return (
    <div className="border-2 border-red-200 bg-red-50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-100/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-red-800">
              {silent.length} active campaign{silent.length > 1 ? 's' : ''} not delivering
            </p>
            <p className="text-xs text-red-600">Active & approved, but zero impressions in the last 24h — serving may be broken.</p>
          </div>
        </div>
        <span className="text-red-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-red-500 border-b border-red-100">
                <th className="text-left py-1.5 font-medium">Campaign</th>
                <th className="text-center py-1.5 font-medium">Position</th>
                <th className="text-right py-1.5 font-medium">24h</th>
                <th className="text-right py-1.5 font-medium">Total</th>
                <th className="text-left py-1.5 font-medium pl-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {silent.map(c => (
                <tr key={c.id} className="border-b border-red-50">
                  <td className="py-2 font-medium text-ink-900">{c.campaign_name}</td>
                  <td className="py-2 text-center text-ink-500">{c.position}</td>
                  <td className="py-2 text-right font-semibold text-red-600">0</td>
                  <td className="py-2 text-right text-ink-500">{c.total_impressions.toLocaleString()}</td>
                  <td className="py-2 pl-3 text-ink-400">
                    {c.geo_scoped
                      ? 'Geo-scoped — may be 0 if no matching visitors'
                      : c.total_impressions > 0
                        ? 'Was delivering before — likely stopped'
                        : 'Never delivered'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-red-500">
              A geo-scoped house ad reading 0 is often fine. A previously-delivering campaign at 0 usually means serving broke.
            </p>
            <button onClick={() => setDismissed(true)}
              className="text-[11px] text-red-400 hover:text-red-600 px-2 py-1">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )
}
