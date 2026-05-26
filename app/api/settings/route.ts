import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get settings for THIS user only
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Return defaults if no settings yet
  return NextResponse.json(data?.settings || {
    site_name: '',
    tagline: 'Breaking News & Trending Stories',
    site_url: '',
    footer_text: '',
    articles_per_page: '12',
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Upsert settings for THIS user only
  const { error } = await supabase
    .from('settings')
    .upsert({
      user_id: user.id,
      settings: body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
