// lib/revenue-adapters.ts  — v4
// ══════════════════════════════════════════════════════════════════
// GENERIC adapter now AUTO-DETECTS field names + the rows array, so you
// only need to provide: endpoint, auth (header/query + name), api_key.
// No field mapping required. Custom adapters (adsterra) unchanged.
//
// Minimal generic config (demand_partners.config.report):
// {
//   "adapter": "generic",
//   "endpoint": "https://api.net/report?from={start}&to={end}",
//   "date_format": "YYYY-MM-DD" | "YYYYMMDD" | "YYYY/MM/DD",
//   "auth_type": "header" | "query",
//   "auth_name": "Token-Key",
//   "api_key": "THE_KEY",
//   "site_fallback": "example.com"   // optional
//   // optional manual overrides still respected if present:
//   // "rows_path", "map"
// }
// ══════════════════════════════════════════════════════════════════

export interface NormalizedRow {
  date: string; site: string; impressions: number; clicks: number
  revenue: number; currency: string; raw: any
}
export interface AdapterResult { ok: boolean; rows: NormalizedRow[]; error?: string }
export type Adapter = (config: any, start: string, end: string) => Promise<AdapterResult>

function num(v: any): number { const n = Number(v); return isNaN(n) ? 0 : n }
function dig(obj: any, path: string): any {
  if (!path) return obj
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}
function fmtDate(iso: string, format?: string): string {
  if (format === 'YYYYMMDD') return iso.replace(/-/g, '')
  if (format === 'YYYY/MM/DD') return iso.replace(/-/g, '/')
  return iso
}
function normSite(s: any): string {
  return String(s || '(all)').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
}

// Find the first key in an object matching any of the candidate names
// (case-insensitive, ignoring _ and spaces).
function findKey(obj: any, candidates: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null
  const keys = Object.keys(obj)
  const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '')
  for (const cand of candidates) {
    const c = norm(cand)
    const hit = keys.find(k => norm(k) === c)
    if (hit) return hit
  }
  // partial contains match as a fallback
  for (const cand of candidates) {
    const c = norm(cand)
    const hit = keys.find(k => norm(k).includes(c))
    if (hit) return hit
  }
  return null
}

// Auto-find the array of row objects in an arbitrary JSON response.
function findRowsArray(json: any): any[] | null {
  if (Array.isArray(json)) return json
  if (!json || typeof json !== 'object') return null
  // common wrapper keys first
  for (const k of ['data', 'items', 'results', 'report', 'stats', 'rows', 'response']) {
    const v = json[k]
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      // one level deeper (e.g. { response: { data: [...] } })
      for (const k2 of ['data', 'items', 'results', 'report', 'stats', 'rows']) {
        if (Array.isArray(v[k2])) return v[k2]
      }
    }
  }
  // otherwise: first array-of-objects value anywhere at top level
  for (const k of Object.keys(json)) {
    const v = json[k]
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') return v
  }
  return null
}

const REVENUE_NAMES = ['revenue', 'earning', 'earnings', 'income', 'money', 'profit', 'publisherRevenue', 'publisherNetRevenue', 'amount', 'total']
const DATE_NAMES = ['date', 'day', 'stat_date', 'statDate', 'reportDate']
const SITE_NAMES = ['domain', 'site', 'website', 'url', 'domain_name', 'siteName', 'host']
const IMPR_NAMES = ['impressions', 'impression', 'impr', 'views', 'view', 'imps']
const CLICK_NAMES = ['clicks', 'click', 'clk']

// ── GENERIC auto-detecting REST adapter ───────────────────────────
const generic: Adapter = async (config, startIso, endIso) => {
  try {
    if (!config?.endpoint) return { ok: false, rows: [], error: 'Missing endpoint URL' }
    const start = fmtDate(startIso, config.date_format)
    const end = fmtDate(endIso, config.date_format)
    let url = String(config.endpoint)
      .replace(/\{start\}/g, start).replace(/\{from\}/g, start)
      .replace(/\{end\}/g, end).replace(/\{to\}/g, end).replace(/\{finish\}/g, end)

    const headers: Record<string, string> = { 'Accept': 'application/json' }
    if (config.auth_type === 'query' && config.auth_name) {
      url += (url.includes('?') ? '&' : '?') + `${config.auth_name}=${encodeURIComponent(config.api_key || '')}`
    } else if (config.auth_name) { // default to header
      headers[config.auth_name] = config.api_key || ''
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, rows: [], error: `API ${res.status}: ${t.slice(0, 200)}` }
    }
    const json = await res.json()

    // rows array: manual override, else auto-detect
    let arr = config.rows_path ? dig(json, config.rows_path) : findRowsArray(json)
    if (!Array.isArray(arr)) arr = findRowsArray(json)
    // An empty array is a VALID response (no data for this date range) — not an error.
    if (Array.isArray(arr) && arr.length === 0) {
      return { ok: true, rows: [] }
    }
    if (!Array.isArray(arr)) {
      const keys = json && typeof json === 'object' ? Object.keys(json).join(', ') : typeof json
      return { ok: false, rows: [], error: `Couldn't find rows in response. Top-level: ${String(keys).slice(0, 150)}` }
    }

    // detect field names from the first row (or use manual map overrides)
    const sample = arr[0]
    const m = config.map || {}
    const kDate = m.date || findKey(sample, DATE_NAMES)
    const kSite = m.site || findKey(sample, SITE_NAMES)
    const kImpr = m.impressions || findKey(sample, IMPR_NAMES)
    const kClick = m.clicks || findKey(sample, CLICK_NAMES)
    const kRev = m.revenue || findKey(sample, REVENUE_NAMES)

    const rows: NormalizedRow[] = arr.map((r: any) => ({
      date: kDate ? String(dig(r, kDate) || '').slice(0, 10) : '',
      site: kSite ? normSite(dig(r, kSite)) : normSite(config.site_fallback || '(all)'),
      impressions: kImpr ? num(dig(r, kImpr)) : 0,
      clicks: kClick ? num(dig(r, kClick)) : 0,
      revenue: kRev ? num(dig(r, kRev)) : 0,
      currency: config.currency || 'USD',
      raw: r,
    })).filter((r: NormalizedRow) => r.date)

    if (!rows.length) {
      return { ok: false, rows: [], error: `Found ${arr.length} rows but couldn't read a date field. Row keys: ${Object.keys(sample).join(', ').slice(0, 150)}` }
    }
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

export const ADAPTERS: Record<string, Adapter> = { generic, adsterra }
export function getAdapter(name: string): Adapter | null { return ADAPTERS[name] || null }
