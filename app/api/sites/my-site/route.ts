// app/api/sites/my-site/route.ts
// Returns the logged-in publisher's saved WordPress site credentials
// so publish flows can pre-fill them — no more retyping every time.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: site } = await supabase
    .from('sites')
    .select('site_url, wp_username, wp_app_password, language')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!site) return NextResponse.json({})
  return NextResponse.json(site)
}
