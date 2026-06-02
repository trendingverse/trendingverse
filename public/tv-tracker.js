/**
 * TrendingVerse Audience Tracker
 * Injected automatically via TrendingVerse Ads WordPress plugin
 * Collects anonymous first-party audience data for targeted advertising
 */
(function() {
  'use strict';

  var API = 'https://trendingverse.vercel.app/api/audience/track';
  var SITE = window.TV_SITE_URL || window.location.hostname;
  var CATEGORY = window.TV_CATEGORY || '';

  // Generate or retrieve anonymous fingerprint
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
    var payload = {
      fingerprint: FP,
      site_url: SITE,
      page_url: window.location.href,
      page_title: document.title,
      category: CATEGORY,
      event_type: type,
      value: value || '',
      referrer: document.referrer || '',
    };
    var data = JSON.stringify(payload);
    // Always use fetch with keepalive — sendBeacon doesn't support CORS headers
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data,
      keepalive: true,
      mode: 'cors',
    }).catch(function(){});
  }
  // Track pageview on load
  document.addEventListener('DOMContentLoaded', function() {
    send('pageview');
  });

  // Track scroll depth
  var maxScroll = 0;
  var scrollTimer;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var scrolled = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
      if (scrolled > maxScroll && scrolled % 25 === 0) {
        maxScroll = scrolled;
        send('scroll', scrolled + '%');
      }
    }, 500);
  });

  // Track time spent on page
  var startTime = Date.now();
  var timeSent = false;
  function sendTime() {
    if (timeSent) return;
    timeSent = true;
    var seconds = Math.round((Date.now() - startTime) / 1000);
    if (seconds > 5) send('time_spent', seconds);
  }
  window.addEventListener('beforeunload', sendTime);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') sendTime();
  });

  // Lead capture widget
  function showLeadPopup() {
    var shown = sessionStorage.getItem('tv_popup_shown');
    if (shown) return;

    // Show after 30 seconds or 50% scroll
    setTimeout(function() {
      if (document.getElementById('tv-lead-popup')) return;

      var popup = document.createElement('div');
      popup.id = 'tv-lead-popup';
      popup.style.cssText = [
        'position:fixed', 'bottom:20px', 'right:20px', 'z-index:99999',
        'background:#fff', 'border-radius:16px', 'padding:20px',
        'box-shadow:0 8px 32px rgba(0,0,0,0.15)', 'max-width:320px',
        'width:calc(100% - 40px)', 'font-family:-apple-system,sans-serif',
        'border:1px solid #e5e7eb'
      ].join(';');

      popup.innerHTML = [
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">',
          '<div>',
            '<div style="font-size:20px;margin-bottom:4px">📰</div>',
            '<p style="font-weight:700;font-size:14px;color:#111;margin:0">Get Daily News Updates</p>',
            '<p style="font-size:12px;color:#6b7280;margin:4px 0 0">Trending stories in your language</p>',
          '</div>',
          '<button id="tv-popup-close" style="background:none;border:none;cursor:pointer;color:#9ca3af;font-size:18px;line-height:1;padding:0">✕</button>',
        '</div>',
        '<input id="tv-lead-name" type="text" placeholder="Your name" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:8px;outline:none">',
        '<input id="tv-lead-email" type="email" placeholder="Your email address *" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:8px;outline:none">',
        '<input id="tv-lead-city" type="text" placeholder="Your city" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:8px;outline:none">',
        '<select id="tv-lead-gender" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:8px;color:#6b7280;outline:none">',
          '<option value="">Gender (optional)</option>',
          '<option value="male">Male</option>',
          '<option value="female">Female</option>',
          '<option value="other">Prefer not to say</option>',
        '</select>',
        '<select id="tv-lead-age" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:12px;color:#6b7280;outline:none">',
          '<option value="">Age range (optional)</option>',
          '<option value="18-24">18-24</option>',
          '<option value="25-34">25-34</option>',
          '<option value="35-44">35-44</option>',
          '<option value="45-54">45-54</option>',
          '<option value="55+">55+</option>',
        '</select>',
        '<button id="tv-lead-submit" style="width:100%;background:#ef4444;color:#fff;border:none;padding:10px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">',
          'Subscribe for Free →',
        '</button>',
        '<p style="font-size:10px;color:#9ca3af;text-align:center;margin:8px 0 0">No spam. Unsubscribe anytime.</p>',
      ].join('');

      document.body.appendChild(popup);
      sessionStorage.setItem('tv_popup_shown', '1');

      document.getElementById('tv-popup-close').addEventListener('click', function() {
        popup.remove();
      });

      document.getElementById('tv-lead-submit').addEventListener('click', function() {
        var email = document.getElementById('tv-lead-email').value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          document.getElementById('tv-lead-email').style.borderColor = '#ef4444';
          return;
        }
        var btn = document.getElementById('tv-lead-submit');
        btn.textContent = 'Subscribing...';
        btn.disabled = true;

        var leadData = {
          fingerprint: FP,
          email: email,
          name: document.getElementById('tv-lead-name').value.trim(),
          city: document.getElementById('tv-lead-city').value.trim(),
          gender: document.getElementById('tv-lead-gender').value,
          age_range: document.getElementById('tv-lead-age').value,
          source_site: SITE,
          source_page: window.location.href,
          interests: CATEGORY ? [CATEGORY] : [],
        };

        fetch(API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leadData),
        })
        .then(function() {
          popup.innerHTML = [
            '<div style="text-align:center;padding:12px">',
              '<div style="font-size:40px;margin-bottom:8px">🎉</div>',
              '<p style="font-weight:700;color:#111;margin:0 0 4px">You\'re subscribed!</p>',
              '<p style="font-size:12px;color:#6b7280">You\'ll receive daily trending news updates.</p>',
            '</div>',
          ].join('');
          setTimeout(function() { popup.remove(); }, 3000);
          send('lead_capture', email);
        })
        .catch(function() {
          btn.textContent = 'Subscribe for Free →';
          btn.disabled = false;
        });
      });
    }, 30000); // Show after 30 seconds
  }

  // Show popup for new visitors
  if (!localStorage.getItem('tv_subscribed')) {
    showLeadPopup();
  }

  // Expose global for PHP to call
  window.TV_TRACKER = { fingerprint: FP, send: send };

})();
