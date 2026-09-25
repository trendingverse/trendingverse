// app/api/tvads/admin/route.ts
// Admin-only API for publisher sites, ad units and direct campaigns.
import { adminDb, currentUser, isTvAdmin, json, newId, newSiteKey, PLACEMENTS, DEVICES, DEFAULT_SETTINGS, DEFAULT_UNITS } from '@/lib/tvads/server'

export const dynamic = 'force-dynamic'

async function guard(): Promise<{ error?: Response; user?: { id: string; email: string } }> {
  const u = await currentUser()
  if (!u) return { error: json({ ok: false, error: 'Not signed in' }, 401) }
  if (!isTvAdmin(u.email)) return { error: json({ ok: false, error: 'Admins only' }, 403) }
  return { user: u }
}

const str = (v: any, max = 500) => String(v ?? '').slice(0, max)
const int = (v: any, d: number, min: number, max: number) => {
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
}
const mode = (m: any) => (['auto', 'inline', 'iframe'].includes(m) ? m : 'auto')
const url = (v: any) => {
  const s = str(v, 2000).trim()
  return /^https?:\/\//i.test(s) ? s : ''
}
const iso = (v: any) => {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function GET(req: Request) {
  const g = await guard()
  if (g.error) return g.error
  const db = adminDb()
  const sp = new URL(req.url).searchParams
  const op = sp.get('op') || 'sites'

  if (op === 'sites') {
    const { data, error } = await db.from('tv_ad_sites').select('id,name,domain,site_key,enabled,publisher_emails,settings,created_at').order('created_at', { ascending: true })
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, sites: data || [], placements: PLACEMENTS, devices: DEVICES, defaults: DEFAULT_SETTINGS })
  }

  if (op === 'units') {
    const siteId = sp.get('site') || ''
    const { data: units, error } = await db.from('tv_ad_units').select('*').eq('site_id', siteId).eq('archived', false).order('sort', { ascending: true })
    if (error) return json({ ok: false, error: error.message }, 500)
    const ids = (units || []).map((u: any) => u.id)
    let camps: any[] = []
    if (ids.length) {
      const r = await db.from('tv_ad_campaigns').select('*').in('unit_id', ids).eq('archived', false).order('created_at', { ascending: true })
      camps = r.data || []
    }
    const out = (units || []).map((u: any) => ({ ...u, campaigns: camps.filter(c => c.unit_id === u.id) }))
    return json({ ok: true, units: out })
  }

  return json({ ok: false, error: 'Unknown op' }, 400)
}

export async function POST(req: Request) {
  const g = await guard()
  if (g.error) return g.error
  const db = adminDb()
  let body: any = {}
  try { body = await req.json() } catch {}
  const op = body.op

  if (op === 'site_save') {
    const s = body.site || {}
    const emails = (Array.isArray(s.publisher_emails) ? s.publisher_emails : String(s.publisher_emails || '').split(','))
      .map((e: any) => String(e).trim().toLowerCase())
      .filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    const st = s.settings || {}
    const settings = {
      label: str(st.label, 60) || DEFAULT_SETTINGS.label,
      longWords: int(st.longWords, DEFAULT_SETTINGS.longWords, 100, 10000),
      longMinParas: int(st.longMinParas, DEFAULT_SETTINGS.longMinParas, 3, 100),
      interFreq: int(st.interFreq, DEFAULT_SETTINGS.interFreq, 0, 1440),
      interDelay: int(st.interDelay, DEFAULT_SETTINGS.interDelay, 0, 15),
      interMinPv: int(st.interMinPv, DEFAULT_SETTINGS.interMinPv, 1, 50),
      trackLoggedIn: !!st.trackLoggedIn,
      tz: str(st.tz, 60) || DEFAULT_SETTINGS.tz,
    }
    const row: any = {
      name: str(s.name, 120).trim() || 'Untitled site',
      domain: str(s.domain, 200).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
      publisher_emails: emails,
      enabled: s.enabled !== false,
      settings,
    }
    if (s.id) {
      const { error } = await db.from('tv_ad_sites').update(row).eq('id', s.id)
      if (error) return json({ ok: false, error: error.message }, 500)
      return json({ ok: true, id: s.id })
    }
    row.site_key = newSiteKey()
    const { data, error } = await db.from('tv_ad_sites').insert(row).select('id').single()
    if (error) return json({ ok: false, error: error.message }, 500)
    // seed the standard layout
    const seed = DEFAULT_UNITS.map((u, i) => ({ id: newId('u'), site_id: data.id, sort: i, ...u }))
    await db.from('tv_ad_units').insert(seed)
    return json({ ok: true, id: data.id })
  }

  if (op === 'site_rekey') {
    const { error } = await db.from('tv_ad_sites').update({ site_key: newSiteKey() }).eq('id', str(body.id, 60))
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true })
  }

  if (op === 'unit_save') {
    const u = body.unit || {}
    const siteId = str(body.site_id, 60)
    if (!siteId) return json({ ok: false, error: 'site_id missing' }, 400)
    const size = /^\d{2,4}x\d{2,4}$/.test(String(u.size)) ? String(u.size) : '300x250'
    const id = /^u[a-f0-9]{7}$/.test(String(u.id)) ? String(u.id) : newId('u')
    const unitRow = {
      id,
      site_id: siteId,
      name: str(u.name, 120).trim() || `Ad unit ${size}`,
      enabled: u.enabled !== false,
      archived: false,
      placement: PLACEMENTS[u.placement] ? u.placement : 'after_para',
      para: int(u.para, 1, 1, 50),
      size,
      device: DEVICES[u.device] ? u.device : 'all',
      net_code: str(u.net_code, 20000).trim(),
      net_mode: mode(u.net_mode),
      sort: int(u.sort, 0, 0, 1000),
    }
    const { error } = await db.from('tv_ad_units').upsert(unitRow)
    if (error) return json({ ok: false, error: error.message }, 500)

    const incoming = Array.isArray(u.campaigns) ? u.campaigns : []
    const keep: string[] = []
    const rows = incoming
      .map((c: any) => {
        const row = {
          id: /^c[a-f0-9]{7}$/.test(String(c.id)) ? String(c.id) : newId('c'),
          unit_id: id,
          name: str(c.name, 120).trim(),
          enabled: c.enabled !== false,
          archived: false,
          type: c.type === 'code' ? 'code' : 'image',
          code: str(c.code, 20000).trim(),
          mode: mode(c.mode),
          img: url(c.img),
          url: url(c.url),
          pixel: url(c.pixel),
          start_at: iso(c.start_at),
          end_at: iso(c.end_at),
        }
        if (!row.name) row.name = 'Direct campaign'
        return row
      })
      .filter((r: any) => (r.type === 'image' ? !!r.img : !!r.code) || r.name !== 'Direct campaign')
    rows.forEach((r: any) => keep.push(r.id))
    if (rows.length) {
      const { error: ce } = await db.from('tv_ad_campaigns').upsert(rows)
      if (ce) return json({ ok: false, error: ce.message }, 500)
    }
    // campaigns removed in the editor are archived (kept for report names)
    let q = db.from('tv_ad_campaigns').update({ archived: true }).eq('unit_id', id).eq('archived', false)
    if (keep.length) q = q.not('id', 'in', `(${keep.join(',')})`)
    await q
    return json({ ok: true, id })
  }

  if (op === 'unit_archive') {
    const { error } = await db.from('tv_ad_units').update({ archived: true, enabled: false }).eq('id', str(body.id, 20))
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true })
  }

  return json({ ok: false, error: 'Unknown op' }, 400)
}
