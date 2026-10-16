// app/api/track/pixel/route.ts
// Conversion pixel endpoint — returns a 1x1 transparent GIF and logs the conversion.
// Advertisers embed: <img src="https://<host>/api/track/pixel?t={pixel_token}" width="1" height="1" style="display:none" alt="">
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// 1x1 transparent GIF (base64)
const PIXEL_B64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const PIXEL = Buffer.from(PIXEL_B64, 'base64')

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')

  if (token) {
    try {
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Look up campaign by pixel_token
      const { data: ad } = await admin
        .from('direct_ads')
        .select('id')
        .eq('pixel_token', token)
        .maybeSingle()

      if (ad?.id) {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || req.headers.get('x-real-ip')
          || null
        const userAgent = req.headers.get('user-agent') || null
        const referrer  = req.headers.get('referer') || null

        // Log conversion row + increment counter (parallel)
        await Promise.all([
          admin.from('direct_ad_conversions').insert({
            ad_id:       ad.id,
            pixel_token: token,
            ip,
            user_agent:  userAgent,
            referrer,
          }),
          admin.rpc('increment_ad_conversions', { p_ad_id: ad.id }).then(({ error }) => {
            // Fallback: if RPC doesn't exist yet, do a manual read-increment-write
            if (error) {
              return admin
                .from('direct_ads')
                .select('conversions')
                .eq('id', ad.id)
                .single()
                .then(({ data }) =>
                  admin.from('direct_ads')
                    .update({ conversions: (data?.conversions || 0) + 1 })
                    .eq('id', ad.id)
                )
            }
          }),
        ])
      }
    } catch {
      // Never let tracking errors block the pixel response
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type':  'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma':        'no-cache',
      'Expires':       '0',
    },
  })
}
