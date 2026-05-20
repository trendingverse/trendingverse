'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      })
      if (error) throw error
      router.push('/onboarding')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-bold text-xl">Trending<span className="text-red-500">Verse</span> <span className="text-xs font-normal text-gray-400">CMS</span></Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Free plan · No credit card required</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email address</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400"
              placeholder="Min 8 characters"
              minLength={8}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account...' : 'Create free account'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="text-red-500 font-medium hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
