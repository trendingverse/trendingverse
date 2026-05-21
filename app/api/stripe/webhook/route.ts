// ============================================================
// FILE 2: app/api/stripe/webhook/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (e) {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const sub = (event.data.object as Stripe.Subscription)
  const userId = sub.metadata?.user_id

  if (!userId) return NextResponse.json({ received: true })

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const isActive = ['active', 'trialing'].includes(sub.status)
      await supabase.from('user_profiles').update({
        plan: isActive ? 'pro' : 'free',
        stripe_subscription_id: sub.id,
        subscription_status: sub.status,
      }).eq('id', userId)
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_subscription_id: sub.id,
        stripe_customer_id: sub.customer as string,
        plan: isActive ? 'pro' : 'free',
        status: sub.status,
        current_period_start: new Date((sub as Stripe.Subscription & { current_period_start: number }).current_period_start * 1000).toISOString(),
        current_period_end: new Date((sub as Stripe.Subscription & { current_period_end: number }).current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'stripe_subscription_id' })
      break
    }
    case 'customer.subscription.deleted': {
      await supabase.from('user_profiles').update({ plan: 'free', subscription_status: 'canceled' }).eq('id', userId)
      await supabase.from('subscriptions').update({ status: 'canceled', plan: 'free', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', sub.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
