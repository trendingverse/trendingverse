// app/api/audience/geo-data/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from('audience_profiles')
    .select('country, state, city')
    .not('country', 'is', null)
    .order('country')

  if (!data) return NextResponse.json({ countries: [], states: [], cities: [] })

  const countries = [...new Set(data.map(r => r.country).filter(Boolean))].sort()
  const states = [...new Set(data.map(r => r.state).filter(Boolean))].sort()
  const cities = [...new Set(data.map(r => r.city).filter(Boolean))].sort()

  return NextResponse.json({ countries, states, cities })
}
