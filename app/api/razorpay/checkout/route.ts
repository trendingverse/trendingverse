import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 })

  const { currency = 'INR' } = await req.json()
  const amount = currency === 'INR' ? 83000 : 999 // paise: ₹830 or $9.99 (in cents)

  try {
    // Create Razorpay order
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: { user_id: user.id, email: user.email, plan: 'pro' },
      }),
    })
    const order = await res.json()
    if (!res.ok) throw new Error(order.error?.description || 'Failed to create order')

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      user_email: user.email,
      user_id: user.id,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  // Verify payment after success
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json()
  const keySecret = process.env.RAZORPAY_KEY_SECRET!

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id
  const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex')

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
  }

  // Upgrade user to Pro
  const now = new Date()
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  await supabase.from('user_profiles').update({
    plan: 'pro',
    subscription_status: 'active',
  }).eq('id', user.id)

  await supabase.from('subscriptions').insert({
    user_id: user.id,
    plan: 'pro',
    status: 'active',
    razorpay_order_id,
    razorpay_payment_id,
    current_period_start: now.toISOString(),
    current_period_end: nextMonth.toISOString(),
    updated_at: now.toISOString(),
  })

  return NextResponse.json({ success: true, plan: 'pro' })
}
