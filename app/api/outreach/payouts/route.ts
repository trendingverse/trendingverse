import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function isAdmin(req: NextRequest) {
  const auth = req.headers.get('x-user-email')
  return auth === ADMIN_EMAIL
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const publisherId = req.nextUrl.searchParams.get('publisher_id')
  if (!publisherId) return NextResponse.json({ error: 'publisher_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('publisher_payouts')
    .select('*')
    .eq('publisher_id', publisherId)
    .order('month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { publisher_id, month, amount_inr, notes } = body

  if (!publisher_id || !month || !amount_inr) {
    return NextResponse.json({ error: 'publisher_id, month, amount_inr required' }, { status: 400 })
  }

  // Upsert by publisher_id + month
  const { data, error } = await supabase
    .from('publisher_payouts')
    .upsert(
      { publisher_id, month, amount_inr, notes: notes || null, paid_at: new Date().toISOString() },
      { onConflict: 'publisher_id,month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
