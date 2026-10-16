// app/api/publisher/payouts/route.ts
// Returns payout history for the currently logged-in publisher.
// Looks up the publisher in publishers_db by their auth email,
// then returns their publisher_payouts rows — no admin access needed.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function svc() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = svc()

  // Find this publisher's record in the outreach DB by email
  const { data: pub } = await admin
    .from('publishers_db')
    .select('id, name, onboarding_status')
    .eq('email', user.email)
    .maybeSingle()

  if (!pub) {
    return NextResponse.json({ payouts: [], total_inr: 0 })
  }

  const { data: payouts } = await admin
    .from('publisher_payouts')
    .select('id, month, amount_inr, notes, paid_at, created_at')
    .eq('publisher_id', pub.id)
    .order('month', { ascending: false })
    .limit(36) // up to 3 years of history

  const rows = payouts || []
  const total_inr = rows.reduce((s, p) => s + Number(p.amount_inr || 0), 0)

  return NextResponse.json({ payouts: rows, total_inr })
}
