// app/api/mediation/revenue/test/route.ts
// Runs an adapter with ad-hoc config (from the Add-Network form) WITHOUT
// saving, so you can verify a generic REST config actually pulls data
// before committing the partner. Returns row count + a sample row.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAdapter } from '@/lib/revenue-adapters'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const adapterName = body.report_adapter
  if (!adapterName) return NextResponse.json({ ok: false, error: 'No adapter selected' })
  const adapter = getAdapter(adapterName)
  if (!adapter) return NextResponse.json({ ok: false, error: `No adapter '${adapterName}'` })

  // Build the same config shape the sync uses
  const config: any = { adapter: adapterName, api_key: body.report_api_key }
  if (adapterName === 'generic') {
    config.endpoint = body.report_endpoint
    config.date_format = body.report_date_format || 'YYYY-MM-DD'
    config.auth_type = body.report_auth_type || 'header'
    config.auth_name = body.report_auth_name
    config.rows_path = body.report_rows_path || ''
    config.site_fallback = body.report_site_fallback
    config.map = {
      date: body.map_date || 'date', site: body.map_site || 'domain',
      impressions: body.map_impressions || 'impressions',
      clicks: body.map_clicks || 'clicks', revenue: body.map_revenue || 'revenue',
    }
  }

  // Test over the last 7 days
  const end = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]
  const res = await adapter(config, start, end)
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error })
  return NextResponse.json({ ok: true, rows: res.rows.length, sample: res.rows[0] || null })
}
