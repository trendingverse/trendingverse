// app/api/admin/publishers/[publisherId]/domains/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as svc } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

type Params = Promise<{ publisherId: string }>

function adminClient() {
  return svc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET  /api/admin/publishers/[publisherId]/domains
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { publisherId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminClient()
  const { data: site } = await db
    .from('sites')
    .select('id')
    .eq('user_id', publisherId)
    .single()

  if (!site) return NextResponse.json({ domains: [] })

  const { data: domains, error } = await db
    .from('site_domains')
    .select('*')
    .eq('site_id', site.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ domains: domains ?? [] })
}

// POST /api/admin/publishers/[publisherId]/domains
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { publisherId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const domain = (body.domain ?? '').trim().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  const label  = (body.label  ?? '').trim() || 'Additional Domain'
  const is_pwa = !!body.is_pwa

  if (!domain) return NextResponse.json({ error: 'Domain is required' }, { status: 400 })

  const db = adminClient()
  const { data: site } = await db
    .from('sites')
    .select('id')
    .eq('user_id', publisherId)
    .single()

  if (!site) return NextResponse.json({ error: 'Publisher site not found' }, { status: 404 })

  const { data, error } = await db
    .from('site_domains')
    .insert({ site_id: site.id, domain, label, is_pwa })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ domain: data })
}

// DELETE /api/admin/publishers/[publisherId]/domains  (body: { id })
export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  await params // satisfy Next.js 15 requirement
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = adminClient()
  const { error } = await db.from('site_domains').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/admin/publishers/[publisherId]/domains  (body: { id, label, is_pwa, is_active })
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  await params // satisfy Next.js 15 requirement
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['label', 'is_pwa', 'is_active']
  const patch = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k))
  )

  const db = adminClient()
  const { data, error } = await db
    .from('site_domains')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ domain: data })
}
