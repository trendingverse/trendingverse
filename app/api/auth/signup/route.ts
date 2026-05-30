import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email, password, full_name } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } }
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Send welcome email + admin notification (non-blocking)
  if (data.user) {
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: data.user.id,
        email: data.user.email,
        full_name: full_name || '',
        plan: 'free',
      }),
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, user: data.user })
}
