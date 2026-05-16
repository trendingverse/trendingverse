'use client'
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { formatBytes, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { MediaAsset } from '@/types'

export function MediaManager({ media: initial }: { media: MediaAsset[] }) {
  const [media, setMedia] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<MediaAsset|null>(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editAlt, setEditAlt] = useState('')
  const [editCaption, setEditCaption] = useState('')

  const onDrop = useCallback(async (files: File[]) => {
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', filter === 'all' ? 'general' : filter)
      const res = await fetch('/api/media', { method: 'POST', body: fd })
      if (res.ok) {
        const asset = await res.json()
        setMedia(m => [asset, ...m])
        toast.success(`${file.name} uploaded`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Upload failed')
      }
    }
    setUploading(false)
  }, [filter])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, maxFiles: 10
  })

  async function deleteAsset(id: string) {
    if (!confirm('Delete this image permanently?')) return
    const res = await fetch(`/api/media/${id}`, { method: 'DELETE' })
    if (res.ok) { setMedia(m => m.filter(x => x.id !== id)); setSelected(null); toast.success('Deleted') }
    else toast.error('Delete failed')
  }

  async function saveAlt(id: string) {
    const res = await fetch(`/api/media/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ alt_text: editAlt, caption: editCaption }) })
    if (res.ok) { setMedia(m => m.map(x => x.id===id?{...x,alt_text:editAlt,caption:editCaption}:x)); toast.success('Saved') }
  }

  const folders = ['all','general','articles','thumbnails','banners']
  const filtered = media.filter(m => {
    const matchFolder = filter==='all' || m.folder===filter
    const matchSearch = !search || m.original_name.toLowerCase().includes(search.toLowerCase())
    return matchFolder && matchSearch
  })

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive?'border-accent bg-accent/5':'border-ink-200 hover:border-accent hover:bg-surface-2'}`}>
        <input {...getInputProps()} />
        <div className="text-4xl mb-2">📁</div>
        <p className="font-medium text-ink-700">{uploading?'Uploading…':isDragActive?'Drop images here':'Drag & drop images, or click to browse'}</p>
        <p className="text-sm text-ink-400 mt-1">PNG, JPG, WEBP, GIF up to 10MB</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {folders.map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter===f?'bg-accent text-white':'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} className="input w-48" placeholder="Search…"/>
        <span className="text-xs text-ink-400 ml-auto">{filtered.length} files · {formatBytes(media.reduce((a,m)=>a+m.size_bytes,0))}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Grid */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map(m=>(
            <button key={m.id} onClick={()=>{setSelected(m);setEditAlt(m.alt_text||'');setEditCaption(m.caption||'')}}
              className={`group relative aspect-square bg-ink-100 rounded-xl overflow-hidden border-2 transition-all ${selected?.id===m.id?'border-accent shadow-md':'border-transparent hover:border-ink-300'}`}>
              <img src={m.url} alt={m.alt_text||m.original_name} className="w-full h-full object-cover"/>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                <p className="text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity truncate w-full">{m.original_name}</p>
              </div>
            </button>
          ))}
          {filtered.length===0 && <p className="col-span-4 text-center text-ink-300 text-sm py-12">No images found.</p>}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="card p-4 space-y-4 self-start sticky top-4">
            <img src={selected.url} alt={selected.alt_text||''} className="w-full aspect-video object-cover rounded-lg"/>
            <div className="space-y-1 text-xs text-ink-500">
              <p><span className="font-semibold text-ink-700">File:</span> {selected.original_name}</p>
              <p><span className="font-semibold text-ink-700">Size:</span> {formatBytes(selected.size_bytes)}</p>
              <p><span className="font-semibold text-ink-700">Type:</span> {selected.mime_type}</p>
              <p><span className="font-semibold text-ink-700">Uploaded:</span> {formatDate(selected.created_at)}</p>
            </div>
            <div>
              <label className="label">Alt Text</label>
              <input value={editAlt} onChange={e=>setEditAlt(e.target.value)} className="input text-xs" placeholder="Descriptive alt text…"/>
            </div>
            <div>
              <label className="label">Caption</label>
              <input value={editCaption} onChange={e=>setEditCaption(e.target.value)} className="input text-xs" placeholder="Optional caption…"/>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={()=>saveAlt(selected.id)} className="btn-primary btn-sm w-full justify-center">Save Changes</button>
              <button onClick={()=>navigator.clipboard.writeText(selected.url).then(()=>toast.success('URL copied!'))} className="btn-secondary btn-sm w-full justify-center">Copy URL</button>
              <button onClick={()=>deleteAsset(selected.id)} className="btn-danger btn-sm w-full justify-center">Delete</button>
            </div>
          </div>
        ) : (
          <div className="card flex items-center justify-center text-ink-300 text-sm" style={{minHeight:200}}>
            Select an image
          </div>
        )}
      </div>
    </div>
  )
}
