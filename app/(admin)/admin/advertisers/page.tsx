// app/(admin)/admin/advertisers/page.tsx
'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Advertiser {
  id: string; email: string; company_name: string; plan: string; created_at: string
}

export default function AdvertisersPage() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', company_name: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAdvertisers() }, [])

  async function fetchAdvertisers() {
    const res = await fetch('/api/admin/advertisers')
    if (res.ok) setAdvertisers(await res.json())
    setLoading(false)
  }

  async function createAdvertiser() {
    if (!form.email || !form.password || !form.company_name) {
      toast.error('Email, password and company name required')
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/advertisers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Advertiser created!')
      setShowForm(false)
      setForm({ email: '', password: '', full_name: '', company_name: '' })
      fetchAdvertisers()
    } else {
      toast.error(data.error || 'Failed to create advertiser')
    }
    setSaving(false)
  }

  async function deleteAdvertiser(id: string, email: string) {
    if (!confirm(`Delete advertiser ${email}?`)) return
    await fetch(`/api/admin/advertisers?id=${id}`, { method: 'DELETE' })
    setAdvertisers(prev => prev.filter(a => a.id !== id))
    toast.success('Advertiser deleted')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950">🏢 Advertisers</h1>
          <p className="text-sm text-ink-400 mt-1">Manage advertiser accounts — they can run campaigns and find publishers</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-4 py-2">+ Create Advertiser</button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-accent/20">
          <h3 className="font-semibold text-ink-900">New Advertiser Account</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name *</label>
              <input className="input" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} placeholder="Nykaa, Swiggy, etc." />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="advertiser@company.com" />
            </div>
            <div>
              <label className="label">Password *</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 characters" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={createAdvertiser} disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Account'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-24 bg-ink-50 rounded-xl animate-pulse" />
      ) : advertisers.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-2xl mb-2">🏢</p>
          <p className="text-sm text-ink-500">No advertisers yet — create the first one above</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 border-b border-ink-100">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Company</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-500">Email</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Plan</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-ink-500">Created</th>
              <th className="text-center px-3 py-2.5 text-xs font-medium text-ink-500">Actions</th>
            </tr></thead>
            <tbody>
              {advertisers.map(a => (
                <tr key={a.id} className="border-b border-ink-50 hover:bg-ink-50/50">
                  <td className="px-4 py-2.5 text-xs font-medium text-ink-900">{a.company_name || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-600">{a.email}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">advertiser</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-400">
                    {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => deleteAdvertiser(a.id, a.email)}
                      className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
