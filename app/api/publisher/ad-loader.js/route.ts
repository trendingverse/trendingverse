export const runtime = 'edge'
// app/api/publisher/ad-loader.js/route.ts
// Returns a self-executing JS that fetches & injects all active ad units for a domain
// Publisher adds ONE tag: <script src="https://yourdomain.vercel.app/api/publisher/ad-loader.js?site=app.kannadadunia.com" async></script>

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const site = req.nextUrl.searchParams.get('site') || ''
  const cleanSite = site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

  let adUnits: { code: string; position: string }[] = []

  if (cleanSite) {
    try {
      const db = adminClient()

      // Match ad units by site_url — check both primary and additional domains
      const matchUrls = [
        cleanSite,
        `https://${cleanSite}`,
        `https://www.${cleanSite}`,
      ]

      const { data: units } = await db
        .from('ad_units')
        .select('ad_code, position')
        .in('site_url', matchUrls)
        .eq('is_active', true)

      adUnits = (units ?? []).map(u => ({ code: u.ad_code, position: u.position }))
    } catch { /* serve empty if error */ }
  }

  // Build the loader JS
  const escapedUnits = JSON.stringify(adUnits)

  const js = `
(function() {
  var units = ${escapedUnits};
  if (!units || !units.length) return;

  function injectUnit(unit) {
    var container = document.createElement('div');
    container.setAttribute('data-tv-ad', unit.position || 'inline');
    container.style.textAlign = 'center';
    container.style.margin = '8px auto';

    // Parse and re-create script tags (innerHTML doesn't execute scripts)
    var temp = document.createElement('div');
    temp.innerHTML = unit.code;
    var scripts = temp.querySelectorAll('script');
    var nonScripts = temp.querySelectorAll(':not(script)');

    nonScripts.forEach(function(el) { container.appendChild(el.cloneNode(true)); });

    scripts.forEach(function(s) {
      var newScript = document.createElement('script');
      if (s.src) {
        newScript.src = s.src;
        newScript.async = true;
      } else {
        newScript.textContent = s.textContent;
      }
      container.appendChild(newScript);
    });

    // Position-based injection
    var pos = (unit.position || '').toLowerCase();
    if (pos === 'header') {
      document.head.appendChild(container);
    } else if (pos === 'footer' || pos === 'body_end') {
      document.body.appendChild(container);
    } else {
      // Default: append before closing body
      document.body.appendChild(container);
    }
  }

  function loadAds() {
    units.forEach(function(unit) {
      try { injectUnit(unit); } catch(e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAds);
  } else {
    loadAds();
  }
})();
`

  return new NextResponse(js, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300', // cache 5 min
    }
  })
}
