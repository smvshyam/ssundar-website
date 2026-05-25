(function () {
  'use strict';

  var GA_ID = 'G-17GGZ3QCQF';
  var CLARITY_ID = 'venlbqedo4';
  var STORAGE_KEY = 'ssundar_cookie_ok';

  function loadGA() {
    if (window.__ga_loaded) return;
    window.__ga_loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { anonymize_ip: true });
  }

  function loadClarity() {
    if (window.__clarity_loaded) return;
    window.__clarity_loaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  function loadAnalytics() {
    loadGA();
    loadClarity();
  }

  function grantConsent() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    var bar = document.getElementById('cookieBar');
    if (bar) bar.style.display = 'none';
    loadAnalytics();
  }

  function showBanner() {
    var bar = document.getElementById('cookieBar');
    if (bar) bar.style.display = 'flex';
    var btn = document.getElementById('cookieAccept');
    if (btn) btn.addEventListener('click', grantConsent);
    var dec = document.getElementById('cookieDecline');
    if (dec) dec.addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, '0'); } catch (e) {}
      if (bar) bar.style.display = 'none';
    });
  }

  function init() {
    var consent;
    try { consent = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (consent === '1') {
      loadAnalytics();
    } else if (consent === null) {
      // First visit — show banner, do NOT load analytics yet
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showBanner);
      } else {
        showBanner();
      }
    }
    // consent === '0' → user declined, load nothing
  }

  // Expose for inline onclick fallback
  window.ssundarConsent = { grant: grantConsent };

  init();
})();
