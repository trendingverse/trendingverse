// app/api/tvads/plugin/track/route.ts
// Public: receives batched impression / viewable / click beacons from the WordPress plugin.
import { adminDb, CORS, todayIn, DEFAULT_SETTINGS } from '@/lib/tvads/server'

export const dynamic = 'force-dynamic'

type SiteInfo = { id: string; tz: string; units: Set<string>; camps: Set<string>; at: number }
const siteCache = new Map<string, SiteInfo>()
const TTL = 5 * 60 * 1000

async function loadSite(db: any, key: string, force = false): Promise<SiteInfo | null> {
  const hit = siteCache.get(key)
  if (hit && !force && Date.now() - hit.at < TTL) return hit
  const { data: site } = await db.from('tv_ad_sites').select('id,settings').eq('site_key', key).maybeSingle()
  if (!site) return null
  const { data: units } = await db.from('tv_ad_units').select('id').eq('site_id', site.id)
  const uids = (units || []).map((u: any) => u.id)
  let cids: string[] = []
  if (uids.length) {
    const { data: camps } = await db.from('tv_ad_campaigns').select('id').in('unit_id', uids)
    cids = (camps || []).map((c: any) => c.id)
  }
  const info: SiteInfo = {
    id: site.id,
    tz: (site.settings && site.settings.tz) || DEFAULT_SETTINGS.tz,
    units: new Set(uids),
    camps: new Set(cids),
    at: Date.now(),
  }
  siteCache.set(key, info)
  return info
}

function done() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function OPTIONS() {
  return done()
}

export async function POST(req: Request) {
  const ua = req.headers.get('user-agent') || ''
  if (!ua || /bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|preview/i.test(ua)) return done()

  let body: any
  try {
    body = JSON.parse(await req.text())
  } catch {
    return done()
  }
  const key = String(body?.k || '')
  const events: any[] = Array.isArray(body?.e) ? body.e.slice(0, 40) : []
  if (!/^[a-f0-9]{16,64}$/.test(key) || !events.length) return done()

  try {
    const db = adminDb()
    let site = await loadSite(db, key)
    if (!site) return done()
    // a unit/campaign created in the last few minutes may not be in the cache yet
    const unknown = events.some(e => Array.isArray(e) && (!site!.units.has(String(e[0])) || (String(e[1]) !== 'n' && !site!.camps.has(String(e[1])))))
    if (unknown && Date.now() - site.at > 30000) site = (await loadSite(db, key, true)) || site

    const cols: Record<string, 's' | 'v' | 'c'> = { s: 's', v: 'v', c: 'c' }
    const agg = new Map<string, any>()
    const d = todayIn(site.tz)
    for (const e of events) {
      if (!Array.isArray(e) || e.length < 4) continue
      const [u, src, t, dev] = e.map((x: any) => String(x))
      if (!site.units.has(u) || !cols[t]) continue
      if (src !== 'n' && !site.camps.has(src)) continue
      const device = dev === 'm' ? 'mobile' : 'desktop'
      const k = `${u}|${src}|${device}`
      if (!agg.has(k)) agg.set(k, { d, site: site.id, u, src, dev: device, s: 0, v: 0, c: 0 })
      agg.get(k)[cols[t]] = 1 // at most one of each per unit per beacon
    }
    if (agg.size) {
      const { error } = await db.rpc('tv_ad_track', { p_rows: Array.from(agg.values()) })
      if (error) console.error('[tvads track]', error.message)
    }
  } catch (e: any) {
    console.error('[tvads track]', e?.message || e)
  }
  return done()
}
