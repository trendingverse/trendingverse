// app/api/mediation/serve-slot/route.ts  — v3.1
// ══════════════════════════════════════════════════════════════════
// UNIVERSAL SLOT SERVER — multi-partner mediation brain.
//
// v3: serves the AD UNITS you create per site (ad_units table).
//   • A slot request (site + position + size) is matched to that site's
//     active ad units with a code. Several slots of the same kind on one
//     page each get a DIFFERENT unit (slot_index), so a zone is never
//     repeated on a page.
//   • "sticky" requests use the site's sticky/footer units.
//   • If the unit doesn't fill, the waterfall falls through to other
//     partners' placements/templates (never the same partner again).
// v2: the DIRECT decision reuses serve-ad (geo / tier / gender / floor).
//
// v3.1: a unit is never reused on the same page (extra slots fall back to
//   other partners' placements or collapse), and a site that has its own
//   units never gets another site's generic partner template.
//
// Order: direct (serve-ad) → site ad unit → other partners by waterfall_order
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

function fillTemplate(tpl: string, ctx: { w: number; h: number; slotId: string }) {
  return (tpl || '')
    .replace(/\{\{WIDTH\}\}/g, String(ctx.w))
    .replace(/\{\{HEIGHT\}\}/g, String(ctx.h))
    .replace(/\{\{SLOT_ID\}\}/g, ctx.slotId)
}

const normHost = (s: any) =>
  String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase()

function siteMatches(a: string, b: string) {
  if (!a || !b) return false
  return a === b || a.endsWith('.' + b) || b.endsWith('.' + a)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { site_url, position, width, height, fingerprint, slot_id, slot_index } = body
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const w = parseInt(width, 10) || 300
  const h = parseInt(height, 10) || 250
  const pos = position || 'in_content'
  const site = normHost(site_url)
  const idx = Math.max(0, parseInt(slot_index, 10) || 0)
  const slotId = slot_id || `slot_${Math.random().toString(36).slice(2, 10)}`

  const demand: any[] = []

  // ── 1. DIRECT decision — delegate to serve-ad (single source of truth) ──
  try {
    const origin = new URL(req.url).origin
    const saRes = await fetch(`${origin}/api/audience/serve-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, site_url, position: pos }),
    })
    if (saRes.ok) {
      const sa = await saRes.json()
      if (sa && sa.ad) {
        const d = sa.ad
        demand.push({
          source: 'direct',
          type: 'direct',
          ad_id: d.id,
          headline: d.headline,
          description: d.description,
          image_url: d.image_url,
          cta_text: d.cta_text,
          destination_url: d.destination_url,
          size_width: d.size_width,
          size_height: d.size_height,
        })
      }
    }
  } catch { /* serve-ad unreachable — proceed with network only */ }

  // Interstitial is for direct campaigns only
  if (pos === 'interstitial') {
    return NextResponse.json({ slot_id: slotId, demand, width: w, height: h }, { headers: CORS })
  }

  // ── 2. Partners (for slugs + fallback) ──
  const { data: partners } = await admin
    .from('demand_partners')
    .select('*')
    .eq('is_active', true)
    .order('waterfall_order', { ascending: true })

  const partnerSlugFor = (networkName: string): string => {
    const n = String(networkName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!n) return 'network'
    const hit = (partners || []).find((p: any) => {
      const s = String(p.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const nm = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      return s === n || nm === n || s.startsWith(n) || n.startsWith(s) || nm.startsWith(n)
    })
    return hit ? hit.slug : n
  }

  // ── 3. SITE AD UNIT — the unit you created for this site/position/size ──
  let usedPartner = ''
  let siteHasUnits = false
  if (site) {
    const { data: units } = await admin
      .from('ad_units')
      .select('id,name,network_name,position,size_width,size_height,site_url,ad_code,is_active')
      .eq('is_active', true)

    const posOk = (p: string) => p === pos || (pos === 'sticky' && (p === 'footer' || p === 'sticky'))
    const cands = (units || [])
      .filter((u: any) => String(u.ad_code || '').trim())
      .filter((u: any) => siteMatches(normHost(u.site_url), site))
      .filter((u: any) => posOk(u.position))
      .filter((u: any) => (!u.size_width || u.size_width === w) && (!u.size_height || u.size_height === h))
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))

    siteHasUnits = cands.length > 0
    if (idx < cands.length) {
      const u = cands[idx] // each slot on the page gets a different unit — never reused
      usedPartner = partnerSlugFor(u.network_name)
      demand.push({
        source: usedPartner,
        type: 'network',
        name: u.name,
        ad_unit_id: u.id,
        order: 0,
        ad_code: fillTemplate(u.ad_code, { w, h, slotId }),
      })
    }
  }

  // ── 4. Fallback: other partners' placements / templates, by waterfall_order ──
  const { data: placements } = await admin
    .from('demand_partner_placements')
    .select('*')
    .eq('is_active', true)

  for (const p of partners || []) {
    if (usedPartner && p.slug === usedPartner) continue // never repeat the same partner's zone
    const candidates = (placements || []).filter((pl: any) => {
      if (pl.partner_id !== p.id) return false
      const plSite = normHost(pl.site_url)
      const siteOk = !pl.site_url || siteMatches(plSite, site)
      const posOk = !pl.position || pl.position === pos
      const sizeOk = (!pl.size_width || pl.size_width === w) && (!pl.size_height || pl.size_height === h)
      return siteOk && posOk && sizeOk
    })
    candidates.sort((a: any, b: any) => {
      const spec = (x: any) => (x.site_url ? 4 : 0) + (x.position ? 2 : 0) + (x.size_width ? 1 : 0)
      return spec(b) - spec(a)
    })
    const chosen = candidates[0]
    const rawCode = chosen?.ad_code || p.ad_code_template
    if (!rawCode) continue
    // a generic template is only used when this site has no units of its own
    if (!chosen && siteHasUnits) continue

    demand.push({
      source: p.slug,
      type: 'network',
      name: p.name,
      order: chosen?.waterfall_order ?? p.waterfall_order,
      ad_code: fillTemplate(rawCode, { w, h, slotId }),
    })
  }

  const direct = demand.filter(d => d.type === 'direct')
  const network = demand.filter(d => d.type === 'network').sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  const ordered = [...direct, ...network]

  admin.from('mediation_events').insert({
    fingerprint, site_url: site, position: pos,
    partner_slug: null, event_type: 'request',
  }).then(() => {}, () => {})

  return NextResponse.json({
    slot_id: slotId,
    demand: ordered,
    width: w, height: h,
  }, { headers: CORS })
}
