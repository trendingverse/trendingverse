// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'khan.khan.yusuf@gmail.com'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? ''  // saved by middleware
  const next     = searchParams.get('next')     ?? ''

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll()   { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* read-only context — OK in redirects */ }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email === ADMIN_EMAIL) {
        // Admin: honour the redirect param (e.g. /admin/articles)
        // so clicking a link, getting kicked to login, then logging in
        // lands back on the page they wanted
        const adminDest = redirect?.startsWith('/admin')
          ? `${origin}${redirect}`
          : `${origin}/admin`
        return NextResponse.redirect(adminDest)
      }

      // Non-admin: use redirect/next but NEVER allow /admin/* (except outreach)
      const intended = redirect || next
      const safe = intended && !intended.startsWith('/admin')
        ? `${origin}${intended}`
        : `${origin}/`
      return NextResponse.redirect(safe)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
