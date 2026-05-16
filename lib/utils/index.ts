import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...i: ClassValue[]) { return twMerge(clsx(i)) }
export function formatDate(d: string, f='MMM d, yyyy') { try { return format(new Date(d),f) } catch { return d } }
export function timeAgo(d: string) { try { return formatDistanceToNow(new Date(d),{addSuffix:true}) } catch { return d } }
export function readingTime(c: string) { return Math.max(1,Math.ceil(c.replace(/<[^>]+>/g,'').split(/\s+/).length/200)) }
export function wordCount(c: string) { return c.replace(/<[^>]+>/g,'').split(/\s+/).filter(Boolean).length }
export function truncate(s: string, n: number) { return s.length>n ? s.slice(0,n).trimEnd()+'…' : s }
export function slugify(s: string) { return s.toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/[\s_-]+/g,'-').replace(/^-+|-+$/g,'') }
export function formatBytes(b: number) { if(b<1024) return `${b} B`; if(b<1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB` }

export function computeSeoScore(a: { title?:string; content?:string; meta_description?:string; focus_keyword?:string; keywords?:string[]; cover_image_url?:string; seo_title?:string }) {
  const s: { type:string; message:string }[] = []
  let score = 0
  const title = a.seo_title || a.title || ''
  const content = (a.content||'').replace(/<[^>]+>/g,'')
  const kw = (a.focus_keyword||'').toLowerCase()
  if (title.length>=30&&title.length<=60) score+=20
  else if (title.length>0) { score+=10; s.push({type:'warning',message:`SEO title: aim 30–60 chars (${title.length})`}) }
  else s.push({type:'error',message:'SEO title missing'})
  if (kw) { score+=10; if(title.toLowerCase().includes(kw)) score+=10; else s.push({type:'warning',message:'Keyword missing from SEO title'}) }
  else s.push({type:'error',message:'Focus keyword not set'})
  const meta = a.meta_description||''
  if (meta.length>=120&&meta.length<=160) score+=20
  else if (meta.length>0) { score+=10; s.push({type:'warning',message:`Meta desc: aim 120–160 chars (${meta.length})`}) }
  else s.push({type:'error',message:'Meta description missing'})
  const wc = content.split(/\s+/).filter(Boolean).length
  if (wc>=600) score+=20; else if (wc>=300) { score+=10; s.push({type:'warning',message:`Content short (${wc} words), aim 600+`}) }
  else s.push({type:'error',message:`Content too short (${wc} words)`})
  if (a.cover_image_url) score+=10; else s.push({type:'warning',message:'No cover image'})
  if ((a.keywords||[]).length>=3) score+=10; else s.push({type:'info',message:'Add 3+ keywords'})
  return { score: Math.min(100,score), suggestions: s }
}

export function injectAffiliateLinks(html: string, links: {url:string;trigger_keywords:string[]}[]) {
  let r = html
  for (const l of links)
    for (const kw of l.trigger_keywords)
      r = r.replace(new RegExp(`(?<![">])\\b(${kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})\\b(?![^<]*>)`,'gi'),
        (_,m) => `<a href="${l.url}" target="_blank" rel="sponsored noopener" class="tv-affiliate">${m}</a>`)
  return r
}
