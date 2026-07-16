// lib/revenue-adapters.ts
// ══════════════════════════════════════════════════════════════════
// Per-network revenue adapters. Each adapter knows how to call ONE
// network's reporting API and return normalized daily rows:
//   { date, site, impressions, clicks, revenue, currency, raw }
//
// To add a new network later: write one adapter function following the
// same signature and register it in ADAPTERS. Nothing else changes.
// ══════════════════════════════════════════════════════════════════

export interface NormalizedRow {
  date: string          // YYYY-MM-DD
  site: string          // site identifier the network reports (domain or '(all)')
  impressions: number
  clicks: number
  revenue: number       // native currency
  currency: string
  raw: any
}
export interface AdapterResult {
  ok: boolean
  rows: NormalizedRow[]
  error?: string
}
// config = demand_partners.config.report  (the per-partner API settings)
export type Adapter = (config: any, start: string, end: string) => Promise<AdapterResult>

// ── ADSTERRA ──────────────────────────────────────────────────────
// Docs: https://api3.adsterratools.com/publisher
// Auth: X-API-Key header. Stats: /stats.json?start_date&finish_date&group_by[]=date&group_by[]=domain
const adsterra: Adapter = async (config, start, end) => {
  const key = config?.api_key
  if (!key) return { ok: false, rows: [], error: 'Missing Adsterra api_key' }
  try {
    // First, map domain IDs -> domain names (so we can attribute revenue per site)
    const domainMap: Record<string, string> = {}
    try {
      const dRes = await fetch('https://api3.adsterratools.com/publisher/domains.json', {
        headers: { 'Accept': 'application/json', 'X-API-Key': key },
      })
      if (dRes.ok) {
        const dJson = await dRes.json()
        const items = dJson.items || dJson.domains || dJson.data || []
        for (const d of items) {
          if (d.id != null) domainMap[String(d.id)] = d.title || d.domain || d.name || String(d.id)
        }
      }
    } catch { /* domain mapping optional */ }

    // Pull stats grouped by date + domain
    const url = `https://api3.adsterratools.com/publisher/stats.json`
      + `?start_date=${start}&finish_date=${end}`
      + `&group_by[]=date&group_by[]=domain`
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-API-Key': key } })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, rows: [], error: `Adsterra API ${res.status}: ${t.slice(0, 200)}` }
    }
    const json = await res.json()
    const items = json.items || json.data || json.stats || []
    const rows: NormalizedRow[] = items.map((r: any) => {
      const domainId = String(r.domain ?? r.domain_id ?? r.domainId ?? '')
      return {
        date: (r.date || r.day || '').slice(0, 10),
        site: domainMap[domainId] || (domainId ? `domain_${domainId}` : '(all)'),
        impressions: Number(r.impression ?? r.impressions ?? 0),
        clicks: Number(r.clicks ?? r.click ?? 0),
        revenue: Number(r.revenue ?? r.earning ?? r.money ?? 0),
        currency: 'USD',
        raw: r,
      }
    }).filter((r: NormalizedRow) => r.date)
    return { ok: true, rows }
  } catch (e) {
    return { ok: false, rows: [], error: `Adsterra fetch failed: ${(e as Error).message}` }
  }
}

// ── REGISTRY ──────────────────────────────────────────────────────
// Add future networks here: 'propellerads': propellerAds, etc.
export const ADAPTERS: Record<string, Adapter> = {
  adsterra,
}

export function getAdapter(name: string): Adapter | null {
  return ADAPTERS[name] || null
}
