// app/(admin)/admin/monetization/site-scripts/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Site = {
  id: string
  name: string
  site_url: string
  head_scripts: string | null
  footer_scripts: string | null
}

export default function SiteScriptsPage() {
  const [sites, setSites]       = useState<Site[]>([])
  const [selected, setSelected] = useState<Site | null>(null)
  const [head, setHead]         = useState('')
  const [footer, setFooter]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchSites() }, [])

  async function fetchSites() {
    setLoading(true)
    const { data } = await supabase
      .from('sites')
      .select('id, name, site_url, head_scripts, footer_scripts')
      .order('name')
    setSites(data || [])
    setLoading(false)
  }

  function selectSite(site: Site) {
    setSelected(site)
    setHead(site.head_scripts || '')
    setFooter(site.footer_scripts || '')
  }

  async function save() {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase
      .from('sites')
      .update({ head_scripts: head, footer_scripts: footer })
      .eq('id', selected.id)

    if (error) {
      toast.error('Failed to save: ' + error.message)
    } else {
      toast.success('Saved! Plugin will pick up within 1 hour, or hit Refresh in WordPress.')
      setSites(prev => prev.map(s =>
        s.id === selected.id ? { ...s, head_scripts: head, footer_scripts: footer } : s
      ))
    }
    setSaving(false)
  }

  const ta = 'w-full font-mono text-xs bg-ink-50 border border-ink-200 rounded-xl p-3 resize-none focus:outline-none focus:border-accent'

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-950">🔧 Site Scripts</h1>
        <p className="text-sm text-ink-400 mt-1">
          Add head/footer scripts per publisher site — ad tags, analytics, push notifications.
          The WordPress plugin fetches and injects these automatically.
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-ink-400 text-sm">Loading sites...</div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide px-1">Publisher Sites</p>
            {sites.length === 0 && (
              <p className="text-sm text-ink-400 px-1">No sites found</p>
            )}
            {sites.map(site => (
              <button key={site.id} onClick={() => selectSite(site)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                  selected?.id === site.id
                    ? 'border-accent bg-accent/5 text-accent font-semibold'
                    : 'border-ink-100 hover:border-ink-200 text-ink-700'
                }`}>
                <p className="font-medium truncate">{site.name || site.site_url}</p>
                <p className="text-xs text-ink-400 truncate mt-0.5">{site.site_url}</p>
                {(site.head_scripts || site.footer_scripts) && (
                  <span className="inline-block mt-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                    Scripts active
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {!selected ? (
              <div className="card p-8 text-center text-ink-400 text-sm h-full flex items-center justify-center">
                ← Select a site to manage its scripts
              </div>
            ) : (
              <div className="card p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-ink-900">{selected.name || selected.site_url}</p>
                    <p className="text-xs text-ink-400">{selected.site_url}</p>
                  </div>
                  <button onClick={save} disabled={saving}
                    className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
                    {saving ? 'Saving...' : '💾 Save Scripts'}
                  </button>
                </div>

                <div>
                  <label className="label">HEAD Scripts — inside &lt;head&gt;</label>
                  <textarea className={ta} rows={10} value={head} onChange={e => setHead(e.target.value)}
                    placeholder="<!-- Paste Monetag, AdSense, analytics scripts here -->" />
                </div>

                <div>
                  <label className="label">FOOTER Scripts — before &lt;/body&gt;</label>
                  <textarea className={ta} rows={6} value={footer} onChange={e => setFooter(e.target.value)}
                    placeholder="<!-- Pop-under, push notification, chat scripts -->" />
                </div>

                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                  <strong>💡</strong> Plugin auto-refreshes every hour. For instant apply →
                  WordPress Admin → Settings → TrendingVerse Ads → <strong>Refresh Ad Codes Now</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
