export const runtime = 'edge'
import { NextRequest, NextResponse } from 'next/server'

// Current plugin version hosted on your server
const PLUGIN_VERSION = '1.2.4'
const PLUGIN_SLUG = 'trendingverse-ads'
const PLUGIN_FILE = 'trendingverse-ads/trendingverse-ads.php'
const DOWNLOAD_URL = 'https://trendingverse.vercel.app/api/plugin/download'

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
      author: '<a href="https://trendingverse.vercel.app">TrendingVerse</a>',
      author_profile: 'https://trendingverse.vercel.app',
      requires: '5.0',
      tested: '6.5',
      requires_php: '7.4',
      last_updated: new Date().toISOString().split('T')[0],
      download_url: DOWNLOAD_URL,
      package: DOWNLOAD_URL,
      sections: {
        description: 'Automatically fetches and injects monetization ads from TrendingVerse CMS into all articles.',
        changelog: `
          <h4>1.2.4</h4><ul><li>Silent auto-update enabled — no publisher action required for future updates</li></ul>
          <h4>1.2.3</h4><ul><li>Outstream: full IAB crawl-down format — docked poster in article, floats to bottom-right on scroll, close returns to slot, repeatable pop-out cycle</li></ul>
          <h4>1.2.2</h4><ul><li>Outstream: IntersectionObserver trigger on slot position instead of fixed scroll distance</li></ul>
          <h4>1.2.1</h4><ul><li>Outstream video ad support</li></ul>
          <h4>1.2.0</h4><ul><li>Inbanner video ad support, VTR/VCR event tracking</li></ul>
          <h4>1.1.0</h4><ul><li>Interstitial, sticky footer, multi-slot mediation</li></ul>
          <h4>1.0.0</h4><ul><li>Initial release</li></ul>
        `,
      },
      banners: {
        low: 'https://trendingverse.vercel.app/plugin-banner-low.png',
        high: 'https://trendingverse.vercel.app/plugin-banner-high.png',
      },
    })
  }

  // Default — return version check response
  return NextResponse.json({
    slug: PLUGIN_SLUG,
    version: PLUGIN_VERSION,
    package: DOWNLOAD_URL,
    new_version: PLUGIN_VERSION,
    url: 'https://trendingverse.vercel.app',
  })
}
