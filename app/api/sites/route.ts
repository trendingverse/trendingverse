import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

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

  // Admin can see all sites or filter by publisher
  if (user.email === ADMIN_EMAIL) {
    let query = admin.from('sites').select('id, name, site_url, user_id, is_active').eq('is_active', true)
    if (publisherId) query = query.eq('user_id', publisherId)
    const { data } = await query.order('created_at', { ascending: false })
    return NextResponse.json(data || [])
  }

  // Publishers see only their own sites
  const { data } = await admin.from('sites').select('id, name, site_url, user_id').eq('user_id', user.id).eq('is_active', true)
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
