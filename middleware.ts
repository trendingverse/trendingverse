// middleware.ts — root of project
// Restored to original working version + proper token refresh pattern
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const ADVERTISER_ALLOWED = ['/admin/outreach']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  // Must recreate supabaseResponse inside setAll for proper token refresh
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Update request cookies so server components see refreshed tokens
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          // Set on response so browser receives updated cookies
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const res = NextResponse.redirect(loginUrl)
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value))
    return res
  }

  // Admin → full access to all /admin/* pages
  if (user.email === ADMIN_EMAIL) return supabaseResponse

  // Non-admin authenticated users:
  // Check role from user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'publisher'

  // Advertisers: only /admin/outreach
  if (role === 'advertiser') {
    const allowed = ADVERTISER_ALLOWED.some(p => pathname.startsWith(p))
    if (!allowed) {
      return NextResponse.redirect(new URL('/admin/outreach', request.url))
    }
    return supabaseResponse
  }

  // Publishers: redirect to their own portal (not admin)
  // Change this URL to wherever the publisher dashboard actually lives
  return NextResponse.redirect(new URL('/admin/outreach', request.url))
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
