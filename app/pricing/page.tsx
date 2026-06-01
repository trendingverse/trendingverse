'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

const FREE_FEATURES = [
  '5 articles per day',
  '1 WordPress site',
  'AI article generation (own API key)',
  '10 Indian languages',
  'Pexels auto featured image',
  'SEO Engine + meta tags',
  'Paste & Enrich tool',
  'Manual WordPress publish',
  'Basic analytics',
]

const PRO_FEATURES = [
  'Unlimited articles',
  'Multiple WordPress sites',
  'Platform AI keys included',
  'Daily auto-publish cron',
  'Paste & Enrich + SEO enrichment',
  'Google Search Console integration',
  'Google Analytics 4 integration',
  'Programmatic ad injection',
  'Adsterra revenue dashboard',
  'TrendingVerse Ads WordPress plugin',
  'All 10 Indian languages',
  'Priority support',
]

const BYOAK_FEATURES = [
  'Everything in Pro',
  'Use your own AI API keys',
  'GPT-4o + Claude + Gemini',
  'Lower monthly cost',
  'Full control over AI spend',
]

export default function PricingPage() {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR')
  const [loading, setLoading] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  async function subscribe(plan: string) {
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/razorpay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency, plan }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error)

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'TrendingVerse CMS',
        description: `${plan} Plan — Monthly Subscription`,
        order_id: order.order_id,
        prefill: { email: order.user_email },
        theme: { color: '#ef4444' },
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          const verifyRes = await fetch('/api/razorpay/checkout', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })
          const data = await verifyRes.json()
          if (data.success) {
            setSuccess(true)
            setTimeout(() => window.location.href = '/admin?upgraded=true', 2000)
          } else {
            alert('Payment verification failed. Contact support.')
          }
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
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            Trending<span className="text-red-500">Verse</span>
            <span className="text-xs font-normal text-gray-400 ml-1">CMS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
            <Link href="/signup" className="text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 font-medium">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-xs font-semibold bg-red-50 text-red-600 px-3 py-1 rounded-full uppercase tracking-wide">
            Pricing
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mt-4 mb-3">
            Start free. Scale when ready.
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            AI-powered CMS with programmatic ads, SEO tools and WordPress automation for Indian publishers
          </p>
          <div className="flex items-center justify-center gap-2 mt-6">
            <button onClick={() => setCurrency('INR')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === 'INR' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              ₹ INR
            </button>
            <button onClick={() => setCurrency('USD')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === 'USD' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              $ USD
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">

          {/* Free */}
          <div className="bg-white border border-gray-200 rounded-2xl p-7 flex flex-col">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Free</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">₹0</div>
              <div className="text-sm text-gray-400 mb-6">Forever free · no card needed</div>
              <ul className="space-y-2.5 mb-8">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/signup"
              className="mt-auto block text-center py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-gray-900 rounded-2xl p-7 relative flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Most popular
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pro</div>
              <div className="text-4xl font-bold text-white mb-1">
                {currency === 'INR' ? '₹830' : '$9.99'}
              </div>
              <div className="text-sm text-gray-500 mb-6">
                per month · {currency === 'INR' ? '~$9.99/mo' : '~₹830/mo'}
              </div>
              <ul className="space-y-2.5 mb-8">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <span className="text-red-400 font-bold mt-0.5 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-auto">
              <button onClick={() => subscribe('pro')} disabled={loadingPlan === 'pro'}
                className="w-full py-3 bg-red-500 rounded-xl text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                {loadingPlan === 'pro' ? 'Opening payment...' : `Subscribe ${currency === 'INR' ? '₹830' : '$9.99'}/mo`}
              </button>
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-xs text-gray-500">Powered by</span>
                <span className="text-xs font-bold text-blue-400">Razorpay</span>
              </div>
              <p className="text-xs text-gray-500 text-center mt-1">UPI · Cards · Net Banking · Wallets</p>
            </div>
          </div>

          {/* BYOAK */}
          <div className="bg-white border-2 border-violet-200 rounded-2xl p-7 flex flex-col">
            <div>
              <div className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-2">BYOAK</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">
                {currency === 'INR' ? '₹499' : '$5.99'}
              </div>
              <div className="text-sm text-gray-400 mb-6">
                per month · Bring Your Own API Keys
              </div>
              <ul className="space-y-2.5 mb-8">
                {BYOAK_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="text-violet-500 font-bold mt-0.5 shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            <button onClick={() => subscribe('byoak')} disabled={loadingPlan === 'byoak'}
              className="mt-auto w-full py-3 bg-violet-600 rounded-xl text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {loadingPlan === 'byoak' ? 'Opening payment...' : `Subscribe ${currency === 'INR' ? '₹499' : '$5.99'}/mo`}
            </button>
          </div>
        </div>

        {/* Feature comparison */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Everything compared</h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 font-medium text-gray-500">Feature</th>
                  <th className="text-center px-4 py-4 font-medium text-gray-500">Free</th>
                  <th className="text-center px-4 py-4 font-medium text-gray-900">Pro</th>
                  <th className="text-center px-4 py-4 font-medium text-violet-600">BYOAK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  ['AI Article Generation', '5/day', '∞', '∞'],
                  ['WordPress Sites', '1', '∞', '∞'],
                  ['10 Indian Languages', '✓', '✓', '✓'],
                  ['Pexels Auto Image', '✓', '✓', '✓'],
                  ['SEO Engine', '✓', '✓', '✓'],
                  ['Paste & Enrich Tool', '✓', '✓', '✓'],
                  ['AI Keys', 'Own key', 'Platform', 'Own key'],
                  ['GPT-4o + Claude', '✗', '✓', '✓'],
                  ['Auto-publish Cron', '✗', '✓', '✓'],
                  ['Google Search Console', '✗', '✓', '✓'],
                  ['Google Analytics 4', '✗', '✓', '✓'],
                  ['Programmatic Ads', '✗', '✓', '✓'],
                  ['Adsterra Dashboard', '✗', '✓', '✓'],
                  ['WP Ads Plugin', '✗', '✓', '✓'],
                  ['Revenue Split', '✗', '✓', '✓'],
                ].map(([feature, free, pro, byoak]) => (
                  <tr key={feature} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-700">{feature}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{free === '✗' ? <span className="text-gray-300">✗</span> : free === '✓' ? <span className="text-green-500">✓</span> : <span className="text-gray-600">{free}</span>}</td>
                    <td className="px-4 py-3 text-center font-medium">{pro === '✗' ? <span className="text-gray-300">✗</span> : pro === '✓' ? <span className="text-red-500">✓</span> : <span className="text-gray-900">{pro}</span>}</td>
                    <td className="px-4 py-3 text-center">{byoak === '✗' ? <span className="text-gray-300">✗</span> : byoak === '✓' ? <span className="text-violet-500">✓</span> : <span className="text-gray-600">{byoak}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trust signals */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-400">
            100% secure payments · Indian payment methods · Cancel anytime · No hidden charges
          </p>
          <div className="flex items-center justify-center gap-8 mt-6 text-gray-300 text-xs">
            <span>🔒 SSL Encrypted</span>
            <span>🇮🇳 Made for India</span>
            <span>⚡ Instant activation</span>
            <span>📧 24h support</span>
          </div>
        </div>
      </div>
    </div>
  )
}
