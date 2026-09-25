// app/api/tvads/report/route.ts
// Delivery report. Admins see every site; publishers only sites listing their login email.
// Never returns ad codes, network names or revenue.
import { adminDb, currentUser, isTvAdmin, json } from '@/lib/tvads/server'

export const dynamic = 'force-dynamic'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const user = await currentUser()
  if (!user) return json({ ok: false, error: 'Not signed in' }, 401)
  const admin = isTvAdmin(user.email)
  const db = adminDb()
  const sp = new URL(req.url).searchParams

  let q = db.from('tv_ad_sites').select('id,name,domain').order('name', { ascending: true })
  if (!admin) q = q.contains('publisher_emails', [user.email])
  const { data: sites, error } = await q
  if (error) return json({ ok: false, error: error.message }, 500)

  const siteId = sp.get('site') || ''
  if (!siteId) return json({ ok: true, admin, sites: sites || [] })

  const site = (sites || []).find((s: any) => s.id === siteId)
  if (!site) return json({ ok: false, error: 'No access to this site' }, 403)

  const today = new Date().toISOString().slice(0, 10)
  let from = sp.get('from') || ''
  let to = sp.get('to') || ''
  if (!DAY.test(from)) from = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  if (!DAY.test(to)) to = today
  if (from > to) [from, to] = [to, from]

  const { data: rows, error: re } = await db.rpc('tv_ad_report', { p_site: siteId, p_from: from, p_to: to })
  if (re) return json({ ok: false, error: re.message }, 500)

  // names (archived included, so old report rows still read well)
  const { data: units } = await db.from('tv_ad_units').select('id,name,size').eq('site_id', siteId)
  const uids = (units || []).map((u: any) => u.id)
  let camps: any[] = []
  if (uids.length) camps = (await db.from('tv_ad_campaigns').select('id,name').in('unit_id', uids)).data || []
  const names: Record<string, string> = { n: 'Network' }
  for (const u of units || []) names[u.id] = `${u.name} (${u.size})`
  for (const c of camps) names[c.id] = `Direct: ${c.name}`

  const list: any[] = Array.isArray(rows) ? rows : []

  if (sp.get('format') === 'csv') {
    const pct = (a: number, b: number) => (b ? ((a * 100) / b).toFixed(2) : '0')
    const cell = (v: any) => `"${String(v).replace(/"/g, '""')}"`
    const lines = [['Date', 'Ad unit', 'Type', 'Source', 'Device', 'Impressions', 'Viewable', 'Viewability %', 'Clicks', 'CTR %'].map(cell).join(',')]
    for (const r of list) {
      lines.push([
        r.d, names[r.u] || r.u, r.src === 'n' ? 'Network' : 'Direct', names[r.src] || r.src, r.dev,
        r.s, r.v, pct(r.v, r.s), r.c, pct(r.c, r.s),
      ].map(cell).join(','))
    }
    const fname = `ad-report-${String(site.domain || site.name).replace(/[^a-z0-9.-]/gi, '')}-${from}_to_${to}.csv`
    return new Response('\uFEFF' + lines.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${fname}"`, 'Cache-Control': 'no-store' },
    })
  }

  return json({ ok: true, admin, sites: sites || [], site, from, to, rows: list, names })
}
