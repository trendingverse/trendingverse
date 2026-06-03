'use client'
import { useState, useEffect } from 'react'

interface Trend {
  title: string
  summary: string
  category: string
  keywords: string[]
}

const COUNTRIES = [
  { code: 'India', label: '🇮🇳 India', hasStates: true },
  { code: 'United States', label: '🇺🇸 United States', hasStates: false },
  { code: 'United Kingdom', label: '🇬🇧 United Kingdom', hasStates: false },
  { code: 'Global', label: '🌐 Global', hasStates: false },
]

const INDIAN_STATES = [
  { code: 'Karnataka', label: 'Karnataka', lang: 'kn' },
  { code: 'Tamil Nadu', label: 'Tamil Nadu', lang: 'ta' },
  { code: 'Andhra Pradesh', label: 'Andhra Pradesh', lang: 'te' },
  { code: 'Telangana', label: 'Telangana', lang: 'te' },
  { code: 'Kerala', label: 'Kerala', lang: 'ml' },
  { code: 'Maharashtra', label: 'Maharashtra', lang: 'mr' },
  { code: 'Gujarat', label: 'Gujarat', lang: 'gu' },
  { code: 'West Bengal', label: 'West Bengal', lang: 'bn' },
  { code: 'Punjab', label: 'Punjab', lang: 'pa' },
  { code: 'Rajasthan', label: 'Rajasthan', lang: 'hi' },
  { code: 'Uttar Pradesh', label: 'Uttar Pradesh', lang: 'hi' },
  { code: 'Bihar', label: 'Bihar', lang: 'hi' },
  { code: 'Madhya Pradesh', label: 'Madhya Pradesh', lang: 'hi' },
  { code: 'Odisha', label: 'Odisha', lang: 'en' },
  { code: 'Assam', label: 'Assam', lang: 'en' },
  { code: 'Delhi', label: 'Delhi', lang: 'hi' },
  { code: 'Haryana', label: 'Haryana', lang: 'hi' },
  { code: 'Himachal Pradesh', label: 'Himachal Pradesh', lang: 'hi' },
  { code: 'Jharkhand', label: 'Jharkhand', lang: 'hi' },
  { code: 'Goa', label: 'Goa', lang: 'en' },
]

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
  const [country, setCountry] = useState('India')
  const [state, setState] = useState('')
  const [language, setLanguage] = useState('en')
  const [generating, setGenerating] = useState<string | null>(null)
  const [generated, setGenerated] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const selectedCountry = COUNTRIES.find(c => c.code === country)
  const selectedLang = LANGUAGES.find(l => l.code === language)

  // Auto-suggest language when state changes
  useEffect(() => {
    if (state) {
      const stateObj = INDIAN_STATES.find(s => s.code === state)
      if (stateObj && stateObj.lang !== 'en') setLanguage(stateObj.lang)
    }
  }, [state])

  useEffect(() => { fetchTrends() }, [country, state])

  async function fetchTrends() {
    setLoading(true)
    setError('')
    try {
      const region = state ? `${state}, India` : country
      const res = await fetch(`/api/google-trends?region=${encodeURIComponent(region)}`)
      const data = await res.json()
      if (data.error === 'FREE_PLAN_NO_KEY') {
        setError('Add your Gemini API key in Settings → API Keys to fetch trends.')
        return
      }
      if (data.error) throw new Error(data.error)
      setTrends(data.topics || [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function generateFromTrend(trend: Trend) {
    setGenerating(trend.title)
    try {
      const region = state ? `${state}, India` : country
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trend.title,
          topic: `${trend.title} - trending in ${region}`,
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
        body: JSON.stringify({ ...data, status: 'draft', ai_generated: true, reading_time_min: data.reading_time || 3 }),
      })
      const saved = await saveRes.json()
      if (saved.id) setGenerated(prev => ({ ...prev, [trend.title]: saved.id }))
    } catch (e) {
      alert('Generation failed: ' + (e as Error).message)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="space-y-4">

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Country selector */}
        <div>
          <p className="text-xs font-medium text-ink-500 mb-2">COUNTRY / REGION</p>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map(c => (
              <button key={c.code} onClick={() => { setCountry(c.code); setState('') }}
                className={`text-sm px-4 py-2 rounded-xl border font-medium transition-colors ${
                  country === c.code && !state
                    ? 'bg-accent text-white border-accent'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-accent/50'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Indian state selector */}
        {selectedCountry?.hasStates && (
          <div>
            <p className="text-xs font-medium text-ink-500 mb-2">
              STATE (INDIA) <span className="text-ink-300 font-normal">— for hyper-local trends</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setState('')}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  !state ? 'bg-accent text-white border-accent' : 'bg-white text-ink-600 border-ink-200 hover:border-accent/50'
                }`}>
                All India
              </button>
              {INDIAN_STATES.map(s => (
                <button key={s.code} onClick={() => setState(s.code)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    state === s.code
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-blue-300'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
            {state && (
              <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                📍 Fetching trends specific to <strong>{state}</strong> — language auto-set to {LANGUAGES.find(l => l.code === INDIAN_STATES.find(s => s.code === state)?.lang)?.native || 'English'}
              </p>
            )}
          </div>
        )}

        {/* Language selector */}
        <div>
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

        {/* Refresh button */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-400">
            Showing trends for: <strong className="text-ink-700">{state ? `${state}, India` : country}</strong>
          </p>
          <button onClick={fetchTrends} disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-ink-100 hover:bg-ink-200 text-ink-700 text-xs font-medium transition-colors disabled:opacity-50">
            {loading ? '⟳ Fetching...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-28 bg-ink-50 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trends.map((trend, i) => (
            <div key={i} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">
                  {trend.category}
                </span>
                {state && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                    📍 {state}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-ink-900 text-sm leading-snug mb-1 line-clamp-2">{trend.title}</h3>
              {trend.summary && (
                <p className="text-xs text-ink-400 mb-3 line-clamp-2">{trend.summary}</p>
              )}
              {generated[trend.title] ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 font-medium">✓ Draft saved</span>
                  <a href={`/admin/articles/${generated[trend.title]}/edit`}
                    className="text-xs text-blue-600 underline">Edit →</a>
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
          <p>No trends found. Click Refresh to fetch.</p>
        </div>
      )}
    </div>
  )
}
