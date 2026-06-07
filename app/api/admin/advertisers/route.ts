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
    .select('id, plan, company_name, role, created_at')
    .eq('role', 'advertiser')
    .order('created_at', { ascending: false })

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

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { full_name, company_name },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await admin.from('user_profiles').upsert({
    id: authData.user.id,
    plan: 'pro',
    role: 'advertiser',
    company_name,
  })

  return NextResponse.json({ success: true, id: authData.user.id })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { id, company_name, full_name, new_password } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Update user_profiles
  const profileUpdates: any = {}
  if (company_name) profileUpdates.company_name = company_name
  if (Object.keys(profileUpdates).length > 0) {
    await admin.from('user_profiles').update(profileUpdates).eq('id', id)
  }

  // Update auth user metadata + password if provided
  const authUpdates: any = {}
  if (full_name) authUpdates.user_metadata = { full_name, company_name }
  if (new_password) authUpdates.password = new_password
  if (Object.keys(authUpdates).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(id, authUpdates)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
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
