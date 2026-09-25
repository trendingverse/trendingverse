// app/api/tvads/plugin/config/route.ts
// Public: the WordPress plugin calls this with its site key. Cached at the edge for 60s.
import { adminDb, CORS, json, esc, DEFAULT_SETTINGS } from '@/lib/tvads/server'

export const dynamic = 'force-dynamic'

const CACHE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

function imageHtml(c: any, size: string): string {
  const [w, h] = size.split('x').map(n => parseInt(n, 10) || 0)
  const img = `<img src="${esc(c.img)}" width="${w}" height="${h}" alt="Advertisement" style="display:block;max-width:100%;height:auto;margin:0 auto">`
  let html = c.url ? `<a class="tvas-direct" href="${esc(c.url)}" target="_blank" rel="noopener sponsored nofollow">${img}</a>` : img
  if (c.pixel) html += `<img src="${esc(c.pixel)}" width="1" height="1" alt="" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none">`
  return html
}

function resolveMode(code: string, mode: string): string {
  if (mode === 'inline' || mode === 'iframe') return mode
  return /document\.write|invoke\.js/i.test(code) ? 'iframe' : 'inline'
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || ''
  if (!/^[a-f0-9]{16,64}$/.test(key)) return json({ ok: false, error: 'invalid key' }, 400, { ...CORS, 'Cache-Control': 'no-store' })

  try {
    const db = adminDb()
    const { data: site } = await db.from('tv_ad_sites').select('id,enabled,settings').eq('site_key', key).maybeSingle()
    if (!site) return json({ ok: false, error: 'unknown key' }, 404, { ...CORS, 'Cache-Control': CACHE })

    const settings = { ...DEFAULT_SETTINGS, ...(site.settings || {}) }
    if (!site.enabled) return json({ ok: true, enabled: false, settings, units: [] }, 200, { ...CORS, 'Cache-Control': CACHE })

    const { data: units } = await db
      .from('tv_ad_units')
      .select('id,placement,para,size,device,net_code,net_mode,sort')
      .eq('site_id', site.id)
      .eq('enabled', true)
      .eq('archived', false)
      .order('sort', { ascending: true })

    const ids = (units || []).map((u: any) => u.id)
    let camps: any[] = []
    if (ids.length) {
      const r = await db
        .from('tv_ad_campaigns')
        .select('id,unit_id,type,code,mode,img,url,pixel,start_at,end_at')
        .in('unit_id', ids)
        .eq('enabled', true)
        .eq('archived', false)
      camps = r.data || []
    }

    const now = Date.now()
    const out: any[] = []
    for (const u of units || []) {
      const [w, h] = String(u.size).split('x').map((n: string) => parseInt(n, 10) || 0)
      const directs = camps
        .filter(c => c.unit_id === u.id)
        .filter(c => !c.end_at || new Date(c.end_at).getTime() > now)
        .filter(c => (c.type === 'image' ? !!c.img : !!String(c.code || '').trim()))
        .map(c => ({
          id: c.id,
          html: c.type === 'image' ? imageHtml(c, u.size) : c.code,
          mode: c.type === 'image' ? 'inline' : resolveMode(c.code, c.mode),
          s: c.start_at ? new Date(c.start_at).getTime() : 0,
          e: c.end_at ? new Date(c.end_at).getTime() : 0,
        }))
      const net = String(u.net_code || '').trim() ? { html: u.net_code, mode: resolveMode(u.net_code, u.net_mode) } : null
      if (!net && !directs.length) continue
      out.push({ id: u.id, p: u.placement, para: u.para, w, h, dev: u.device, net, directs })
    }

    return json({ ok: true, enabled: true, settings, units: out }, 200, { ...CORS, 'Cache-Control': CACHE })
  } catch (e: any) {
    console.error('[tvads config]', e?.message || e)
    return json({ ok: false, error: 'server error' }, 500, { ...CORS, 'Cache-Control': 'no-store' })
  }
}
