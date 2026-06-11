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
  const filterCountries = searchParams.getAll('country') // can pass multiple
  const filterStates    = searchParams.getAll('state')

  // Always fetch all countries
  const { data: countriesData } = await admin
    .from('audience_profiles')
    .select('country')
    .not('country', 'is', null)
    .limit(5000)
  const countries = [...new Set((countriesData || []).map(r => r.country).filter(Boolean))].sort()

  // States — filter by selected countries if provided
  let statesQuery = admin.from('audience_profiles').select('state, country').not('state', 'is', null).not('state', 'eq', '').limit(5000)
  if (filterCountries.length > 0) {
    statesQuery = statesQuery.in('country', filterCountries)
  }
  const { data: statesData } = await statesQuery
  const states = [...new Set((statesData || []).map(r => r.state).filter(Boolean))].sort()

  // Cities — filter by selected states if provided, else by countries
  let citiesQuery = admin.from('audience_profiles').select('city, state, country').not('city', 'is', null).not('city', 'eq', '').limit(5000)
  if (filterStates.length > 0) {
    citiesQuery = citiesQuery.in('state', filterStates)
  } else if (filterCountries.length > 0) {
    citiesQuery = citiesQuery.in('country', filterCountries)
  }
  const { data: citiesData } = await citiesQuery
  const cities = [...new Set((citiesData || []).map(r => r.city).filter(Boolean))].sort()

  return NextResponse.json({ countries, states, cities })
}
