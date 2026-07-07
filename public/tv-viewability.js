/**
 * TrendingVerse viewability tracker — MRC display standard.
 * Fires a "viewable" beacon when a served direct ad has >=50% of its
 * pixels in view for >=1 continuous second.
 *
 * USAGE: whatever renders the ad from /api/audience/serve-ad must put the
 * ad's id and the fingerprint on the container element, e.g.:
 *   <div class="tv-direct-ad" data-ad-id="{ad.id}" data-fp="{fingerprint}">...</div>
 * Then call TVViewability.observe(el)  — or rely on the auto-scan below.
 */
(function () {
  'use strict';
  var CMS = 'https://trendingverse.vercel.app';
  var THRESHOLD = 0.5;        // 50% of pixels in view (MRC display)
  var DWELL_MS = 1000;        // for 1 continuous second
  var fired = {};             // ad_id -> true, dedupe per page load

  function sendViewable(adId, fp, siteUrl) {
    if (fired[adId]) return;
    fired[adId] = true;
    try {
      fetch(CMS + '/api/audience/ad-viewable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_id: adId, fingerprint: fp, site_url: siteUrl }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function observe(el) {
    if (!el || el.dataset.tvViewObserved === '1') return;
    el.dataset.tvViewObserved = '1';
    var adId = el.dataset.adId;
    var fp = el.dataset.fp || window.tvFingerprint || '';
    var siteUrl = window.TV_SITE_URL || window.location.origin;
    if (!adId) return;

    var dwellTimer = null;

    if (!('IntersectionObserver' in window)) {
      // No IO support — count as viewable on load (best effort)
      sendViewable(adId, fp, siteUrl);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= THRESHOLD) {
          // Start the 1s dwell clock
          if (!dwellTimer) {
            dwellTimer = setTimeout(function () {
              sendViewable(adId, fp, siteUrl);
              io.unobserve(el);
            }, DWELL_MS);
          }
        } else {
          // Left the viewport (or dropped below 50%) before 1s — reset
          if (dwellTimer) { clearTimeout(dwellTimer); dwellTimer = null; }
        }
      });
    }, { threshold: [0, THRESHOLD, 1] });

    io.observe(el);
  }

  // Auto-scan for direct-ad containers already in the DOM + any added later
  function scan() {
    document.querySelectorAll('.tv-direct-ad[data-ad-id]').forEach(observe);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Watch for direct ads injected after load (lazy slots, etc.)
  if ('MutationObserver' in window) {
    new MutationObserver(function () { scan(); })
      .observe(document.body, { childList: true, subtree: true });
  }

  // Expose for manual wiring if the renderer prefers to call it directly
  window.TVViewability = { observe: observe };
})();
