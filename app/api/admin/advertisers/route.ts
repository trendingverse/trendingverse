export const runtime = 'edge'
// app/api/admin/advertisers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

function authAdminHeaders() {
  return {
    'apikey': (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!,
    'Authorization': `Bearer ${(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!}`,
    'Content-Type': 'application/json',
  }
}

async function listAuthUsers(): Promise<{ id: string; email: string }[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`
  const res = await fetch(url, { headers: authAdminHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return (data.users || []).map((u: any) => ({ id: u.id, email: u.email || '' }))
}

async function createAuthUser(email: string, password: string, full_name: string, company_name: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`
  const res = await fetch(url, {
    method: 'POST',
    headers: authAdminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name, company_name } }),
  })
  const data = await res.json()
  if (!res.ok) return { error: data }
  return { user: data }
}

async function updateAuthUser(id: string, updates: { password?: string; user_metadata?: object }) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}`
  const res = await fetch(url, { method: 'PUT', headers: authAdminHeaders(), body: JSON.stringify(updates) })
  const data = await res.json()
  if (!res.ok) return { error: data }
  return { user: data }
}

async function deleteAuthUser(id: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${id}`
  await fetch(url, { method: 'DELETE', headers: authAdminHeaders() })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!)
  const { data } = await admin
    .from('user_profiles')
    .select('id, plan, company_name, role, created_at')
    .eq('role', 'advertiser')
    .order('created_at', { ascending: false })

  const users = await listAuthUsers()
  const emailMap: Record<string, string> = {}
  for (const u of users) emailMap[u.id] = u.email

  return NextResponse.json((data || []).map(p => ({ ...p, email: emailMap[p.id] || '' })))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!)
  const { email, password, full_name, company_name } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })

  const { user: newUser, error } = await createAuthUser(email, password, full_name, company_name)
  if (error) return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 400 })

  await admin.from('user_profiles').upsert({
    id: newUser.id,
    plan: 'pro',
    role: 'advertiser',
    company_name,
  })

  return NextResponse.json({ success: true, id: newUser.id })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const admin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!)
  const { id, company_name, full_name, new_password } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  if (company_name) {
    await admin.from('user_profiles').update({ company_name }).eq('id', id)
  }

  const authUpdates: any = {}
  if (full_name) authUpdates.user_metadata = { full_name, company_name }
  if (new_password) authUpdates.password = new_password
  if (Object.keys(authUpdates).length > 0) {
    const { error } = await updateAuthUser(id, authUpdates)
    if (error) return NextResponse.json({ error: error.message || 'Auth update failed' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await deleteAuthUser(id)
  return NextResponse.json({ success: true })
}
