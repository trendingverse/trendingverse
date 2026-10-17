// app/api/audience/direct-ads/line-items/route.ts
// CRUD for direct_ad_line_items — admin only.
// GET  ?ad_id=<uuid>   → list all line items for a campaign
// POST                 → create a new line item  { ad_id, ad_type, ... }
// PATCH                → update   { id, ...fields }
// DELETE ?id=<uuid>    → delete one line item
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return null
  return user
}

// ── GET — list line items for a campaign ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const ad_id = new URL(req.url).searchParams.get('ad_id')
  if (!ad_id) return NextResponse.json({ error: 'ad_id required' }, { status: 400 })

  const admin = adminClient()
  const { data, error } = await admin
    .from('direct_ad_line_items')
    .select('*')
    .eq('ad_id', ad_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// ── POST — create a line item ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const body = await req.json()
  if (!body.ad_id) return NextResponse.json({ error: 'ad_id required' }, { status: 400 })
  if (!body.ad_type) return NextResponse.json({ error: 'ad_type required' }, { status: 400 })

  // Coerce empty strings to null for URL/text fields
  const nullify = (v: any) => (v === '' ? null : v)
  const payload = {
    ad_id:           body.ad_id,
    ad_type:         body.ad_type,
    headline:        nullify(body.headline),
    description:     nullify(body.description),
    cta_text:        nullify(body.cta_text),
    destination_url: nullify(body.destination_url),
    image_url:       nullify(body.image_url),
    video_url:       nullify(body.video_url),
    video_thumbnail: nullify(body.video_thumbnail),
    is_active:       body.is_active !== false,
    notes:           nullify(body.notes),
  }

  const admin = adminClient()
  const { data, error } = await admin
    .from('direct_ad_line_items')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// ── PATCH — update a line item ────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const nullify = (v: any) => (v === '' ? null : v)
  const payload: Record<string, any> = { updated_at: new Date().toISOString() }
  const textFields = ['headline', 'description', 'cta_text', 'destination_url', 'image_url', 'video_url', 'video_thumbnail', 'notes']
  for (const f of textFields) if (f in updates) payload[f] = nullify(updates[f])
  if ('ad_type'   in updates) payload.ad_type   = updates.ad_type
  if ('is_active' in updates) payload.is_active = updates.is_active

  const admin = adminClient()
  const { error } = await admin
    .from('direct_ad_line_items')
    .update(payload)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// ── DELETE — remove a line item ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = adminClient()
  const { error } = await admin
    .from('direct_ad_line_items')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
