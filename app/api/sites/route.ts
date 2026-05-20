import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('sites').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check free plan site limit
  const { data: profile } = await supabase.from('user_profiles').select('plan').eq('id', user.id).single()
  const { count } = await supabase.from('sites').select('*', { count: 'exact', head: true }).eq('user_id', user.id)

  if (profile?.plan === 'free' && (count || 0) >= 1) {
    return NextResponse.json({ error: 'Free plan allows 1 site. Upgrade to Pro for multiple sites.' }, { status: 403 })
  }

  const body = await req.json()
  const { data, error } = await supabase.from('sites').insert({
    user_id: user.id,
    name: body.name,
    site_url: body.site_url,
    wp_username: body.wp_username,
    wp_app_password: body.wp_app_password,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
