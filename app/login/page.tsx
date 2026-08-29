'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'khan.khan.yusuf@gmail.com'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }

    // Admin → dashboard
    if (email === ADMIN_EMAIL) {
      router.push('/admin')
      router.refresh()
      return
    }

    // Check role for non-admin users
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profile?.role || 'publisher'

      if (role === 'advertiser') {
        router.push('/admin/outreach')  // Advertisers → outreach panel
      } else {
        router.push('/admin')           // Publishers → admin dashboard
      }
    } else {
      router.push('/admin')
    }

    router.refresh()
  }

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent text-white text-lg font-bold mb-4">TV</div>
          <h1 className="text-2xl font-bold text-ink-950">TrendingVerse</h1>
          <p className="text-sm text-ink-400 mt-1">Admin Dashboard</p>
        </div>
        <div className="card p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="label">Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="input" placeholder="admin@trendingverse.online" required autoFocus /></div>
            <div><label className="label">Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="input" placeholder="••••••••" required /></div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">{loading ? 'Signing in…' : 'Sign in →'}</button>
          </form>
          <p className="text-center text-xs text-ink-400 mt-6"><a href="/" className="hover:text-accent">← Back to site</a></p>
        </div>
      </div>
    </div>
  )
}
