import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

const PLAN_SITE_LIMITS: Record<string, number> = {
  free: 1, growth: 3, pro: -1, byoak: -1, agency: -1,
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const publisherId = searchParams.get('publisher_id')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (user.email === ADMIN_EMAIL) {
    let query = admin.from('sites').select('id, name, site_url, user_id, is_active').eq('is_active', true)
    if (publisherId) query = query.eq('user_id', publisherId)
    const { data } = await query.order('created_at', { ascending: false })
    return NextResponse.json(data || [])
  }

  const { data } = await admin.from('sites').select('id, name, site_url, user_id').eq('user_id', user.id).eq('is_active', true)
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get user plan
  const { data: profile } = await admin.from('user_profiles').select('plan').eq('id', user.id).single()
  const plan = profile?.plan || 'free'
  const siteLimit = PLAN_SITE_LIMITS[plan] ?? 1

  // Check site count if not unlimited
  if (siteLimit !== -1) {
    const { count } = await admin.from('sites').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true)
    if ((count || 0) >= siteLimit) {
      return NextResponse.json({
        error: `Your ${plan} plan allows ${siteLimit} site${siteLimit > 1 ? 's' : ''}. Upgrade to add more.`,
        upgrade_required: true,
        upgrade_url: '/pricing',
      }, { status: 403 })
    }
  }

  const body = await req.json()
  const { data, error } = await admin.from('sites').insert({
    user_id: user.id,
    name: body.name,
    site_url: body.site_url?.replace(/\/$/, ''),
    wp_username: body.wp_username || null,
    wp_app_password: body.wp_app_password || null,
    is_active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
