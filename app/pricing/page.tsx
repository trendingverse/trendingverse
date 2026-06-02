'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    priceINR: 0,
    priceUSD: 0,
    tagline: 'Forever free · no card needed',
    color: 'border-gray-200',
    badge: null,
    btnClass: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
    features: [
      '5 AI articles per day',
      '1 WordPress site',
      '10 Indian languages',
      'SEO Engine + meta tags',
      'Paste & Enrich tool',
      'Pexels auto featured image',
      'Manual WordPress publish',
      'Own AI API key required',
      'Basic analytics',
    ],
    cta: 'Get started free',
    href: '/signup',
  },
  {
    key: 'growth',
    name: 'Growth',
    priceINR: 399,
    priceUSD: 4.99,
    tagline: 'For growing publishers',
    color: 'border-blue-200',
    badge: null,
    btnClass: 'bg-blue-600 text-white hover:bg-blue-700',
    features: [
      '50 AI articles per day',
      '3 WordPress sites',
      '10 Indian languages',
      'SEO Engine + Paste & Enrich',
      'Own AI API key',
      'Daily auto-publish cron',
      'Google Search Console',
      'Google Analytics 4',
      'Basic ad injection',
    ],
    cta: 'Subscribe',
    href: null,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceINR: 799,
    priceUSD: 9.99,
    tagline: 'For serious publishers',
    color: 'border-transparent',
    badge: '🔥 Most popular',
    btnClass: 'bg-red-500 text-white hover:bg-red-600',
    dark: true,
    features: [
      'Unlimited AI articles',
      'Unlimited WordPress sites',
      'Platform AI keys included',
      'GPT-4o + Claude + Gemini',
      'Daily auto-publish cron',
      'Paste & Enrich + SEO',
      'Google Search Console + GA4',
      'Programmatic ad injection',
      'Ad revenue dashboard',
      'TrendingVerse Ads WP plugin',
      'Publisher management',
      'Revenue split control',
      'Priority support',
    ],
    cta: 'Subscribe',
    href: null,
  },
  {
    key: 'agency',
    name: 'Agency',
    priceINR: 1999,
    priceUSD: 24.99,
    tagline: 'For multi-site operators',
    color: 'border-violet-200',
    badge: null,
    btnClass: 'bg-violet-600 text-white hover:bg-violet-700',
    features: [
      'Everything in Pro',
      'Unlimited publishers',
      'Platform AI keys included',
      'White-label ready',
      'Dedicated support',
      'Custom revenue splits',
      'Advanced analytics',
      'Early access to new features',
    ],
    cta: 'Subscribe',
    href: null,
  },
]

const COMPARISON = [
  { feature: 'AI Articles/day',           free: '5',        growth: '50',       pro: '∞',     agency: '∞' },
  { feature: 'WordPress Sites',           free: '1',        growth: '3',        pro: '∞',     agency: '∞' },
  { feature: '10 Indian Languages',       free: '✓',        growth: '✓',        pro: '✓',     agency: '✓' },
  { feature: 'SEO Engine',                free: '✓',        growth: '✓',        pro: '✓',     agency: '✓' },
  { feature: 'Paste & Enrich',            free: '✓',        growth: '✓',        pro: '✓',     agency: '✓' },
  { feature: 'Platform AI Keys',          free: '✗',        growth: '✗',        pro: '✓',     agency: '✓' },
  { feature: 'Auto-publish Cron',         free: '✗',        growth: '✓',        pro: '✓',     agency: '✓' },
  { feature: 'Google Search Console',     free: '✗',        growth: '✓',        pro: '✓',     agency: '✓' },
  { feature: 'Google Analytics 4',        free: '✗',        growth: '✓',        pro: '✓',     agency: '✓' },
  { feature: 'Ad Injection',              free: '✗',        growth: 'Basic',    pro: '✓',     agency: '✓' },
  { feature: 'Revenue Dashboard',         free: '✗',        growth: '✗',        pro: '✓',     agency: '✓' },
  { feature: 'WP Ads Plugin',             free: '✗',        growth: '✗',        pro: '✓',     agency: '✓' },
  { feature: 'Publisher Management',      free: '✗',        growth: '✗',        pro: '✓',     agency: '✓' },
  { feature: 'Revenue Split Control',     free: '✗',        growth: '✗',        pro: '✓',     agency: '✓' },
  { feature: 'Unlimited Publishers',      free: '✗',        growth: '✗',        pro: '✗',     agency: '✓' },
  { feature: 'Dedicated Support',         free: '✗',        growth: '✗',        pro: '✗',     agency: '✓' },
]

export default function PricingPage() {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  async function subscribe(planKey: string) {
    setLoadingPlan(planKey)
    try {
      const res = await fetch('/api/razorpay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, plan: planKey }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error)
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'TrendingVerse CMS',
        description: `${planKey} Plan — Monthly Subscription`,
        order_id: order.order_id,
        prefill: { email: order.user_email },
        theme: { color: '#ef4444' },
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          const verifyRes = await fetch('/api/razorpay/checkout', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          })
          const data = await verifyRes.json()
          if (data.success) {
            setSuccess(true)
            setTimeout(() => window.location.href = '/admin?upgraded=true', 2000)
          } else alert('Payment verification failed. Contact support.')
        },
        modal: { ondismiss: () => setLoadingPlan(null) }
      })
      rzp.open()
    } catch (e) {
      alert((e as Error).message)
      setLoadingPlan(null)
    }
  }

  if (success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">Payment successful!</h1>
        <p className="text-gray-500 mt-2">Upgrading your account...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">Trending<span className="text-red-500">Verse</span></Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
            <Link href="/signup" className="text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-medium">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-semibold bg-red-50 text-red-600 px-3 py-1 rounded-full uppercase tracking-wide">Pricing</span>
          <h1 className="text-4xl font-bold text-gray-900 mt-4 mb-3">Publisher-first pricing</h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Every rupee you spend comes back multiplied. Publishers earning ₹3000/mo from ads pay just ₹399 — a 7x return.
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            {(['INR', 'USD'] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === c ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                {c === 'INR' ? '₹ INR' : '$ USD'}
              </button>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-4 gap-5 max-w-7xl mx-auto">
          {PLANS.map(plan => (
            <div key={plan.key}
              className={`rounded-2xl border-2 ${plan.color} ${plan.dark ? 'bg-gray-900' : 'bg-white'} p-6 flex flex-col relative`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                  {plan.badge}
                </div>
              )}
              <div>
                <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${plan.dark ? 'text-gray-400' : 'text-gray-400'}`}>
                  {plan.name}
                </div>
                <div className={`text-4xl font-bold mb-1 ${plan.dark ? 'text-white' : 'text-gray-900'}`}>
                  {plan.priceINR === 0 ? '₹0' : currency === 'INR' ? `₹${plan.priceINR}` : `$${plan.priceUSD}`}
                </div>
                <div className={`text-sm mb-6 ${plan.dark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {plan.priceINR === 0 ? 'Forever free' : `per month`}
                </div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      <span className={`font-bold mt-0.5 shrink-0 ${plan.dark ? 'text-red-400' : 'text-green-500'}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-auto">
                {plan.href ? (
                  <Link href={plan.href} className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${plan.btnClass}`}>
                    {plan.cta}
                  </Link>
                ) : (
                  <button onClick={() => subscribe(plan.key)} disabled={loadingPlan === plan.key}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${plan.btnClass}`}>
                    {loadingPlan === plan.key ? 'Opening...' : `${plan.cta} ${currency === 'INR' ? `₹${plan.priceINR}` : `$${plan.priceUSD}`}/mo`}
                  </button>
                )}
                {plan.key !== 'free' && (
                  <p className={`text-xs text-center mt-2 ${plan.dark ? 'text-gray-600' : 'text-gray-400'}`}>
                    UPI · Cards · Net Banking · Wallets
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ROI callout */}
        <div className="mt-12 bg-green-50 border border-green-100 rounded-2xl p-6 max-w-3xl mx-auto text-center">
          <h3 className="font-bold text-green-900 text-lg mb-2">💰 The math works in your favour</h3>
          <div className="grid grid-cols-3 gap-6 mt-4">
            {[
              { plan: 'Growth ₹399', earn: '₹2,000/mo', roi: '5x ROI' },
              { plan: 'Pro ₹799', earn: '₹5,000/mo', roi: '6x ROI' },
              { plan: 'Agency ₹1,999', earn: '₹20,000/mo', roi: '10x ROI' },
            ].map(r => (
              <div key={r.plan} className="text-center">
                <div className="text-xs text-green-600 font-medium">{r.plan}</div>
                <div className="text-lg font-bold text-green-900 mt-1">{r.earn} earnings</div>
                <div className="text-sm text-green-700 font-semibold">{r.roi}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-green-600 mt-4">Based on average publisher earnings from programmatic ads via TrendingVerse ad network</p>
        </div>

        {/* Comparison table */}
        <div className="mt-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Full feature comparison</h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Feature</th>
                  <th className="text-center px-3 py-3 font-medium text-gray-500">Free</th>
                  <th className="text-center px-3 py-3 font-medium text-blue-600">Growth</th>
                  <th className="text-center px-3 py-3 font-medium text-red-500">Pro</th>
                  <th className="text-center px-3 py-3 font-medium text-violet-600">Agency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COMPARISON.map(({ feature, free, growth, pro, agency }) => {
                  const renderCell = (val: string, color: string) => {
                    if (val === '✗') return <span className="text-gray-300">✗</span>
                    if (val === '✓') return <span className={`font-bold ${color}`}>✓</span>
                    return <span className="text-xs font-medium text-gray-700">{val}</span>
                  }
                  return (
                    <tr key={feature} className="hover:bg-gray-50/50">
                      <td className="px-5 py-2.5 text-gray-700">{feature}</td>
                      <td className="px-3 py-2.5 text-center">{renderCell(free, 'text-green-500')}</td>
                      <td className="px-3 py-2.5 text-center">{renderCell(growth, 'text-blue-500')}</td>
                      <td className="px-3 py-2.5 text-center">{renderCell(pro, 'text-red-500')}</td>
                      <td className="px-3 py-2.5 text-center">{renderCell(agency, 'text-violet-500')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust */}
        <div className="mt-12 text-center space-y-3">
          <p className="text-sm text-gray-400">100% secure · Cancel anytime · No hidden charges · Instant activation</p>
          <div className="flex items-center justify-center gap-8 text-gray-300 text-xs">
            <span>🔒 SSL Encrypted</span>
            <span>🇮🇳 Made for India</span>
            <span>⚡ Instant activation</span>
            <span>📧 24h support</span>
          </div>
          <p className="text-xs text-gray-400">
            Questions? <a href="mailto:support@trendingverse.online" className="text-red-500 hover:underline">support@trendingverse.online</a>
          </p>
        </div>
      </div>
    </div>
  )
}
