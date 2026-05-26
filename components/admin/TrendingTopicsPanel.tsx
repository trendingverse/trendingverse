'use client'
import { useState, useEffect } from 'react'

interface Trend {
  title: string
  description: string
  category: string
  region: string
  flag: string
  source: string
}

const REGIONS = ['ALL', 'India', 'United States', 'United Kingdom', 'Global']

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
]

export function TrendingTopicsPanel() {
  const [trends, setTrends] = useState<Trend[]>([])
  const [loading, setLoading] = useState(false)
  const [region, setRegion] = useState('ALL')
  const [language, setLanguage] = useState('en')
  const [generating, setGenerating] = useState<string | null>(null)
  const [generated, setGenerated] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => { fetchTrends() }, [region])

  async function fetchTrends() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/google-trends?region=${encodeURIComponent(region)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTrends(data.trends || [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function generateFromTrend(trend: Trend) {
    setGenerating(trend.title)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trend.title,
          topic: `${trend.title} - trending in ${trend.region}`,
          category: trend.category || 'General',
          tone: 'journalistic, objective, engaging',
          wordCount: 600,
          language,
        }),
      })
      const data = await res.json()
      if (data.error === 'FREE_PLAN_NO_KEY') {
        alert('Add your Gemini API key in Settings → API Keys to generate articles.')
        return
      }
      if (data.error) throw new Error(data.error)

      const saveRes = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          status: 'draft',
          ai_generated: true,
          reading_time_min: data.reading_time || 3,
        }),
      })
      const saved = await saveRes.json()
      if (saved.id) {
        setGenerated(prev => ({ ...prev, [trend.title]: saved.id }))
      }
    } catch (e) {
      alert('Generation failed: ' + (e as Error).message)
    } finally {
      setGenerating(null)
    }
  }

  const selectedLang = LANGUAGES.find(l => l.code === language)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-950">🔥 Google Trends</h2>
          <p className="text-xs text-ink-400">Real-time trending topics — click to generate article instantly</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={region} onChange={e => setRegion(e.target.value)} className="input text-sm">
            {REGIONS.map(r => <option key={r} value={r}>{r === 'ALL' ? '🌐 All Regions' : r}</option>)}
          </select>
          <button onClick={fetchTrends} disabled={loading}
            className="px-3 py-2 rounded-lg bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm transition-colors disabled:opacity-50">
            {loading ? '⟳' : '↻'} Refresh
          </button>
        </div>
      </div>

      {/* Language selector */}
      <div className="card p-4">
        <p className="text-xs font-medium text-ink-500 mb-2">GENERATE ARTICLES IN</p>
        <div className="grid grid-cols-5 gap-1.5">
          {LANGUAGES.map(lang => (
            <button key={lang.code} onClick={() => setLanguage(lang.code)}
              className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg border text-center transition-all ${
                language === lang.code
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-ink-100 hover:border-ink-300 text-ink-600'
              }`}>
              <span className="text-xs font-medium leading-tight">{lang.native}</span>
              <span className="text-[10px] text-ink-400 mt-0.5">{lang.name}</span>
            </button>
          ))}
        </div>
        {language !== 'en' && (
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-1.5 rounded-lg">
            ✦ Articles will be generated in {selectedLang?.native} ({selectedLang?.name})
          </p>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array(9).fill(0).map((_, i) => <div key={i} className="h-24 bg-ink-50 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trends.map((trend, i) => (
            <div key={i} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{trend.flag}</span>
                  <span className="text-xs text-ink-400">{trend.region}</span>
                </div>
                {trend.description && (
                  <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                    {trend.description}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-ink-900 text-sm leading-snug mb-3 line-clamp-2">{trend.title}</h3>
              {generated[trend.title] ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 font-medium">✓ Draft saved</span>
                  <a href={`/admin/articles/${generated[trend.title]}/edit`} className="text-xs text-blue-600 underline">Edit →</a>
                </div>
              ) : (
                <button onClick={() => generateFromTrend(trend)} disabled={generating === trend.title}
                  className="w-full py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors">
                  {generating === trend.title
                    ? '⟳ Generating...'
                    : `✦ Generate in ${selectedLang?.native || 'English'}`}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && trends.length === 0 && !error && (
        <div className="text-center py-12 text-ink-300">
          <p className="text-4xl mb-2">📡</p>
          <p>No trends loaded. Click Refresh to fetch.</p>
        </div>
      )}
    </div>
  )
}
