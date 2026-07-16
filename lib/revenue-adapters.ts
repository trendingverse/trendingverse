// lib/revenue-adapters.ts  — v3
// ══════════════════════════════════════════════════════════════════
// GENERIC configurable REST adapter (handles most simple key-based APIs
// entirely from UI config — no code) + CUSTOM adapters (adsterra) for
// APIs that need special handling.
//
// Generic config (demand_partners.config.report):
// {
//   "adapter": "generic",
//   "endpoint": "https://api.net/report?from={start}&to={end}",
//   "date_format": "YYYY-MM-DD" | "YYYYMMDD",   // how {start}/{end} render
//   "auth_type": "header" | "query",
//   "auth_name": "Token-Key",                    // header name or query param
//   "api_key": "THE_KEY",
//   "rows_path": "data",        // dot-path to the rows array; "" = root is the array
//   "map": { "date":"date","site":"domain","impressions":"impressions",
//            "clicks":"clicks","revenue":"revenue" },
//   "site_fallback": "example.com"  // used when the API doesn't return a site field
// }
// ══════════════════════════════════════════════════════════════════

export interface NormalizedRow {
  date: string; site: string; impressions: number; clicks: number
  revenue: number; currency: string; raw: any
}
export interface AdapterResult { ok: boolean; rows: NormalizedRow[]; error?: string }
export type Adapter = (config: any, start: string, end: string) => Promise<AdapterResult>

function dig(obj: any, path: string): any {
  if (!path) return obj
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}
function num(v: any): number { const n = Number(v); return isNaN(n) ? 0 : n }
function fmtDate(iso: string, format?: string): string {
  // iso is YYYY-MM-DD
  if (format === 'YYYYMMDD') return iso.replace(/-/g, '')
  if (format === 'YYYY/MM/DD') return iso.replace(/-/g, '/')
  return iso // default YYYY-MM-DD
}
function normSite(s: string): string {
  return String(s || '(all)').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
}

// ── GENERIC configurable REST adapter ─────────────────────────────
const generic: Adapter = async (config, startIso, endIso) => {
  try {
    if (!config?.endpoint) return { ok: false, rows: [], error: 'Generic adapter: missing endpoint' }
    const start = fmtDate(startIso, config.date_format)
    const end = fmtDate(endIso, config.date_format)
    let url = String(config.endpoint)
      .replace(/\{start\}/g, start).replace(/\{from\}/g, start)
      .replace(/\{end\}/g, end).replace(/\{to\}/g, end).replace(/\{finish\}/g, end)

    const headers: Record<string, string> = { 'Accept': 'application/json' }
    if (config.auth_type === 'header' && config.auth_name) {
      headers[config.auth_name] = config.api_key || ''
    } else if (config.auth_type === 'query' && config.auth_name) {
      url += (url.includes('?') ? '&' : '?') + `${config.auth_name}=${encodeURIComponent(config.api_key || '')}`
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, rows: [], error: `API ${res.status}: ${t.slice(0, 200)}` }
    }
    const json = await res.json()
    let arr = dig(json, config.rows_path || '')
    // If rows_path missing but the root IS an array, use it.
    if (!Array.isArray(arr) && Array.isArray(json)) arr = json
    if (!Array.isArray(arr)) {
      return { ok: false, rows: [], error: `rows_path '${config.rows_path || '(root)'}' isn't an array. Top-level keys: ${Object.keys(json || {}).join(', ').slice(0, 150)}` }
    }
    const m = config.map || {}
    const rows: NormalizedRow[] = arr.map((r: any) => {
      const rawSite = m.site ? dig(r, m.site) : null
      return {
        date: String(dig(r, m.date || 'date') || '').slice(0, 10),
        site: rawSite ? normSite(rawSite) : normSite(config.site_fallback || '(all)'),
        impressions: num(dig(r, m.impressions || 'impressions')),
        clicks: num(dig(r, m.clicks || 'clicks')),
        revenue: num(dig(r, m.revenue || 'revenue')),
        currency: config.currency || 'USD',
        raw: r,
      }
    }).filter((r: NormalizedRow) => r.date)
    return { ok: true, rows }
  } catch (e) {
    return { ok: false, rows: [], error: `Generic adapter failed: ${(e as Error).message}` }
  }
}

// ── CUSTOM: ADSTERRA ──────────────────────────────────────────────
const adsterra: Adapter = async (config, start, end) => {
  const key = config?.api_key
  if (!key) return { ok: false, rows: [], error: 'Missing Adsterra api_key' }
  try {
    const domainMap: Record<string, string> = {}
    try {
      const dRes = await fetch('https://api3.adsterratools.com/publisher/domains.json', {
        headers: { 'Accept': 'application/json', 'X-API-Key': key },
      })
      if (dRes.ok) {
        const dJson = await dRes.json()
        const items = dJson.items || dJson.domains || dJson.data || []
        for (const d of items) if (d.id != null) domainMap[String(d.id)] = d.title || d.domain || d.name || String(d.id)
      }
    } catch { /* optional */ }
    const url = `https://api3.adsterratools.com/publisher/stats.json?start_date=${start}&finish_date=${end}&group_by[]=date&group_by[]=domain`
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-API-Key': key } })
    if (!res.ok) { const t = await res.text(); return { ok: false, rows: [], error: `Adsterra API ${res.status}: ${t.slice(0, 200)}` } }
    const json = await res.json()
    const items = json.items || json.data || json.stats || []
    const rows: NormalizedRow[] = items.map((r: any) => {
      const domainId = String(r.domain ?? r.domain_id ?? r.domainId ?? '')
      return {
        date: (r.date || r.day || '').slice(0, 10),
        site: domainMap[domainId] || (domainId ? `domain_${domainId}` : '(all)'),
        impressions: num(r.impression ?? r.impressions),
        clicks: num(r.clicks ?? r.click),
        revenue: num(r.revenue ?? r.earning ?? r.money),
        currency: 'USD', raw: r,
      }
    }).filter((r: NormalizedRow) => r.date)
    return { ok: true, rows }
  } catch (e) {
    return { ok: false, rows: [], error: `Adsterra fetch failed: ${(e as Error).message}` }
  }
}

// ── REGISTRY ──────────────────────────────────────────────────────
export const ADAPTERS: Record<string, Adapter> = {
  generic,
  adsterra,
}
export function getAdapter(name: string): Adapter | null {
  return ADAPTERS[name] || null
}
