// app/auth/callback/route.ts
// Handles Supabase auth redirect — routes users by role after login
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'khan.khan.yusuf@gmail.com'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      // Route by role — never send non-admins into /admin/*
      if (user?.email === ADMIN_EMAIL) {
        return NextResponse.redirect(`${origin}/admin`)
      }

      // Publisher / advertiser → their own portal
      // 'next' param might contain /admin/* from a saved URL — ignore it
      const safeNext = next.startsWith('/admin') ? '/' : next
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  // Auth failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
