export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function isAdmin(req: NextRequest) {
  return req.headers.get('x-user-email') === ADMIN_EMAIL
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adId = req.nextUrl.searchParams.get('ad_id')
  if (!adId) return NextResponse.json({ error: 'ad_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('direct_ad_events')
    .select('*')
    .eq('ad_id', adId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { ad_id, event_type, description, metadata } = body

  if (!ad_id || !event_type || !description) {
    return NextResponse.json({ error: 'ad_id, event_type, description required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('direct_ad_events')
    .insert({
      ad_id,
      event_type,
      description,
      metadata: metadata || null,
      created_by: req.headers.get('x-user-email') || 'admin',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
