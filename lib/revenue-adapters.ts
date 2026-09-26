// lib/revenue-adapters.ts  — v5
// ══════════════════════════════════════════════════════════════════
// GENERIC adapter AUTO-DETECTS field names + the rows array, so you
// only need to provide: endpoint, auth (header/query + name), api_key.
// No field mapping required. Custom adapters (adsterra) unchanged.
//
// v5: finds rows under `result` (HilltopAds-style) and up to 3 levels
// deep, accepts date-keyed objects ({ "2026-09-20": {...} }), treats an
// empty result as "no data", normalises date formats, and includes a
// short response preview in errors for easy debugging.
//
// Minimal generic config (demand_partners.config.report):
// {
//   "adapter": "generic",
//   "endpoint": "https://api.net/report?from={start}&to={end}",
//   "date_format": "YYYY-MM-DD" | "YYYYMMDD" | "YYYY/MM/DD",
//   "auth_type": "header" | "query",
//   "auth_name": "Token-Key",
//   "api_key": "THE_KEY",
//   "site_fallback": "example.com",   // optional
//   "currency": "USD"                 // optional
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

function num(v: any): number {
  if (typeof v === 'string') v = v.replace(/[,$\s]/g, '')
  const n = Number(v)
  return isNaN(n) ? 0 : n
}
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
// Accepts 2026-09-20, 2026-09-20 00:00:00, 2026/09/20, 20260920, 20.09.2026, 20-09-2026, 20/09/2026
function normDate(v: any): string {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return ''
}
const looksLikeDate = (k: string) => normDate(k) !== ''

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
  for (const cand of candidates) {
    const c = norm(cand)
    const hit = keys.find(k => norm(k).includes(c))
    if (hit) return hit
  }
  return null
}

const WRAPPERS = ['data', 'result', 'results', 'items', 'report', 'stats', 'statistics', 'rows', 'response', 'list']

// Auto-find the rows in an arbitrary JSON response.
// Returns an array (possibly empty) or null if nothing usable was found.
function findRowsArray(json: any, depth = 0): any[] | null {
  if (Array.isArray(json)) return json
  if (!json || typeof json !== 'object' || depth > 3) return null

  // date-keyed object: { "2026-09-20": {...}, "2026-09-21": {...} }
  const keys = Object.keys(json)
  if (keys.length && keys.every(looksLikeDate) && keys.every(k => json[k] && typeof json[k] === 'object')) {
    return keys.map(k => (Array.isArray(json[k]) ? json[k].map((r: any) => ({ date: k, ...r })) : [{ date: k, ...json[k] }])).flat()
  }

  // common wrapper keys first (recursively)
  for (const k of WRAPPERS) {
    if (!(k in json)) continue
    const v = json[k]
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      const inner = findRowsArray(v, depth + 1)
      if (inner) return inner
      // a single-row object (e.g. totals for one day)
      if (findKey(v, IMPR_NAMES) || findKey(v, REVENUE_NAMES)) return [v]
    }
  }
  // otherwise: first array-of-objects value anywhere at this level
  for (const k of keys) {
    const v = json[k]
    if (Array.isArray(v) && (v.length === 0 || typeof v[0] === 'object')) return v
  }
  return null
}

const REVENUE_NAMES = ['revenue', 'earning', 'earnings', 'income', 'money', 'profit', 'publisherRevenue', 'publisherNetRevenue', 'amount', 'total']
const DATE_NAMES = ['date', 'day', 'stat_date', 'statDate', 'reportDate']
const SITE_NAMES = ['domain', 'site', 'website', 'url', 'domain_name', 'siteName', 'host']
const IMPR_NAMES = ['impressions', 'impression', 'impr', 'views', 'view', 'imps']
const CLICK_NAMES = ['clicks', 'click', 'clk']

function preview(json: any): string {
  try { return JSON.stringify(json).slice(0, 180) } catch { return String(json).slice(0, 180) }
}

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
    } else if (config.auth_name) {
      headers[config.auth_name] = config.api_key || ''
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, rows: [], error: `API ${res.status}: ${t.slice(0, 200)}` }
    }
    const json = await res.json()

    // API-level error flags (e.g. { status: "error", message: "..." })
    const st = String(json?.status ?? '').toLowerCase()
    if (['error', 'fail', 'failed'].includes(st)) {
      return { ok: false, rows: [], error: `API error: ${preview(json)}` }
    }

    let arr = config.rows_path ? dig(json, config.rows_path) : null
    if (!Array.isArray(arr)) arr = findRowsArray(json)

    if (Array.isArray(arr) && arr.length === 0) return { ok: true, rows: [] } // no data for this range
    if (!Array.isArray(arr)) {
      return { ok: false, rows: [], error: `Couldn't find rows in response: ${preview(json)}` }
    }

    const sample = arr.find((r: any) => r && typeof r === 'object') || {}
    const m = config.map || {}
    const kDate = m.date || findKey(sample, DATE_NAMES)
    const kSite = m.site || findKey(sample, SITE_NAMES)
    const kImpr = m.impressions || findKey(sample, IMPR_NAMES)
    const kClick = m.clicks || findKey(sample, CLICK_NAMES)
    const kRev = m.revenue || findKey(sample, REVENUE_NAMES)

    // Single-day totals with no date field: use the requested range when it's one day
    const oneDay = startIso === endIso ? startIso : ''

    const rows: NormalizedRow[] = arr
      .filter((r: any) => r && typeof r === 'object')
      .map((r: any) => ({
        date: kDate ? normDate(dig(r, kDate)) : oneDay,
        site: kSite ? normSite(dig(r, kSite)) : normSite(config.site_fallback || '(all)'),
        impressions: kImpr ? num(dig(r, kImpr)) : 0,
        clicks: kClick ? num(dig(r, kClick)) : 0,
        revenue: kRev ? num(dig(r, kRev)) : 0,
        currency: config.currency || 'USD',
        raw: r,
      }))
      .filter((r: NormalizedRow) => r.date)

    if (!rows.length) {
      return { ok: false, rows: [], error: `Found ${arr.length} rows but couldn't read a date. Row keys: ${Object.keys(sample).join(', ').slice(0, 120)} | sample: ${preview(sample)}` }
    }
    return { ok: true, rows }
  } catch (e) {
    return { ok: false, rows: [], error: `Generic adapter failed: ${(e as Error).message}` }
  }
}

// ── CUSTOM: ADSTERRA (unchanged) ──────────────────────────────────
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
