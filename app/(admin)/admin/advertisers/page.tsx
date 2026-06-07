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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', company_name: '' })
  const [editForm, setEditForm] = useState({ company_name: '', full_name: '', new_password: '' })
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

  async function updateAdvertiser(id: string) {
    setSaving(true)
    const res = await fetch('/api/admin/advertisers', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success('Advertiser updated!')
      setEditingId(null)
      setEditForm({ company_name: '', full_name: '', new_password: '' })
      fetchAdvertisers()
    } else {
      toast.error(data.error || 'Failed to update')
    }
    setSaving(false)
  }

  async function deleteAdvertiser(id: string, email: string) {
    if (!confirm(`Delete advertiser ${email}?`)) return
    await fetch(`/api/admin/advertisers?id=${id}`, { method: 'DELETE' })
    setAdvertisers(prev => prev.filter(a => a.id !== id))
    toast.success('Advertiser deleted')
  }

  function startEdit(a: Advertiser) {
    setEditingId(a.id)
    setEditForm({ company_name: a.company_name || '', full_name: '', new_password: '' })
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-950">🏢 Advertisers</h1>
          <p className="text-sm text-ink-400 mt-1">Manage advertiser accounts — they can run campaigns and find publishers</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null) }} className="btn-primary text-xs px-4 py-2">+ Create Advertiser</button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-accent/20">
          <h3 className="font-semibold text-ink-900">New Advertiser Account</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company Name *</label>
              <input className="input" value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder="Nykaa, Swiggy, etc." />
            </div>
            <div>
              <label className="label">Contact Name</label>
              <input className="input" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Full name" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="advertiser@company.com" />
            </div>
            <div>
              <label className="label">Password *</label>
              <input type="password" className="input" value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimum 8 characters" />
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
        <div className="space-y-3">
          {advertisers.map(a => (
            <div key={a.id} className="card overflow-hidden">
              {/* Main row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm">
                    {(a.company_name || a.email)[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{a.company_name || '—'}</p>
                    <p className="text-xs text-ink-400">{a.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">advertiser</span>
                  <span className="text-xs text-ink-400">
                    {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => editingId === a.id ? setEditingId(null) : startEdit(a)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${editingId === a.id ? 'bg-ink-200 text-ink-700' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
                      {editingId === a.id ? '✕ Cancel' : '✏ Edit'}
                    </button>
                    <button
                      onClick={() => deleteAdvertiser(a.id, a.email)}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-50">
                      🗑
                    </button>
                  </div>
                </div>
              </div>

              {/* Edit form — inline below the row */}
              {editingId === a.id && (
                <div className="border-t border-ink-100 px-4 py-4 bg-ink-50/50 space-y-3">
                  <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">Edit Details</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Company Name</label>
                      <input className="input" value={editForm.company_name}
                        onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                        placeholder="Company name" />
                    </div>
                    <div>
                      <label className="label">Contact Name</label>
                      <input className="input" value={editForm.full_name}
                        onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                        placeholder="Full name (optional)" />
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <input type="password" className="input" value={editForm.new_password}
                        onChange={e => setEditForm(f => ({ ...f, new_password: e.target.value }))}
                        placeholder="Leave blank to keep current" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateAdvertiser(a.id)} disabled={saving}
                      className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
                      {saving ? 'Saving...' : '✓ Save Changes'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs px-4 py-2 bg-ink-100 text-ink-600 rounded-xl">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
