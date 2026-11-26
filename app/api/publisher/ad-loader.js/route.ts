export const runtime = 'edge'
// app/api/publisher/ad-loader.js/route.ts
// Returns a self-executing JS that fetches & injects all active ad units for a domain
// Publisher adds ONE tag: <script src="https://yourdomain.vercel.app/api/publisher/ad-loader.js?site=app.kannadadunia.com" async></script>

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY||'')!
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
      // Sticky anchor banner — fixed to bottom of viewport
      var anchorId = 'tv-anchor-' + Math.random().toString(36).slice(2, 8);
      var anchor = document.createElement('div');
      anchor.id = anchorId;
      anchor.setAttribute('data-tv-ad', 'footer');
      anchor.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;display:flex;justify-content:center;pointer-events:none;';

      var inner = document.createElement('div');
      inner.style.cssText = 'position:relative;pointer-events:all;background:#fff;box-shadow:0 -2px 10px rgba(0,0,0,.18);max-width:100vw;box-sizing:border-box;text-align:center;';

      // Close button
      var closeBtn = document.createElement('button');
      closeBtn.setAttribute('aria-label', 'Close ad');
      closeBtn.style.cssText = 'position:absolute;top:-22px;right:0;background:rgba(0,0,0,.65);color:#fff;border:none;padding:1px 8px 2px;cursor:pointer;font-size:11px;line-height:1.6;border-radius:3px 3px 0 0;font-family:sans-serif;';
      closeBtn.textContent = '✕ Close';
      closeBtn.onclick = function() {
        var el = document.getElementById(anchorId);
        if (el) {
          el.style.display = 'none';
          document.body.style.paddingBottom = el.dataset.prevPad || '';
        }
      };

      // Ad label
      var label = document.createElement('div');
      label.style.cssText = 'font-size:9px;line-height:1;color:#999;letter-spacing:.5px;text-transform:uppercase;font-family:sans-serif;text-align:center;padding:3px 0 2px;background:#f2f2f2;';
      label.textContent = 'Advertisement';

      // Ad content wrapper
      var adWrap = document.createElement('div');
      adWrap.style.cssText = 'background:#f2f2f2;overflow:hidden;';

      // Move scripts/nodes from container into adWrap
      while (container.firstChild) {
        adWrap.appendChild(container.firstChild);
      }

      inner.appendChild(closeBtn);
      inner.appendChild(label);
      inner.appendChild(adWrap);
      anchor.appendChild(inner);
      document.body.appendChild(anchor);

      // Self-manage body padding so content isn't hidden under banner
      (function() {
        var el = document.getElementById(anchorId);
        if (!el) return;
        el.dataset.prevPad = document.body.style.paddingBottom || '';
        var h = inner.offsetHeight || 90;
        document.body.style.paddingBottom = (h + 20) + 'px';
        // Re-measure after a tick in case ad loads and changes height
        setTimeout(function() {
          var el2 = document.getElementById(anchorId);
          if (el2 && el2.style.display !== 'none') {
            document.body.style.paddingBottom = (inner.offsetHeight + 20) + 'px';
          }
        }, 1500);
      })();
      return; // already injected
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
      'Access-Control-Allow-Origin': '*',
    }
  })
}
