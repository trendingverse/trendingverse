export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'

// IndexNow key — Rank Math uses this key; it must exist at:
//   https://trendingverse.online/<key>.txt  containing just the key
// Rank Math auto-creates this file when you set up Instant Indexing.
// You can also create it manually via WP media upload as a .txt file.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'rankmath'

function isAdmin(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const h = req.headers.get('authorization')?.replace('Bearer ', '')
  const q = new URL(req.url).searchParams.get('secret')
  return h === secret || q === secret
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wpBase = (process.env.WP_URL || '').replace(/\/$/, '')
  const wpUser = process.env.WP_USERNAME || ''
  const wpPass = process.env.WP_APP_PASSWORD || ''
  const auth = btoa(`${wpUser}:${wpPass}`)

  const log: string[] = []
  const host = 'trendingverse.online'

  // ── 1. Fetch all published post URLs ─────────────────────────────
  const allUrls: string[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `${wpBase}/wp-json/wp/v2/posts?per_page=100&status=publish&page=${page}&_fields=link`,
      { headers: { Authorization: `Basic ${auth}` } }
    )
    if (!res.ok) break
    const posts: { link: string }[] = await res.json()
    if (!posts.length) break
    allUrls.push(...posts.map(p => p.link))
    if (posts.length < 100) break
  }
  log.push(`Found ${allUrls.length} published posts`)

  // ── 2. Ping Google & Bing sitemaps ───────────────────────────────
  const sitemapUrl = `https://${host}/sitemap_index.xml`
  const pings = await Promise.allSettled([
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
  ])
  const googleStatus = pings[0].status === 'fulfilled' ? (pings[0].value as Response).status : 'failed'
  const bingStatus = pings[1].status === 'fulfilled' ? (pings[1].value as Response).status : 'failed'
  log.push(`Sitemap ping — Google: ${googleStatus}, Bing: ${bingStatus}`)

  // ── 3. IndexNow batch submission (Bing/Yandex) ───────────────────
  let indexNowSubmitted = 0
  let indexNowFailed = 0
  const batchSize = 100
  for (let i = 0; i < allUrls.length; i += batchSize) {
    const batch = allUrls.slice(i, i + batchSize)
    try {
      const r = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host, key: INDEXNOW_KEY, urlList: batch }),
      })
      if (r.ok || r.status === 202) {
        indexNowSubmitted += batch.length
        log.push(`IndexNow batch ${Math.ceil((i + 1) / batchSize)}: ${r.status} — ${batch.length} URLs`)
      } else {
        const body = await r.text().catch(() => '')
        indexNowFailed += batch.length
        log.push(`IndexNow batch ${Math.ceil((i + 1) / batchSize)}: ${r.status} — ${body.slice(0, 100)}`)
      }
    } catch (e) {
      indexNowFailed += batch.length
      log.push(`IndexNow batch error: ${(e as Error).message}`)
    }
  }

  return NextResponse.json({
    total_urls: allUrls.length,
    sitemap_ping: { google: googleStatus, bing: bingStatus },
    indexnow: { submitted: indexNowSubmitted, failed: indexNowFailed },
    note: 'If IndexNow fails with 403, set up Instant Indexing in Rank Math → Instant Indexing and get the auto-generated key, then set INDEXNOW_KEY env var to match.',
    log,
  })
}
