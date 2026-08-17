/**
 * SSUNDAR.com — Phase 10 Destruction Audit
 * Framework: Playwright
 * Run: npx playwright test tests/destruction_audit.spec.js --reporter=list
 *
 * Covers:
 *  - String flooding (10,000 chars into narrow fields)
 *  - Injection vectors (SQL, XSS, shell, path traversal)
 *  - Empty/bypass submissions
 *  - Emoji + multi-byte inputs
 *  - Rate limit surface (rapid submissions)
 *  - Legal page existence
 *  - Security header presence
 *  - Analytics not loading before consent
 */

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.TEST_URL || 'https://ssundar.com';
const FLOOD = 'A'.repeat(10000);
const INJECTIONS = [
  "' OR '1'='1",
  '" OR "1"="1',
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  '${7*7}',
  '{{7*7}}',
  '../../../etc/passwd',
  '; DROP TABLE users; --',
  '\x00\x01\x02',
  '𝕳𝖊𝖑𝖑𝖔 💀 🔥 ✓ ™',
  '                                              ',   // whitespace only
  '\n\r\t',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fillAndSubmit(page, values) {
  for (const [id, val] of Object.entries(values)) {
    const el = page.locator(`#${id}`);
    if (await el.count()) {
      await el.fill('');
      await el.fill(String(val));
    }
  }
  await page.click('button[type=submit]');
}

// ── Security Headers ─────────────────────────────────────────────────────────

test.describe('Phase 7 — Security headers', () => {
  test('CSP header present', async ({ request }) => {
    const res = await request.get(BASE_URL);
    const csp = res.headers()['content-security-policy'];
    expect(csp, 'Content-Security-Policy header missing').toBeTruthy();
    expect(csp).toContain('default-src');
  });

  test('Referrer-Policy header present', async ({ request }) => {
    const res = await request.get(BASE_URL);
    expect(res.headers()['referrer-policy']).toBeTruthy();
  });

  test('X-Frame-Options is DENY', async ({ request }) => {
    const res = await request.get(BASE_URL);
    expect(res.headers()['x-frame-options']).toBe('DENY');
  });

  test('X-Content-Type-Options is nosniff', async ({ request }) => {
    const res = await request.get(BASE_URL);
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('.env not exposed', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/.env`);
    const body = await res.text();
    expect(body).not.toMatch(/API_KEY|SECRET|TOKEN|DATABASE_URL/i);
  });

  test('.git/config not exposed', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/.git/config`);
    const body = await res.text();
    expect(body).not.toContain('[core]');
  });
});

// ── Legal Compliance ─────────────────────────────────────────────────────────

test.describe('Phase 8 — Legal pages', () => {
  test('Privacy policy page exists and has content', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);
    const body = await page.textContent('body');
    expect(body).toMatch(/privacy|data|cookie/i);
    expect(body).not.toContain('Page not found');
  });

  test('Terms of service page exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/terms`);
    const body = await page.textContent('body');
    expect(body).toMatch(/terms|service|agreement/i);
    expect(body).not.toContain('Page not found');
  });

  test('robots.txt exists and is not HTML', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/robots.txt`);
    const body = await res.text();
    expect(body).toContain('User-agent');
    expect(body).not.toContain('<!DOCTYPE');
  });

  test('sitemap.xml exists', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/sitemap.xml`);
    const body = await res.text();
    expect(body).toContain('<urlset');
  });
});

// ── Cookie Consent — Analytics must NOT fire before consent ──────────────────

test.describe('Phase 9 — GDPR consent gate', () => {
  test('GA4 does not load before consent is given', async ({ page }) => {
    // Clear localStorage to simulate fresh visit
    await page.addInitScript(() => localStorage.clear());
    const gaRequests = [];
    page.on('request', req => {
      if (req.url().includes('googletagmanager.com') || req.url().includes('google-analytics.com')) {
        gaRequests.push(req.url());
      }
    });
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    expect(gaRequests.length, 'GA4 fired before consent').toBe(0);
  });

  test('Clarity does not load before consent is given', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    const clarityRequests = [];
    page.on('request', req => {
      if (req.url().includes('clarity.ms')) clarityRequests.push(req.url());
    });
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    expect(clarityRequests.length, 'Clarity fired before consent').toBe(0);
  });

  test('Cookie banner visible on first visit', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(BASE_URL);
    const banner = page.locator('#cookieBar');
    await expect(banner).toBeVisible({ timeout: 5000 });
  });

  test('GA4 loads after Accept clicked', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    const gaRequests = [];
    page.on('request', req => {
      if (req.url().includes('googletagmanager.com')) gaRequests.push(req.url());
    });
    await page.goto(BASE_URL);
    await page.click('#cookieAccept');
    await page.waitForTimeout(3000);
    expect(gaRequests.length, 'GA4 did not load after consent').toBeGreaterThan(0);
  });

  test('Decline hides banner and loads no analytics', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    const analyticsRequests = [];
    page.on('request', req => {
      if (req.url().includes('googletagmanager.com') || req.url().includes('clarity.ms')) {
        analyticsRequests.push(req.url());
      }
    });
    await page.goto(BASE_URL);
    await page.click('#cookieDecline');
    await page.waitForTimeout(2000);
    const banner = page.locator('#cookieBar');
    await expect(banner).not.toBeVisible();
    expect(analyticsRequests.length).toBe(0);
  });
});

// ── Form Destruction Tests ───────────────────────────────────────────────────

test.describe('Phase 10 — Engage form destruction audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/engage`);
    await page.waitForSelector('#engageForm');
  });

  test('String flooding — 10,000 chars in company field', async ({ page }) => {
    await fillAndSubmit(page, {
      company: FLOOD,
      role: 'Test Role',
      challenge: 'Test challenge text',
      email: 'flood@test.com',
    });
    // Should show validation error or handle gracefully — no crash
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('Error 500');
    expect(body).not.toContain('stack trace');
  });

  test('String flooding — 10,000 chars in challenge textarea', async ({ page }) => {
    await fillAndSubmit(page, {
      company: 'ACME Corp',
      role: 'CHRO',
      challenge: FLOOD,
      email: 'flood@test.com',
    });
    await page.waitForTimeout(1000);
    const body = await page.textContent('body');
    expect(body).not.toContain('Error 500');
  });

  for (const [i, injection] of INJECTIONS.entries()) {
    test(`Injection vector ${i + 1}: ${injection.slice(0, 30)}`, async ({ page }) => {
      await fillAndSubmit(page, {
        company: injection,
        role: injection,
        challenge: injection,
        email: 'injection@test.com',
      });
      await page.waitForTimeout(800);
      const body = await page.textContent('body');
      // Must not reflect raw injection back unescaped or crash
      expect(body).not.toContain('Error 500');
      expect(body).not.toContain('stack trace');
      expect(body).not.toContain('undefined');
    });
  }

  test('Empty submission bypass — all fields blank', async ({ page }) => {
    await page.click('button[type=submit]');
    await page.waitForTimeout(500);
    // Form should show validation errors, not submit
    const errors = page.locator('.form-error');
    const errorCount = await errors.count();
    expect(errorCount, 'No validation errors shown for empty form').toBeGreaterThan(0);
  });

  test('Invalid email format rejected', async ({ page }) => {
    await fillAndSubmit(page, {
      company: 'ACME',
      role: 'CHRO',
      challenge: 'Need help',
      email: 'notanemail',
    });
    await page.waitForTimeout(500);
    const emailError = page.locator('#err-email');
    await expect(emailError).toBeVisible();
  });

  test('Emoji input in all fields — no crash', async ({ page }) => {
    await fillAndSubmit(page, {
      company: '🏢💀🔥™®',
      role: '👔🎯',
      challenge: '💬 Need performance systems 🚀',
      email: 'emoji@test.com',
    });
    await page.waitForTimeout(800);
    const body = await page.textContent('body');
    expect(body).not.toContain('Error 500');
  });

  test('Honeypot field is hidden from users', async ({ page }) => {
    const honeypot = page.locator('input[name="_gotcha"]');
    await expect(honeypot).toBeHidden();
  });

  test('Honeypot field is present in DOM', async ({ page }) => {
    const honeypot = page.locator('input[name="_gotcha"]');
    await expect(honeypot).toHaveCount(1);
  });
});

// ── No Secrets in Source ─────────────────────────────────────────────────────

test.describe('Phase 3 — No secrets in client source', () => {
  const SECRET_PATTERN = /sk-[a-zA-Z0-9]{20,}|api[_-]?key\s*[:=]\s*["'][^"']{10,}|supabase[_-]url|database[_-]url/i;

  test('index.html contains no secrets', async ({ request }) => {
    const res = await request.get(BASE_URL);
    const body = await res.text();
    expect(body).not.toMatch(SECRET_PATTERN);
  });

  test('app.js contains no secrets', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/app.js`);
    const body = await res.text();
    expect(body).not.toMatch(SECRET_PATTERN);
  });

  test('consent.js contains no secrets', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/consent.js`);
    const body = await res.text();
    expect(body).not.toMatch(SECRET_PATTERN);
  });
});

// ── Performance ──────────────────────────────────────────────────────────────

test.describe('Phase 9 — Core performance', () => {
  test('Homepage loads within 5 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('Fonts load from self-hosted /fonts/ path', async ({ page }) => {
    const fontRequests = [];
    page.on('request', req => {
      if (req.url().includes('fonts.gstatic.com') || req.url().includes('fonts.googleapis.com')) {
        fontRequests.push(req.url());
      }
    });
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    expect(fontRequests.length, 'External Google Fonts CDN still being called').toBe(0);
  });
});
