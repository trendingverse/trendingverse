/**
 * TrendingVerse Audience Tracker v1.3
 * Tracks: pageviews, geo, device, interests, scroll depth
 * Email capture: Google One Tap + popup (12s / 60% scroll / exit intent)
 */
(function () {
  'use strict';

  const CMS  = 'https://trendingverse.vercel.app';
  const SITE = window.TV_SITE_URL || window.location.origin;
  const CAT  = window.TV_CATEGORY || '';
  const PAGE = window.location.href;
  const GOOGLE_CLIENT_ID = window.TV_GOOGLE_CLIENT_ID || '';

  function getFingerprint() {
    let fp = localStorage.getItem('_tvfp');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('_tvfp', fp);
    }
    window.tvFingerprint = fp;
    return fp;
  }

  function getDevice() {
    const w = window.innerWidth;
    if (w <= 768) return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }

  function trackPageview(fp) {
    fetch(CMS + '/api/audience/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: fp, site_url: SITE, page_url: PAGE,
        category: CAT, device_type: getDevice(),
        referrer: document.referrer || '',
        user_agent: navigator.userAgent,
        language: navigator.language || 'en',
        screen_width: screen.width, screen_height: screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        event_type: 'pageview',
      }),
    }).catch(function() {});
  }

  function trackEmail(fp, email, name) {
    if (!email || !email.includes('@')) return;
    if (localStorage.getItem('_tvemail') === email) return; // already captured
    localStorage.setItem('_tvemail', email);
    fetch(CMS + '/api/audience/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fingerprint: fp, site_url: SITE,
        email: email, name: name || '',
        event: 'lead_capture', event_type: 'lead',
      }),
    }).catch(function() {});
  }

  // ── GOOGLE ONE TAP ────────────────────────────────────────────
  function initGoogleOneTap(fp) {
    if (!GOOGLE_CLIENT_ID) return;
    if (localStorage.getItem('_tvemail')) return; // already have email
    if (sessionStorage.getItem('_tvlc')) return;

    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = function() {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: function(response) {
          try {
            // Decode JWT to get email and name
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            if (payload.email) {
              trackEmail(fp, payload.email, payload.name || '');
              sessionStorage.setItem('_tvlc', '1');
              // Show success
              const notice = document.createElement('div');
              notice.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 4px 20px rgba(0,0,0,0.15);font-family:Arial,sans-serif;font-size:13px;color:#16a34a;font-weight:600;border:1px solid #dcfce7';
              notice.textContent = '✓ Subscribed successfully!';
              document.body.appendChild(notice);
              setTimeout(function() { if (notice.parentNode) notice.remove(); }, 3000);
            }
          } catch(e) {}
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        itp_support: true,
      });

      // Show One Tap prompt after 3 seconds
      setTimeout(function() {
        if (!sessionStorage.getItem('_tvlc') && !localStorage.getItem('_tvemail')) {
          window.google.accounts.id.prompt(function(notification) {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              // One tap not available — fall back to popup
              initPopup(fp);
            }
          });
        }
      }, 3000);
    };
    document.head.appendChild(script);
  }

  // ── SCROLL DEPTH ─────────────────────────────────────────────
  function initScrollTracker(fp) {
    let maxScroll = 0;
    const reported = {};
    let scrollTimer = null;
    const MILESTONES = [25, 50, 75, 90, 100];

    function getDepth() {
      const doc = document.documentElement;
      const scrollH = doc.scrollHeight - doc.clientHeight;
      if (scrollH <= 0) return 100;
      return Math.min(100, Math.round((window.scrollY / scrollH) * 100));
    }

    function sendDepth(depth) {
      fetch(CMS + '/api/audience/track/scroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: fp, site_url: SITE, page_url: PAGE, scroll_depth: depth }),
        keepalive: true,
      }).catch(function() {});
    }

    function onScroll() {
      const depth = getDepth();
      if (depth <= maxScroll) return;
      maxScroll = depth;
      for (let i = 0; i < MILESTONES.length; i++) {
        if (depth >= MILESTONES[i] && !reported[MILESTONES[i]]) {
          reported[MILESTONES[i]] = true;
          sendDepth(depth);
        }
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function() { sendDepth(maxScroll); }, 2000);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', function() { if (maxScroll > 0) sendDepth(maxScroll); });
    setTimeout(function() { if (maxScroll === 0) sendDepth(0); }, 3000);
    return function() { return maxScroll; };
  }

  // ── FALLBACK POPUP ────────────────────────────────────────────
  function initPopup(fp) {
    if (sessionStorage.getItem('_tvlc')) return;
    if (localStorage.getItem('_tvemail')) return;

    let shown = false;
    function showPopup() {
      if (shown || sessionStorage.getItem('_tvlc')) return;
      if (document.getElementById('tv-lead-popup')) return;
      shown = true;

      if (!document.getElementById('tv-popup-style')) {
        const style = document.createElement('style');
        style.id = 'tv-popup-style';
        style.textContent = '@keyframes tvSlideIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}';
        document.head.appendChild(style);
      }

      const overlay = document.createElement('div');
      overlay.id = 'tv-lead-popup';
      overlay.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;background:#fff;border-radius:16px;padding:20px 24px;box-shadow:0 8px 32px rgba(0,0,0,0.18);max-width:300px;font-family:Arial,sans-serif;border:1px solid #e5e7eb;animation:tvSlideIn 0.3s ease';
      overlay.innerHTML = '<button onclick="document.getElementById(\'tv-lead-popup\').remove();sessionStorage.setItem(\'_tvlc\',\'1\')" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#999">×</button>' +
        '<p style="font-weight:700;font-size:14px;margin:0 0 4px;color:#111">Stay updated 📬</p>' +
        '<p style="font-size:12px;color:#666;margin:0 0 12px">Get the latest news in your inbox</p>' +
        '<input id="tv-lead-email" type="email" placeholder="your@email.com" style="width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:8px"/>' +
        '<button onclick="tvSubmitLead(\'' + fp + '\')" style="width:100%;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Subscribe →</button>';
      document.body.appendChild(overlay);
    }

    setTimeout(showPopup, 12000);
    window.addEventListener('scroll', function() {
      const doc = document.documentElement;
      const scrollH = doc.scrollHeight - doc.clientHeight;
      if (scrollH > 0 && Math.round((window.scrollY / scrollH) * 100) >= 60) showPopup();
    }, { passive: true });
    document.addEventListener('mouseleave', function(e) { if (e.clientY < 10) showPopup(); });
  }

  window.tvSubmitLead = function(fp) {
    const input = document.getElementById('tv-lead-email');
    const email = input ? input.value : '';
    if (!email || !email.includes('@')) return;
    trackEmail(fp, email, '');
    const popup = document.getElementById('tv-lead-popup');
    if (popup) {
      popup.innerHTML = '<p style="text-align:center;padding:8px;font-size:13px;color:#16a34a;font-weight:600">✓ Subscribed!</p>';
      sessionStorage.setItem('_tvlc', '1');
      setTimeout(function() { const p = document.getElementById('tv-lead-popup'); if (p) p.remove(); }, 2000);
    }
  };

  // ── INIT ─────────────────────────────────────────────────────
  function init() {
    const fp = getFingerprint();
    trackPageview(fp);
    initScrollTracker(fp);

    // Try Google One Tap first, popup as fallback
    if (GOOGLE_CLIENT_ID) {
      initGoogleOneTap(fp);
    } else {
      initPopup(fp);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
