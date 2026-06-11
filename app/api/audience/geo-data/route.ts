// app/api/audience/geo-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(req.url)
  const filterCountries = searchParams.getAll('country')
  const filterStates    = searchParams.getAll('state')

  // Use SQL functions for true DISTINCT — no row limit issues
  const [cRes, sRes, ciRes] = await Promise.all([
    admin.rpc('get_distinct_countries'),
    filterCountries.length > 0
      ? admin.rpc('get_distinct_states', { filter_country: filterCountries })
      : Promise.resolve({ data: [] }),
    filterStates.length > 0
      ? admin.rpc('get_distinct_cities', { filter_state: filterStates, filter_country: [] })
      : filterCountries.length > 0
        ? admin.rpc('get_distinct_cities', { filter_state: [], filter_country: filterCountries })
        : Promise.resolve({ data: [] }),
  ])

  const countries = (cRes.data || []).map((r: any) => r.country || r).filter(Boolean)
  const states    = (sRes.data || []).map((r: any) => r.state   || r).filter(Boolean)
  const cities    = (ciRes.data || []).map((r: any) => r.city   || r).filter(Boolean)

  return NextResponse.json({ countries, states, cities })
}
