'use client'

// PluginUpdateClient.tsx
// Shows all publisher sites with:
//  - Direct download link to new plugin ZIP
//  - One-click update URL to paste into browser (or send to publisher)
//  - Copy-to-clipboard for each

const CF_PAGES_BASE = 'https://trendingverse-pages.pages.dev'
const PLUGIN_ZIP_URL = `${CF_PAGES_BASE}/downloads/trendingverse-ads.zip`
const UPDATE_KEY = 'tvads2024update'

interface Publisher {
  id: string
  name: string
  site_url: string
  contact_email?: string
}

function getUpdateUrl(siteUrl: string) {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}/tv-update.php?key=${UPDATE_KEY}`
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text) }}
      className="ml-2 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
    >
      Copy
    </button>
  )
}

export default function PluginUpdateClient({ publishers }: { publishers: Publisher[] }) {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Plugin Update — Publisher Sites</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Update the TrendingVerse Ads plugin on each publisher's WordPress site.
          The plugin was pointing to Vercel (now paused) — this updates it to CF Pages.
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 text-sm text-blue-200 space-y-2">
        <p className="font-semibold text-blue-100">How to update each site:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-200">
          <li>Download the new plugin ZIP (button below)</li>
          <li>
            <strong>Option A — You have WP access:</strong> Go to WP Admin › Plugins › Add New › Upload, upload the ZIP, activate.
          </li>
          <li>
            <strong>Option B — Upload tv-update.php:</strong> Upload <code>tv-update.php</code> to the site root via FTP/cPanel,
            then open the Update URL below. The plugin auto-reinstalls and the helper file deletes itself.
          </li>
          <li>
            <strong>Option C — Ask the publisher:</strong> Send them the Update URL — they just need to open it while logged into WP Admin.
          </li>
        </ol>
      </div>

      {/* Global downloads */}
      <div className="flex flex-wrap gap-3">
        <a
          href={PLUGIN_ZIP_URL}
          download
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium"
        >
          ⬇ Download New Plugin ZIP (v1.2.4)
        </a>
        <a
          href="/tv-update.php"
          download
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
        >
          ⬇ Download tv-update.php helper
        </a>
      </div>

      {/* Per-publisher table */}
      <div className="space-y-3">
        {publishers.length === 0 && (
          <p className="text-slate-500 text-sm">No publisher sites found in the database.</p>
        )}
        {publishers.map(pub => {
          const updateUrl = getUpdateUrl(pub.site_url)
          return (
            <div
              key={pub.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-semibold text-white">{pub.name}</span>
                  <a
                    href={pub.site_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-400 text-sm hover:underline"
                  >
                    {pub.site_url}
                  </a>
                  {pub.contact_email && (
                    <span className="ml-2 text-slate-400 text-xs">{pub.contact_email}</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 w-28 shrink-0">Update URL:</span>
                  <code className="text-xs bg-slate-900 px-2 py-1 rounded text-green-300 break-all">
                    {updateUrl}
                  </code>
                  <CopyButton text={updateUrl} />
                  <a
                    href={updateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-xs bg-green-800 hover:bg-green-700 text-green-200 rounded"
                  >
                    Open ↗
                  </a>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-400 w-28 shrink-0">Email draft:</span>
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent('Action needed: TrendingVerse Ads plugin update')
                      const body = encodeURIComponent(
                        `Hi,\n\nPlease update the TrendingVerse Ads plugin on your site to restore ads.\n\n` +
                        `Quick update steps:\n` +
                        `1. Make sure you are logged into your WordPress admin\n` +
                        `2. Upload this file to your site root via FTP or File Manager:\n   ${CF_PAGES_BASE}/tv-update.php\n` +
                        `3. Open this URL in your browser:\n   ${updateUrl}\n` +
                        `4. Wait ~10 seconds — the plugin will auto-update and the helper file deletes itself\n\n` +
                        `Alternatively, download and reinstall the plugin manually:\n${PLUGIN_ZIP_URL}\n\n` +
                        `Thanks,\nTrendingVerse Team`
                      )
                      window.location.href = `mailto:${pub.contact_email || ''}?subject=${subject}&body=${body}`
                    }}
                    className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                  >
                    📧 Draft email
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-xs text-slate-500 mt-4">
        Plugin ZIP served from: <code>{PLUGIN_ZIP_URL}</code>
      </div>
    </div>
  )
}
