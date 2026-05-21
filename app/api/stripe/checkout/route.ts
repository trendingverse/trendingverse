// ============================================================
// FILE 1: app/api/stripe/checkout/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })

const PRICES = {
  usd: process.env.STRIPE_PRICE_USD!, // $9.99/mo
  inr: process.env.STRIPE_PRICE_INR!, // ₹830/mo
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currency = 'usd' } = await req.json()
  const priceId = PRICES[currency as keyof typeof PRICES] || PRICES.usd
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://trendingverse.vercel.app'

  try {
    // Get or create Stripe customer
    const { data: profile } = await supabase.from('user_profiles').select('stripe_customer_id').eq('id', user.id).single()
    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email!, metadata: { supabase_user_id: user.id } })
      customerId = customer.id
      await supabase.from('user_profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/admin?upgraded=true`,
      cancel_url: `${siteUrl}/pricing`,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
