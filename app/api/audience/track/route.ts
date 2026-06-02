import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// IP geolocation using free API
async function getLocation(ip: string) {
  try {
    if (ip === '::1' || ip === '127.0.0.1') return { city: 'Local', state: 'Dev', country: 'India' }
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country,countryCode`, { signal: AbortSignal.timeout(2000) })
    const data = await res.json()
    return { city: data.city || '', state: data.regionName || '', country: data.country || 'India' }
  } catch { return { city: '', state: '', country: 'India' } }
}

function getDeviceType(ua: string): string {
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) {
    return /tablet|ipad/i.test(ua) ? 'tablet' : 'mobile'
  }
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { fingerprint, event_type, site_url, page_url, page_title, category, value, referrer } = body

  if (!fingerprint || !site_url) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const ua = req.headers.get('user-agent') || ''
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             req.headers.get('x-real-ip') || '127.0.0.1'

  const deviceType = getDeviceType(ua)
  const browser    = getBrowser(ua)
  const os         = getOS(ua)
  const location   = await getLocation(ip)

  // Log event
  await admin.from('audience_events').insert({
    fingerprint,
    site_url,
    page_url,
    page_title,
    category,
    event_type: event_type || 'pageview',
    value: String(value || ''),
    city: location.city,
    country: location.country,
    device_type: deviceType,
    referrer: referrer || '',
  })

  // Upsert audience profile
  const existing = await admin
    .from('audience_profiles')
    .select('id, page_views, total_time_seconds, interests')
    .eq('fingerprint', fingerprint)
    .single()

  const newInterests = category
    ? Array.from(new Set([...(existing.data?.interests || []), category]))
    : (existing.data?.interests || [])

  const extraTime = event_type === 'time_spent' ? parseInt(String(value || '0')) : 0

  if (existing.data) {
    await admin.from('audience_profiles').update({
      last_seen_at: new Date().toISOString(),
      page_views: (existing.data.page_views || 0) + (event_type === 'pageview' ? 1 : 0),
      total_time_seconds: (existing.data.total_time_seconds || 0) + extraTime,
      interests: newInterests,
      city: location.city || undefined,
      state: location.state || undefined,
      device_type: deviceType,
      browser,
      os,
    }).eq('fingerprint', fingerprint)
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

  return NextResponse.json({ ok: true })
}

// Lead capture
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { fingerprint, email, name, phone, city, gender, age_range, interests, source_site, source_page } = body

  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Save lead
  await admin.from('audience_leads').upsert({
    fingerprint,
    email: email.toLowerCase().trim(),
    name, phone, city, gender, age_range,
    interests: interests || [],
    source_site, source_page,
    opted_in: true,
  }, { onConflict: 'email' })

  // Update profile with email
  if (fingerprint) {
    await admin.from('audience_profiles').update({
      email: email.toLowerCase().trim(),
      name, city, gender, age_range,
      is_subscribed: true,
    }).eq('fingerprint', fingerprint)
  }

  return NextResponse.json({ ok: true })
}
