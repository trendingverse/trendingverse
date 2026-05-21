'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<'INR'|'USD'>('INR')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  async function subscribe() {
    setLoading(true)
    try {
      // Step 1: Create order
      const res = await fetch('/api/razorpay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      })
      const order = await res.json()
      if (!res.ok) throw new Error(order.error)

      // Step 2: Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'TrendingVerse CMS',
        description: 'Pro Plan — Monthly Subscription',
        order_id: order.order_id,
        prefill: { email: order.user_email },
        theme: { color: '#ef4444' },
        handler: async function(response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          // Step 3: Verify payment
          const verifyRes = await fetch('/api/razorpay/checkout', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.success) {
            setSuccess(true)
            setTimeout(() => window.location.href = '/admin?upgraded=true', 2000)
          } else {
            alert('Payment verification failed. Contact support.')
          }
        },
        modal: { ondismiss: () => setLoading(false) }
      })
      rzp.open()
    } catch (e) {
      alert((e as Error).message)
      setLoading(false)
    }
  }

  if (success) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">Payment successful!</h1>
        <p className="text-gray-500 mt-2">Upgrading your account to Pro...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Link href="/" className="font-bold text-xl">Trending<span className="text-red-500">Verse</span> <span className="text-xs font-normal text-gray-400">CMS</span></Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-6 mb-3">Choose your plan</h1>
          <p className="text-gray-500">Start free, upgrade when you need more</p>

          {/* Currency toggle */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <button onClick={() => setCurrency('INR')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === 'INR' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              ₹ INR
            </button>
            <button onClick={() => setCurrency('USD')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === 'USD' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
              $ USD
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Free */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8">
            <div className="text-sm font-medium text-gray-500 mb-2">Free</div>
            <div className="text-4xl font-bold text-gray-900 mb-1">₹0</div>
            <div className="text-sm text-gray-400 mb-8">Forever free</div>
            <ul className="space-y-3 mb-8">
              {['5 articles per day','1 WordPress site','AI article generation','Pexels photo auto-fetch','Manual publish only','10 Indian languages','Basic analytics'].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-green-500 font-bold">✓</span>{f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="block text-center py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Get started free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-gray-900 rounded-2xl p-8 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full">Most popular</div>
            <div className="text-sm font-medium text-gray-400 mb-2">Pro</div>
            <div className="text-4xl font-bold text-white mb-1">
              {currency === 'INR' ? '₹830' : '$9.99'}
            </div>
            <div className="text-sm text-gray-500 mb-8">per month · {currency === 'INR' ? '~$9.99/mo' : '~₹830/mo'}</div>
            <ul className="space-y-3 mb-8">
              {['Unlimited articles','Multiple WordPress sites','Daily auto-publish cron','NewsAPI India trends','Full analytics + cron history','All 10 Indian languages','Priority support'].map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                  <span className="text-red-400 font-bold">✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={subscribe} disabled={loading}
              className="w-full py-3 bg-red-500 rounded-xl text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
              {loading ? 'Opening payment...' : `Pay ${currency === 'INR' ? '₹830' : '$9.99'}/mo`}
            </button>
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="text-xs text-gray-500">Powered by</span>
              <span className="text-xs font-bold text-blue-400">Razorpay</span>
            </div>
            <p className="text-xs text-gray-500 text-center mt-1">UPI · Cards · Net Banking · Wallets</p>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-400">
          <p>100% secure payments · Indian payment methods supported · Cancel anytime</p>
        </div>
      </div>
    </div>
  )
}
