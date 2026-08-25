// app/api/auth/signout/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/login`
    : '/login'

  return NextResponse.redirect(new URL(redirectTo, 'https://trendingverse.vercel.app'))
}

// Also handle POST (some browsers prefer POST for sign-out)
export async function POST() {
  return GET()
}
