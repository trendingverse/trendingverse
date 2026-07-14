import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

// Only these columns may be updated via PATCH — guards against a client
// sending arbitrary fields (id, created_by, created_at stay immutable).
const EDITABLE_FIELDS = [
  'name', 'ad_type', 'position', 'ad_code',
  'gam_network_code', 'gam_unit_path',
  'size_width', 'size_height', 'is_active',
  'network_name', 'site_url',
] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('ad_units')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  const { data, error } = await supabase.from('ad_units').insert({
    name: body.name,
    ad_type: body.ad_type,
    position: body.position,
    ad_code: body.ad_code,
    gam_network_code: body.gam_network_code || null,
    gam_unit_path: body.gam_unit_path || null,
    size_width: body.size_width || 728,
    size_height: body.size_height || 90,
    is_active: true,
    created_by: user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing ad unit id' }, { status: 400 })

  // Whitelist only editable fields that were actually provided.
  const updates: Record<string, any> = {}
  for (const key of EDITABLE_FIELDS) {
    if (key in body && body[key] !== undefined) updates[key] = body[key]
  }

  // Normalise numeric fields so a stray string doesn't hit the DB.
  if ('size_width' in updates) updates.size_width = parseInt(updates.size_width, 10) || 0
  if ('size_height' in updates) updates.size_height = parseInt(updates.size_height, 10) || 0
  // Empty GAM fields should be null, not '', to match the POST convention.
  if (updates.gam_network_code === '') updates.gam_network_code = null
  if (updates.gam_unit_path === '') updates.gam_unit_path = null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ad_units')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await req.json()
  const { error } = await supabase.from('ad_units').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
