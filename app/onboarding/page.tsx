'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [siteName, setSiteName] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [wpUser, setWpUser] = useState('')
  const [wpPass, setWpPass] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle'|'success'|'error'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function testConnection() {
    if (!siteUrl || !wpUser || !wpPass) return alert('Fill in all WordPress fields')
    setTesting(true)
    setTestResult('idle')
    try {
      const base = siteUrl.replace(/\/$/, '')
      const auth = btoa(`${wpUser}:${wpPass}`)
      const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=1`, {
        headers: { Authorization: `Basic ${auth}` }
      })
      if (res.ok) {
        setTestResult('success')
        setTestMsg('Connected successfully!')
      } else {
        setTestResult('error')
        setTestMsg(`Connection failed (${res.status}) — check credentials`)
      }
    } catch {
      setTestResult('error')
      setTestMsg('Could not reach WordPress site')
    } finally {
      setTesting(false)
    }
  }

  async function saveSite() {
    setSaving(true)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: siteName, site_url: siteUrl, wp_username: wpUser, wp_app_password: wpPass }),
      })
      if (!res.ok) throw new Error('Failed to save site')
      router.push('/admin')
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-lg">
        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1,2,3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${s <= step ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{s}</div>
              {s < 3 && <div className={`h-0.5 w-12 ${s < step ? 'bg-red-500' : 'bg-gray-200'}`}/>}
            </div>
          ))}
          <span className="text-xs text-gray-400 ml-2">{step === 1 ? 'Welcome' : step === 2 ? 'Connect site' : 'All set'}</span>
        </div>

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to TrendingVerse CMS 🎉</h1>
            <p className="text-gray-500 mb-8">Let&apos;s connect your WordPress site so you can start publishing AI-generated articles automatically.</p>
            <div className="bg-gray-50 rounded-xl p-4 mb-8 space-y-3">
              {['AI detects trending topics daily', 'Generates SEO-optimized articles', 'Auto-fetches editorial photos from Pexels', 'Publishes directly to your WordPress'].map(f => (
                <div key={f} className="flex items-center gap-3 text-sm text-gray-700">
                  <span className="text-red-500">✓</span>{f}
                </div>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors">
              Connect my WordPress site →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect your WordPress site</h1>
            <p className="text-gray-500 text-sm mb-6">You&apos;ll need an Application Password from WordPress → Users → Profile → Application Passwords</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Site name</label>
                <input className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="My News Site" value={siteName} onChange={e => setSiteName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">WordPress URL</label>
                <input className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="https://yoursite.com" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">WordPress username</label>
                <input className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="admin" value={wpUser} onChange={e => setWpUser(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Application password</label>
                <input type="password" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" value={wpPass} onChange={e => setWpPass(e.target.value)} />
              </div>
              {testResult !== 'idle' && (
                <div className={`text-sm px-4 py-2 rounded-lg ${testResult === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testMsg}
                </div>
              )}
              <button onClick={testConnection} disabled={testing} className="w-full py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {testing ? 'Testing...' : 'Test connection'}
              </button>
              <button onClick={() => setStep(3)} disabled={!siteName || !siteUrl} className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors">
                Continue →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h1>
            <p className="text-gray-500 mb-2">Your WordPress site is connected.</p>
            <p className="text-gray-500 text-sm mb-8">Head to the dashboard to generate your first AI article and publish it to WordPress.</p>
            <button onClick={saveSite} disabled={saving} className="w-full py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors">
              {saving ? 'Setting up...' : 'Go to dashboard →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
