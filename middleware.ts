// middleware.ts — root of project
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'
const ADVERTISER_ALLOWED = ['/admin/outreach']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  // IMPORTANT: must recreate response each time setAll is called
  // so that forwarded request has refreshed cookies too
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          // Write to request so server components get refreshed tokens
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Recreate response with updated request
          supabaseResponse = NextResponse.next({ request })
          // Write to response so browser gets new cookies
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verify user — this also refreshes expired tokens via setAll above
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → login with redirect back
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    // Copy any refreshed cookies to redirect response
    supabaseResponse.cookies.getAll().forEach(({ name, value }) =>
      redirectResponse.cookies.set(name, value)
    )
    return redirectResponse
  }

  // Admin → full access
  if (user.email === ADMIN_EMAIL) return supabaseResponse

  // Non-admin: only allowed on specific paths
  const allowed = ADVERTISER_ALLOWED.some(p => pathname.startsWith(p))
  if (!allowed) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
