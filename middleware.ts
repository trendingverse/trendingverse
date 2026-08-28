// middleware.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

// Pages advertisers are allowed to access
const ADVERTISER_ALLOWED = ['/admin/outreach']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Update request so server components see refreshed tokens
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          // Recreate response with updated request
          response = NextResponse.next({ request })
          // Set on response so browser receives new cookies
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → redirect to login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin bypasses all restrictions
  if (user.email === ADMIN_EMAIL) return response

  // Check role for non-admin users
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'publisher'

  // Advertisers can only access outreach page
  if (role === 'advertiser') {
    const allowed = ADVERTISER_ALLOWED.some(p => pathname.startsWith(p))
    if (!allowed) {
      return NextResponse.redirect(new URL('/admin/outreach', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
