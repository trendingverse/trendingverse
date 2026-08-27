// app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'khan.khan.yusuf@gmail.com'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('redirect') ?? ''
  const next     = searchParams.get('next')     ?? ''

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)

    const { data: { user } } = await supabase.auth.getUser()

    // Admin → always land on /admin dashboard
    if (user?.email === ADMIN_EMAIL) {
      return NextResponse.redirect(`${origin}/admin`)
    }

    // Non-admin → use redirect/next param but NEVER allow /admin/* routes
    // This prevents advertisers/publishers from being looped into admin
    const intended = redirect || next
    const safeUrl  = intended && !intended.startsWith('/admin')
      ? intended
      : '/'

    return NextResponse.redirect(`${origin}${safeUrl}`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
