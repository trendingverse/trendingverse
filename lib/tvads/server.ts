// lib/tvads/server.ts
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const PLACEMENTS: Record<string, string> = {
  after_para: 'In article — after paragraph N',
  mid_long: 'In article — middle (long articles only)',
  content_top: 'Article top',
  content_bottom: 'Article end',
  body_open: 'Below header (all pages)',
  sticky: 'Bottom sticky',
  interstitial: 'Interstitial (on link click)',
  shortcode: 'Manual — shortcode / widget',
}

export const DEVICES: Record<string, string> = { all: 'Mobile + Desktop', m: 'Mobile only', d: 'Desktop only' }

export const DEFAULT_SETTINGS = {
  label: 'Advertisement',
  longWords: 600,
  longMinParas: 6,
  interFreq: 30,
  interDelay: 3,
  interMinPv: 1,
  trackLoggedIn: false,
  tz: 'Asia/Kolkata',
}

export const DEFAULT_UNITS = [
  { name: 'In-article 1', placement: 'after_para', para: 1, size: '300x250', device: 'all' },
  { name: 'In-article long', placement: 'mid_long', para: 1, size: '300x250', device: 'all' },
  { name: 'Desktop leaderboard', placement: 'content_top', para: 1, size: '728x90', device: 'd' },
  { name: 'Bottom sticky', placement: 'sticky', para: 1, size: '320x50', device: 'all' },
  { name: 'Interstitial', placement: 'interstitial', para: 1, size: '300x250', device: 'all' },
]

export function adminDb(): any {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase service env vars missing')
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function currentUser(): Promise<{ id: string; email: string } | null> {
  try {
    const sb = await createClient()
    const { data } = await sb.auth.getUser()
    const u = data?.user
    return u ? { id: u.id, email: String(u.email || '').toLowerCase() } : null
  } catch {
    return null
  }
}

export function isTvAdmin(email: string): boolean {
  const list = String(process.env.TVADS_ADMIN_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  return !!email && list.includes(email.toLowerCase())
}

export function newId(prefix: string): string {
  return prefix + globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 7)
}

export function newSiteKey(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 24)
}

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

export function esc(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}
