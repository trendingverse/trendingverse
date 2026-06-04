// app/api/audience/ad-performance/route.ts
// Returns daily performance per ad unit for optimization dashboard
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const days = parseInt(new URL(req.url).searchParams.get('days') || '7')
  const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

  const { data } = await admin
    .from('ad_unit_performance')
    .select('*')
    .gte('date', since)
    .order('date', { ascending: false })

  return NextResponse.json(data || [])
}

// POST — import daily stats manually or from API sync
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await req.json()
  // body: { ad_unit_id, network_name, date, impressions, clicks, revenue_usd }
  const { error } = await admin
    .from('ad_unit_performance')
    .upsert(body, { onConflict: 'ad_unit_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
