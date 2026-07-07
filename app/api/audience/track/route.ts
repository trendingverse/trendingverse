import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// IP geolocation — HTTPS endpoint (the http:// one gets blocked as mixed
// content and rate-limits harder). ipwho.is is free + HTTPS + no key.
async function getLocation(ip: string) {
  try {
    if (ip === '::1' || ip === '127.0.0.1' || !ip) return { city: '', state: '', country: 'India' }
    const res = await fetch(`https://ipwho.is/${ip}?fields=city,region,country`, { signal: AbortSignal.timeout(2500) })
    const data = await res.json()
    if (data && data.success !== false) {
      return { city: data.city || '', state: data.region || '', country: data.country || 'India' }
    }
  } catch { /* fall through */ }
  return { city: '', state: '', country: 'India' }
}

function getDeviceType(ua: string): string {
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) return /tablet|ipad/i.test(ua) ? 'tablet' : 'mobile'
  return 'desktop'
}
function getBrowser(ua: string): string {
  if (/chrome/i.test(ua) && !/edge/i.test(ua)) return 'Chrome'
  if (/firefox/i.test(ua)) return 'Firefox'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/edge/i.test(ua)) return 'Edge'
  return 'Other'
}
function getOS(ua: string): string {
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad/i.test(ua)) return 'iOS'
  if (/windows/i.test(ua)) return 'Windows'
  if (/mac/i.test(ua)) return 'Mac'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Other'
}

// Name→gender inference with a confidence level, so reports can show
// honest match rates ("gender known for X%") instead of guessing.
const MALE_NAMES = new Set(['raj','rahul','amit','vijay','suresh','ramesh','kumar','arun','anil','sanjay','ravi','mohan','krishna','ganesh','prakash','deepak','manoj','sunil','ashok','vikram','rohit','ajay','sandeep','naveen','kiran','gopal','harish','mahesh','nitin','pankaj'])
const FEMALE_NAMES = new Set(['priya','pooja','anjali','sunita','kavya','divya','meena','lakshmi','deepa','sneha','radha','geeta','sita','asha','rekha','shweta','neha','anita','kavita','swati','preeti','jyoti','usha','vidya','sushma','madhavi','bhavana','manju','shobha','archana'])

function inferGender(name: string): { gender: string | null; confidence: string } {
  if (!name) return { gender: null, confidence: 'none' }
  const first = name.trim().toLowerCase().split(/\s+/)[0]
  if (MALE_NAMES.has(first)) return { gender: 'male', confidence: 'medium' }
  if (FEMALE_NAMES.has(first)) return { gender: 'female', confidence: 'medium' }
  if (/(a|i)$/.test(first)) return { gender: 'female', confidence: 'low' }
  return { gender: null, confidence: 'none' }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const {
    fingerprint, event_type, event, site_url, page_url, page_title,
    category, value, referrer, email, name,
  } = body

  if (!fingerprint || !site_url) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── LEAD CAPTURE PATH (the fix) ──────────────────────────────
  // Tracker sends lead capture as POST with event:'lead_capture' + email.
  // Handle it HERE so captures save and enrich the fingerprint's profile.
  const isLead = !!email && (event === 'lead_capture' || event_type === 'lead')
  if (isLead) {
    const cleanEmail = email.toLowerCase().trim()
    const { gender, confidence } = inferGender(name || '')

    await admin.from('audience_leads').upsert({
      fingerprint,
      email: cleanEmail,
      name: name || null,
      source_site: site_url,
      source_page: page_url || null,
      opted_in: true,
    }, { onConflict: 'email' })

    if (fingerprint) {
      const enrich: any = { email: cleanEmail, name: name || null, is_subscribed: true }
      if (gender) { enrich.gender = gender; enrich.gender_confidence = confidence }
      await admin.from('audience_profiles').update(enrich).eq('fingerprint', fingerprint)
    }

    return NextResponse.json({ ok: true, captured: true }, { headers: corsHeaders })
  }

  // ── PAGEVIEW / EVENT PATH ────────────────────────────────────
  const ua = req.headers.get('user-agent') || ''
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') || '127.0.0.1'
  const deviceType = getDeviceType(ua)
  const browser = getBrowser(ua)
  const os = getOS(ua)
  const location = await getLocation(ip)

  // Event insert now includes state (was dropped before)
  await admin.from('audience_events').insert({
    fingerprint,
    site_url,
    page_url,
    page_title,
    category,
    event_type: event_type || 'pageview',
    value: String(value || ''),
    city: location.city,
    state: location.state,
    country: location.country,
    device_type: deviceType,
    referrer: referrer || '',
  })

  // maybeSingle() avoids the PGRST116 throw on brand-new fingerprints
  const { data: existing } = await admin
    .from('audience_profiles')
    .select('id, page_views, total_time_seconds, interests')
    .eq('fingerprint', fingerprint)
    .maybeSingle()

  const newInterests = category
    ? Array.from(new Set([...(existing?.interests || []), category]))
    : (existing?.interests || [])
  const extraTime = event_type === 'time_spent' ? parseInt(String(value || '0')) || 0 : 0

  if (existing) {
    const upd: any = {
      last_seen_at: new Date().toISOString(),
      page_views: (existing.page_views || 0) + (event_type === 'pageview' ? 1 : 0),
      total_time_seconds: (existing.total_time_seconds || 0) + extraTime,
      interests: newInterests,
      device_type: deviceType,
      browser,
      os,
    }
    // Don't blank a previously-good location with an empty result
    if (location.city) upd.city = location.city
    if (location.state) upd.state = location.state
    await admin.from('audience_profiles').update(upd).eq('fingerprint', fingerprint)
  } else {
    await admin.from('audience_profiles').insert({
      fingerprint,
      city: location.city,
      state: location.state,
      country: location.country,
      device_type: deviceType,
      browser,
      os,
      interests: newInterests,
      source_site: site_url,
      page_views: event_type === 'pageview' ? 1 : 0,
    })
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders })
}

// PUT kept for backward compatibility if anything still calls it
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { fingerprint, email, name, phone, city, gender, age_range, interests, source_site, source_page } = body
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400, headers: corsHeaders })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const cleanEmail = email.toLowerCase().trim()

  await admin.from('audience_leads').upsert({
    fingerprint, email: cleanEmail, name, phone, city, gender, age_range,
    interests: interests || [], source_site, source_page, opted_in: true,
  }, { onConflict: 'email' })

  if (fingerprint) {
    const upd: any = { email: cleanEmail, name, is_subscribed: true }
    if (city) upd.city = city
    if (gender) { upd.gender = gender; upd.gender_confidence = 'declared' }
    if (age_range) upd.age_range = age_range
    await admin.from('audience_profiles').update(upd).eq('fingerprint', fingerprint)
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders })
}
