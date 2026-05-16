import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('site_settings').select('*').order('category')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(Object.fromEntries(data.map(s => [s.key, s.value])))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const upserts = Object.entries(body).map(([key, value]) => ({ key, value: String(value), updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('site_settings').upsert(upserts, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
