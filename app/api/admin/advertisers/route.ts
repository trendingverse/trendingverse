// app/api/admin/advertisers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await admin
    .from('user_profiles')
    .select('id, plan, company_name, role, articles_used_today, created_at')
    .eq('role', 'advertiser')
    .order('created_at', { ascending: false })

  // Get emails from auth
  const { data: { users } } = await admin.auth.admin.listUsers()
  const emailMap: Record<string, string> = {}
  for (const u of users || []) emailMap[u.id] = u.email || ''

  return NextResponse.json((data || []).map(p => ({ ...p, email: emailMap[p.id] || '' })))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { email, password, full_name, company_name } = await req.json()

  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  // Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name, company_name },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Set role to advertiser in user_profiles
  await admin.from('user_profiles').upsert({
    id: authData.user.id,
    plan: 'pro',
    role: 'advertiser',
    company_name,
  })

  // Send welcome email
  fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/email/welcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: authData.user.id, email, full_name, plan: 'advertiser' }),
  }).catch(() => {})

  return NextResponse.json({ success: true, id: authData.user.id })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await admin.auth.admin.deleteUser(id)
  return NextResponse.json({ success: true })
}
