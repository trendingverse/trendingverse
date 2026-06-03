/**
 * TrendingVerse Audience Tracker v1.1
 * Non-intrusive sticky subscribe bar instead of popup
 */
(function() {
  'use strict';

  var API = 'https://trendingverse.vercel.app/api/audience/track';
  var SITE = window.TV_SITE_URL || window.location.hostname;
  var CATEGORY = window.TV_CATEGORY || '';

  function getFingerprint() {
    var key = 'tv_fp';
    var fp = localStorage.getItem(key);
    if (!fp) {
      fp = 'tvf_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem(key, fp); } catch(e) {}
    }
    return fp;
  }

  var FP = getFingerprint();

  function send(type, value) {
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: FP,
        site_url: SITE,
        page_url: window.location.href,
        page_title: document.title,
        category: CATEGORY,
        event_type: type,
        value: value || '',
        referrer: document.referrer || '',
      }),
      keepalive: true,
      mode: 'cors',
    }).catch(function(){});
  }

  // Track pageview
  document.addEventListener('DOMContentLoaded', function() { send('pageview'); });

  // Track scroll depth
  var maxScroll = 0, scrollTimer;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var scrolled = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (scrolled > maxScroll && scrolled % 25 === 0) { maxScroll = scrolled; send('scroll', scrolled + '%'); }
    }, 500);
  });

  // Track time on page
  var startTime = Date.now(), timeSent = false;
  function sendTime() {
    if (timeSent) return; timeSent = true;
    var s = Math.round((Date.now() - startTime) / 1000);
    if (s > 5) send('time_spent', s);
  }
  window.addEventListener('beforeunload', sendTime);
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') sendTime(); });

  // ── NON-INTRUSIVE STICKY BOTTOM BAR ─────────────────────────
  // Shows only after user has scrolled 60% — they're clearly engaged
  // Slim single-line bar at the very bottom — not blocking content
  // Dismissed permanently per device, not just per session

  function showSubscribeBar() {
    if (localStorage.getItem('tv_subscribed')) return;
    if (document.getElementById('tv-sub-bar')) return;

    var bar = document.createElement('div');
    bar.id = 'tv-sub-bar';
    bar.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9999',
      'background:#111827', 'color:#fff',
      'display:flex', 'align-items:center', 'justify-content:center',
      'gap:8px', 'padding:10px 16px',
      'font-family:-apple-system,sans-serif', 'font-size:13px',
      'box-shadow:0 -2px 12px rgba(0,0,0,0.15)',
      'transform:translateY(100%)', 'transition:transform 0.3s ease',
    ].join(';');

    bar.innerHTML = [
      '<span style="color:#9ca3af;font-size:12px;white-space:nowrap">📰 Get daily updates</span>',
      '<input id="tv-bar-email" type="email" placeholder="Your email" style="',
        'flex:1;max-width:220px;padding:6px 10px;border:1px solid #374151;',
        'border-radius:6px;background:#1f2937;color:#fff;font-size:12px;outline:none;',
      '">',
      '<button id="tv-bar-submit" style="',
        'background:#ef4444;color:#fff;border:none;padding:6px 14px;',
        'border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;',
      '">Subscribe →</button>',
      '<button id="tv-bar-close" style="',
        'background:none;border:none;color:#6b7280;cursor:pointer;',
        'font-size:16px;padding:0 4px;line-height:1;',
      '" title="Dismiss">✕</button>',
    ].join('');

    document.body.appendChild(bar);

    // Slide in
    setTimeout(function() { bar.style.transform = 'translateY(0)'; }, 100);

    // Close — dismiss for 7 days
    document.getElementById('tv-bar-close').addEventListener('click', function() {
      bar.style.transform = 'translateY(100%)';
      setTimeout(function() { bar.remove(); }, 300);
      // Store dismissal with 7-day expiry
      localStorage.setItem('tv_bar_dismissed', Date.now() + 7 * 86400000);
    });

    // Submit
    document.getElementById('tv-bar-submit').addEventListener('click', function() {
      var email = document.getElementById('tv-bar-email').value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('tv-bar-email').style.borderColor = '#ef4444';
        return;
      }
      var btn = document.getElementById('tv-bar-submit');
      btn.textContent = '✓ Done!';
      btn.style.background = '#10b981';
      btn.disabled = true;

      fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({
          fingerprint: FP, email: email,
          source_site: SITE, source_page: window.location.href,
          interests: CATEGORY ? [CATEGORY] : [],
        }),
      }).catch(function(){});

      localStorage.setItem('tv_subscribed', '1');
      send('lead_capture', email);
      setTimeout(function() { bar.style.transform = 'translateY(100%)'; setTimeout(function() { bar.remove(); }, 300); }, 2000);
    });
  }

  // Show bar only after 60% scroll AND not dismissed recently
  window.addEventListener('scroll', function() {
    var dismissed = localStorage.getItem('tv_bar_dismissed');
    if (dismissed && Date.now() < parseInt(dismissed)) return;
    var scrolled = window.scrollY / (document.body.scrollHeight - window.innerHeight);
    if (scrolled > 0.6) showSubscribeBar();
  }, { passive: true });

  window.TV_TRACKER = { fingerprint: FP, send: send };
})();
