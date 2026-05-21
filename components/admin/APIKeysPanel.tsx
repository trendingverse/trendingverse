'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const MODELS = [
  { id: 'gemini', name: 'Gemini', provider: 'Google', description: 'Best for Indian language content', link: 'https://aistudio.google.com/app/apikey', free: true },
  { id: 'openai', name: 'ChatGPT', provider: 'OpenAI', description: 'GPT-4o Mini — fast and accurate', link: 'https://platform.openai.com/api-keys', free: false },
  { id: 'claude', name: 'Claude', provider: 'Anthropic', description: 'Claude 3.5 Haiku — high quality', link: 'https://console.anthropic.com/settings/keys', free: false },
]

export function APIKeysPanel() {
  const [keys, setKeys] = useState({ gemini_key: '', openai_key: '', claude_key: '', preferred_model: 'gemini', plan: 'free', has_gemini: false, has_openai: false, has_claude: false })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/user/keys').then(r => r.json()).then(setKeys)
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/user/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_key: keys.gemini_key,
          openai_key: keys.openai_key,
          claude_key: keys.claude_key,
          preferred_model: keys.preferred_model,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('API keys saved!')
      // Refresh to show masked keys
      fetch('/api/user/keys').then(r => r.json()).then(setKeys)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function removeKey(type: string) {
    try {
      await fetch('/api/user/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_type: type }),
      })
      toast.success('Key removed')
      fetch('/api/user/keys').then(r => r.json()).then(setKeys)
    } catch { /* ignore */ }
  }

  async function testKey(model: string) {
    setTesting(model)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test article', wordCount: 100, language: 'en' }),
      })
      const data = await res.json()
      if (data.model_used) toast.success(`✓ Working! Using ${data.model_used}`)
      else toast.error(data.error || 'Test failed')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(null)
    }
  }

  const keyValues: Record<string, string> = {
    gemini: keys.gemini_key,
    openai: keys.openai_key,
    claude: keys.claude_key,
  }
  const hasKey: Record<string, boolean> = {
    gemini: keys.has_gemini,
    openai: keys.has_openai,
    claude: keys.has_claude,
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <h3 className="font-semibold text-blue-900 text-sm mb-1">🔑 Bring Your Own API Key</h3>
        <p className="text-xs text-blue-700">
          Add your own API keys to get unlimited article generation — no quota limits, no interruptions.
          Your keys are encrypted and stored securely. We never use them for anything else.
        </p>
      </div>

      {/* Preferred model */}
      <div>
        <label className="label">Preferred AI Model</label>
        <div className="grid grid-cols-3 gap-3 mt-2">
          {MODELS.map(m => (
            <button key={m.id} onClick={() => setKeys(k => ({ ...k, preferred_model: m.id }))}
              className={`p-3 rounded-xl border text-left transition-all ${keys.preferred_model === m.id ? 'border-accent bg-accent/5' : 'border-ink-100 hover:border-ink-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-ink-900">{m.name}</span>
                {m.free && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Free tier</span>}
              </div>
              <p className="text-xs text-ink-400">{m.description}</p>
              {hasKey[m.id] && <span className="text-xs text-green-600 mt-1 block">✓ Key saved</span>}
            </button>
          ))}
        </div>
      </div>

      {/* API Key inputs */}
      <div className="space-y-4">
        {MODELS.map(m => (
          <div key={m.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-medium text-ink-900 text-sm">{m.provider} — {m.name}</span>
                <p className="text-xs text-ink-400">{m.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {hasKey[m.id] && (
                  <>
                    <button onClick={() => testKey(m.id)} disabled={testing === m.id}
                      className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                      {testing === m.id ? '⟳ Testing...' : '✓ Test'}
                    </button>
                    <button onClick={() => removeKey(m.id)}
                      className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                      Remove
                    </button>
                  </>
                )}
                <a href={m.link} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-2 py-1 bg-ink-50 text-ink-600 rounded-lg hover:bg-ink-100 transition-colors">
                  Get key ↗
                </a>
              </div>
            </div>
            <input
              type="password"
              className="input w-full font-mono text-xs"
              placeholder={`Paste your ${m.provider} API key here...`}
              value={keyValues[m.id]}
              onChange={e => setKeys(k => ({ ...k, [`${m.id}_key`]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="btn-primary w-full justify-center py-2.5">
        {saving ? '⟳ Saving...' : '💾 Save API Keys'}
      </button>

      <p className="text-xs text-ink-400 text-center">
        Keys are encrypted at rest. Never shared. Used only for your article generation.
      </p>
    </div>
  )
}
