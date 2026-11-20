// SSUNDAR. / EXLPRS — Cookie Consent & Analytics Manager
// GDPR / UK GDPR / CCPA compliant.
// GA4 (G-17GGZ3QCQF) and Microsoft Clarity (venlbqedo4) are BLOCKED until
// the user explicitly accepts analytics. Strictly necessary cookies (hCaptcha,
// Netlify infra) fire unconditionally — no consent required under GDPR Rec.47.

(function () {
  'use strict';

  var STORAGE_KEY   = 'exlprs_cookie_consent';
  var CONSENT_VER   = '2';                      // bump if consent categories change
  var GA_ID         = 'G-17GGZ3QCQF';
  var CLARITY_ID    = 'venlbqedo4';

  // ── Consent helpers ──────────────────────────────────────────────────────────
  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setConsent(analytics) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: CONSENT_VER,
        analytics: analytics,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  function hasDecided() {
    var c = getConsent();
    return c && c.v === CONSENT_VER;
  }

  // ── Analytics loaders ─────────────────────────────────────────────────────────
  function loadGA4() {
    if (window.__ga4Loaded) return;
    window.__ga4Loaded = true;
    // Inject gtag script
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  function loadClarity() {
    if (window.__clarityLoaded) return;
    window.__clarityLoaded = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }

  function loadAnalytics() {
    loadGA4();
    loadClarity();
  }

  // ── If already decided, act immediately ───────────────────────────────────────
  var existing = getConsent();
  if (existing && existing.v === CONSENT_VER && existing.analytics) {
    loadAnalytics();
  }

  // ── Banner ────────────────────────────────────────────────────────────────────
  function dismiss(banner) {
    banner.style.transform = 'translateY(120%)';
    banner.style.opacity   = '0';
    document.body.classList.remove('cookie-banner-open');
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 380);
  }

  function createBanner() {
    var banner = document.createElement('div');
    banner.id = 'exlprs-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.setAttribute('aria-modal', 'false');

    banner.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'transform:translateY(0)',
      'background:#0B0B0C',
      'border-top:1px solid #E31E24',
      'padding:10px clamp(14px,3vw,32px)',
      'z-index:99999',
      'display:flex', 'flex-wrap:wrap', 'align-items:center', 'justify-content:center', 'gap:8px 20px',
      'transition:transform 0.35s ease,opacity 0.35s ease',
      'font-family:var(--body,\'Inter Tight\',system-ui,sans-serif)',
    ].join(';');

    // Text block
    var text = document.createElement('p');
    text.style.cssText = 'margin:0;font-size:13px;line-height:1.45;color:rgba(237,234,228,0.72);max-width:720px;';
    text.innerHTML = 'Analytics (Google Analytics, Microsoft Clarity) only with your consent. Nothing is sold or shared for advertising. Strictly necessary security cookies always run. '
      + '<a href="privacy.html#cookie-policy" style="color:#C7A977;text-decoration:underline;">Cookie policy</a>';

    // Button row
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-shrink:0;';

    function makeBtn(label, primary) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = [
        'padding:7px 16px',
        'font-size:11px',
        'font-weight:700',
        'letter-spacing:0.08em',
        'text-transform:uppercase',
        'cursor:pointer',
        'font-family:inherit',
        'border:1px solid ' + (primary ? '#E31E24' : 'rgba(255,255,255,0.2)'),
        'background:' + (primary ? '#E31E24' : 'transparent'),
        'color:' + (primary ? '#fff' : 'rgba(237,234,228,0.7)'),
        'white-space:nowrap',
      ].join(';');
      return b;
    }

    var acceptBtn  = makeBtn('Accept analytics', true);
    var declineBtn = makeBtn('Decline', false);

    var manageLink = document.createElement('a');
    manageLink.href = 'privacy.html';
    manageLink.textContent = 'Privacy Policy';
    manageLink.style.cssText = 'font-family:monospace;font-size:10px;color:rgba(255,255,255,0.25);text-decoration:none;margin-left:8px;';

    acceptBtn.addEventListener('click', function () {
      setConsent(true);
      loadAnalytics();
      dismiss(banner);
    });

    declineBtn.addEventListener('click', function () {
      setConsent(false);
      dismiss(banner);
    });

    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { setConsent(false); dismiss(banner); document.removeEventListener('keydown', onEsc); }
    });

    row.appendChild(acceptBtn);
    row.appendChild(declineBtn);

    banner.appendChild(text);
    banner.appendChild(row);
    return banner;
  }

  function init() {
    if (hasDecided()) return;           // already answered — don't show again
    setTimeout(function () {
      if (!document.body) return;
      var banner = createBanner();
      document.body.appendChild(banner);
      document.body.style.setProperty('--cookie-banner-h', (banner.offsetHeight + 30) + 'px');
      document.body.classList.add('cookie-banner-open');
      setTimeout(function () { banner.querySelector('button').focus(); }, 120);
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
