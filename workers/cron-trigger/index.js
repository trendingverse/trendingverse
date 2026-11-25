/**
 * TrendingVerse Cron Trigger Worker
 * Fires every 10 minutes → calls the auto-publish endpoint on the Pages app.
 * Deploy: cd workers/cron-trigger && wrangler deploy
 * Set secret: wrangler secret put CRON_SECRET
 */
export default {
  async scheduled(event, env, ctx) {
    const url = `${env.PAGES_URL}/api/cron/auto-publish?mode=article`
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${env.CRON_SECRET || ''}`,
          'User-Agent': 'TV-CronWorker/1.0',
        },
      })
      const body = await res.text()
      console.log(`[cron] status=${res.status} body=${body.slice(0, 300)}`)
    } catch (e) {
      console.error(`[cron] fetch failed: ${e.message}`)
    }
  },

  // Allow manual HTTP trigger for testing:
  // curl https://tv-cron-trigger.<your-subdomain>.workers.dev/trigger
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname !== '/trigger') {
      return new Response('TV Cron Worker — POST /trigger to run manually', { status: 200 })
    }
    const secret = req.headers.get('x-trigger-secret')
    if (env.CRON_SECRET && secret !== env.CRON_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }
    const targetUrl = `${env.PAGES_URL}/api/cron/auto-publish?mode=article`
    const res = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${env.CRON_SECRET || ''}` },
    })
    const body = await res.text()
    return new Response(body, { status: res.status, headers: { 'Content-Type': 'application/json' } })
  },
}
