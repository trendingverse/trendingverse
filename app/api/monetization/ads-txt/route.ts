import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

// GET — fetch all ads.txt entries
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ads_txt_entries')
    .select('*')
    .eq('is_active', true)
    .order('domain')
  if (error) return NextResponse.json({ error: error.message, details: error }, { status: 500 })
return NextResponse.json(data, { status: 201 })
}

// POST — add new entry
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabase.from('ads_txt_entries').insert({
    domain: body.domain,
    publisher_id: body.publisher_id,
    relationship: body.relationship,
    certification_authority_id: body.certification_authority_id || null,
    notes: body.notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE — remove entry
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  await supabase.from('ads_txt_entries').update({ is_active: false }).eq('id', id)
  return NextResponse.json({ success: true })
}
