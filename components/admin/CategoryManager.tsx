'use client'
import { useState } from 'react'
import { slugify } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Category } from '@/types'

const COLORS = ['#e63946','#6366f1','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#ec4899','#64748b','#f97316','#14b8a6']

export function CategoryManager({ categories: initial }: { categories: Category[] }) {
  const [categories, setCategories] = useState(initial)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [color, setColor] = useState('#e63946')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [editData, setEditData] = useState<Partial<Category>>({})

  async function create() {
    if (!name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const res = await fetch('/api/categories', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, slug: slugify(name), description: desc, color }) })
    if (res.ok) {
      const d = await res.json(); setCategories(c=>[...c,d])
      setName(''); setDesc(''); setColor('#e63946')
      toast.success('Category created')
    } else toast.error('Create failed')
    setSaving(false)
  }

  async function save(id: string) {
    setSaving(true)
    const res = await fetch(`/api/categories/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(editData) })
    if (res.ok) {
      const d = await res.json(); setCategories(c=>c.map(x=>x.id===id?d:x)); setEditId(null)
      toast.success('Saved')
    } else toast.error('Save failed')
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('Delete category? Articles in this category will be uncategorized.')) return
    const res = await fetch(`/api/categories/${id}`, { method:'DELETE' })
    if (res.ok) { setCategories(c=>c.filter(x=>x.id!==id)); toast.success('Deleted') }
    else toast.error('Delete failed')
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Create form */}
      <div className="card p-5 space-y-4 self-start">
        <h3 className="font-semibold text-ink-900">New Category</h3>
        <div>
          <label className="label">Name *</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="input" placeholder="e.g. Technology"/>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} className="input resize-none" placeholder="Brief description…"/>
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {COLORS.map(c=>(
              <button key={c} onClick={()=>setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color===c?'border-ink-900 scale-110':'border-transparent'}`}
                style={{background:c}}/>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg">
          <div className="w-3 h-3 rounded-full" style={{background:color}}/>
          <span className="text-sm font-medium text-ink-700">{name||'Preview'}</span>
        </div>
        <button onClick={create} disabled={saving} className="btn-primary w-full justify-center">
          {saving?'Creating…':'Create Category'}
        </button>
      </div>

      {/* List */}
      <div className="lg:col-span-2 card overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100">
          <p className="text-xs font-semibold text-ink-600 uppercase tracking-wide">{categories.length} Categories</p>
        </div>
        <div className="divide-y divide-ink-50">
          {categories.map(cat=>(
            <div key={cat.id} className="px-5 py-4">
              {editId===cat.id ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <input value={editData.name||''} onChange={e=>setEditData(d=>({...d,name:e.target.value}))} className="input flex-1" placeholder="Name"/>
                    <input value={editData.color||''} onChange={e=>setEditData(d=>({...d,color:e.target.value}))} type="color" className="w-12 h-10 rounded border border-ink-200 cursor-pointer"/>
                  </div>
                  <textarea value={editData.description||''} onChange={e=>setEditData(d=>({...d,description:e.target.value}))} rows={2} className="input resize-none" placeholder="Description"/>
                  <input value={editData.meta_title||''} onChange={e=>setEditData(d=>({...d,meta_title:e.target.value}))} className="input" placeholder="SEO Meta Title"/>
                  <div className="flex gap-2">
                    <button onClick={()=>save(cat.id)} disabled={saving} className="btn-primary btn-sm">Save</button>
                    <button onClick={()=>setEditId(null)} className="btn-secondary btn-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full shrink-0" style={{background:cat.color}}/>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-900">{cat.name}</p>
                    <p className="text-xs text-ink-400">{cat.description||'No description'} · {cat.article_count} articles · <span className="font-mono">/{cat.slug}</span></p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={()=>{setEditId(cat.id);setEditData({...cat})}} className="btn-ghost btn-sm">Edit</button>
                    <button onClick={()=>del(cat.id)} className="btn-danger btn-sm">Del</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {categories.length===0 && <p className="p-8 text-center text-sm text-ink-300">No categories yet.</p>}
        </div>
      </div>
    </div>
  )
}
