// app/api/admin/delete-wp-posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const WP_BASE     = (process.env.WP_URL || '').replace(/\/$/, '')
const WP_AUTH     = Buffer.from(`${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`).toString('base64')
const WP_HEADERS  = { 'Authorization': `Basic ${WP_AUTH}` }

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids') || ''
  const force = searchParams.get('force') === 'true' // permanently delete instead of trash
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)

  if (!ids.length) {
    return NextResponse.json({ error: 'Pass ?ids=1791,1800,1802,... in the query string' }, { status: 400 })
  }

  const results: any[] = []

  for (const id of ids) {
    try {
      const url = `${WP_BASE}/wp-json/wp/v2/posts/${id}${force ? '?force=true' : ''}`
      const res = await fetch(url, { method: 'DELETE', headers: WP_HEADERS })
      const text = await res.text()
      let body: any = null
      try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }

      results.push({
        id,
        status: res.status,
        ok: res.ok,
        response: body,
      })
    } catch (e) {
      results.push({ id, ok: false, error: (e as Error).message })
    }
    await new Promise(r => setTimeout(r, 300))
  }

  return NextResponse.json({
    force,
    total: ids.length,
    succeeded: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  })
}
