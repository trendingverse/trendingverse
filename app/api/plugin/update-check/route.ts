export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'

// Current plugin version hosted on your server
const PLUGIN_VERSION = '2.0.0'
const PLUGIN_SLUG = 'trendingverse-ads'
const PLUGIN_FILE = 'trendingverse-ads/trendingverse-ads.php'
const DOWNLOAD_URL = 'https://trendingverse-pages.pages.dev/api/plugin/download'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const plugin = searchParams.get('plugin')

  // WordPress checks for updates via this endpoint
  if (action === 'info' || plugin === PLUGIN_FILE) {
    return NextResponse.json({
      name: 'TrendingVerse Ads',
      slug: PLUGIN_SLUG,
      version: PLUGIN_VERSION,
      author: '<a href="https://trendingverse-pages.pages.dev">TrendingVerse</a>',
      author_profile: 'https://trendingverse-pages.pages.dev',
      requires: '5.0',
      tested: '6.5',
      requires_php: '7.4',
      last_updated: new Date().toISOString().split('T')[0],
      download_url: DOWNLOAD_URL,
      package: DOWNLOAD_URL,
      sections: {
        description: 'Automatically fetches and injects monetization ads from TrendingVerse CMS into all articles.',
        changelog: `
          <h4>2.0.0</h4><ul><li>Added Article JSON-LD structured data (NewsArticle, BreadcrumbList, WebSite, Organization schemas) — required for Google rich results and AdSense quality signals</li><li>Added Related Articles section at bottom of posts — fixes internal linking for all articles</li><li>Added dynamic ads.txt serving via WordPress request hook — fetches entries from TrendingVerse CMS automatically</li><li>Added AdSense readiness checklist in plugin settings</li><li>Added AdSense Publisher ID field — written first into served ads.txt</li><li>Improved admin settings UI with connection status and active slot table</li></ul>
          <h4>1.3.0</h4><ul><li>Fixed: corrected ad-serving endpoint — ads now load correctly from assigned ad units</li><li>Bumped version to supersede broken 1.2.3 build</li></ul>
          <h4>1.0.5</h4><ul><li>Restored original ad-serving endpoint</li><li>Added device targeting (mobile/desktop/all) per unit</li></ul>
          <h4>1.0.4</h4><ul><li>Auto-update support via WordPress plugin API</li></ul>
          <h4>1.0.0</h4><ul><li>Initial release</li></ul>
        `,
      },
      banners: {
        low: 'https://trendingverse.online/plugin-banner-low.png',
        high: 'https://trendingverse.online/plugin-banner-high.png',
      },
    })
  }

  // Default — return version check response
  return NextResponse.json({
    slug: PLUGIN_SLUG,
    version: PLUGIN_VERSION,
    package: DOWNLOAD_URL,
    new_version: PLUGIN_VERSION,
    url: 'https://trendingverse.online',
  })
}
