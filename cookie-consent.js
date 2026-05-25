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
    setTimeout(function () {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 380);
  }

  function createBanner() {
    var banner = document.createElement('div');
    banner.id = 'exlprs-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.setAttribute('aria-modal', 'true');

    banner.style.cssText = [
      'position:fixed', 'bottom:20px', 'left:50%',
      'transform:translateX(-50%) translateY(0)',
      'width:calc(100% - 40px)', 'max-width:760px',
      'background:#111111',
      'border:1px solid rgba(255,255,255,0.1)',
      'border-top:2px solid #E31E24',
      'padding:20px 24px',
      'z-index:99999',
      'box-shadow:0 12px 48px rgba(0,0,0,0.7)',
      'transition:transform 0.35s ease,opacity 0.35s ease',
      'font-family:Georgia,serif',
    ].join(';');

    // Text block
    var text = document.createElement('p');
    text.style.cssText = 'margin:0 0 14px;font-size:12px;line-height:1.7;color:rgba(255,255,255,0.5);';
    text.innerHTML =
      'We use <strong style="color:rgba(255,255,255,0.75)">strictly necessary</strong> cookies (hCaptcha security) automatically. '
      + 'With your consent, we also use <strong style="color:rgba(255,255,255,0.75)">Google Analytics 4</strong> and '
      + '<strong style="color:rgba(255,255,255,0.75)">Microsoft Clarity</strong> to understand how the site is used — '
      + 'no data is sold or shared for advertising. '
      + '<a href="privacy.html#cookie-policy" style="color:#E31E24;text-decoration:none;">Cookie Policy</a>';

    // Button row
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;';

    function makeBtn(label, primary) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = [
        'padding:8px 22px',
        'font-size:11px',
        'font-weight:700',
        'letter-spacing:0.08em',
        'text-transform:uppercase',
        'cursor:pointer',
        'font-family:monospace',
        'border:1px solid ' + (primary ? '#E31E24' : 'rgba(255,255,255,0.2)'),
        'background:' + (primary ? '#E31E24' : 'transparent'),
        'color:' + (primary ? '#fff' : 'rgba(255,255,255,0.45)'),
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
    row.appendChild(manageLink);

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
      setTimeout(function () { banner.querySelector('button').focus(); }, 120);
    }, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
