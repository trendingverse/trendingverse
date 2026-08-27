// app/auth/callback/route.ts
// Restored to original behaviour — only added admin email routing on top
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'khan.khan.yusuf@gmail.com'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Original default was /admin/outreach — restored so advertisers land correctly
  const next = searchParams.get('next') ?? '/admin/outreach'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* OK in redirect context */ }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      // Admin → always land on dashboard (or the specific admin page they came from)
      if (user?.email === ADMIN_EMAIL) {
        const adminDest = next.startsWith('/admin') ? next : '/admin'
        return NextResponse.redirect(`${origin}${adminDest}`)
      }

      // Everyone else (publishers, advertisers) → use original next param
      // Middleware handles role-based page restrictions after this
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
