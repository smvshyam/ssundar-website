# CLAUDE.md

Guidance for any agent working on ssundar.com.

---

## ⚠️ READ THIS FIRST — single source of truth

**`C:\Users\shyam\.openclaw\ssundar-src` is the ONLY source for ssundar.com.**

Until 2026-08-17 there were two divergent copies of this site and two deploy
paths pointed at the same Netlify site. Whichever deployed last replaced the
entire site, so work done in one copy silently destroyed work done in the
other. Symptoms seen in the wild: pages returning 404 that existed in the repo,
retired claims reappearing, the Netlify Functions vanishing from production.

The two trees were reconciled on 2026-08-17. They are now identical. **Keep
them identical.**

| Path | Role |
|---|---|
| `C:\Users\shyam\.openclaw\ssundar-src` | Canonical working copy. Edit here. |
| `smvshyam/ssundar-website` (GitHub) | Mirror + version history. Netlify auto-deploys from it. |
| `F:\Website build Claude\Ssundar Build\Build April 2026` | Local clone of the GitHub repo. |

**Rule: never deploy from a folder without first syncing the other.** If you
change `ssundar-src`, push the same change to GitHub in the same session. If
you push to GitHub, mirror it back into `ssundar-src`.

Retired: `smvshyam/ssundar.com-website`.
Never touch: `smvshyam/ssundar-platform` (app.ssundar.com, separate Vercel app).

### Deploy

Preferred — push to GitHub; Netlify auto-deploys:

```bash
git add -A && git commit -m "…" && git push origin main
```

Direct Netlify API deploy (what scheduled agents use — they run in a Linux
sandbox where PowerShell is unavailable):

```
POST https://api.netlify.com/api/v1/sites/$NETLIFY_SITE_ID/deploys
Zip the whole ssundar-src folder. Credentials: C:\Users\shyam\.openclaw\.env
Site ID: a5ecad5f-6c16-446a-aaba-2e2188c8c741
```

`scripts\netlify-deploy.ps1` is **disabled** (`netlify-deploy.ps1.disabled.ps1`)
and must stay disabled. It deployed a stale tree and caused the divergence above.

**A deploy replaces the entire site.** Always deploy the complete folder, never
a subset. Before deploying, sanity-check the file count — a bundle materially
smaller than ~100 HTML files means something is missing; abort.

Credentials live in `.env` / `.deploy-config`, both gitignored. Never commit them.

---

## Architecture

Hand-authored static HTML5. No framework, preprocessor, or bundler. No build
step. `netlify.toml` sets publish dir to `.` and bundles `netlify/functions/`
with esbuild.

- **`app.js`** — mobile nav, IntersectionObserver reveals, `[data-count]` counters, z-depth parallax (`[data-z-speed]`), horizontal drag scroll (`.hscroll-track`), engage-form validation + bot protection (honeypot, 3s timing gate, `_humanInteracted`), GA4 events, scroll-depth milestones, tab-visibility-aware timer.
- **`styles.css`** — site-wide. `.hero` sets its own dark background and forces white on all descendant text; do not reintroduce a bare `.hero{color:#fff}` (white-on-white regression). `.nav-cta` is a filled red button because the nav bar is white.
- **`blog.css`** — article typography. Required by every article page.
- **`fonts.css` + `/fonts/*.woff2`** — self-hosted Chakra Petch, Inter Tight, JetBrains Mono. **Never load Google Fonts from CDN.**
- **`cookie-consent.js`** — current consent (`localStorage` key `exlprs_cookie_consent`). Analytics never load before consent. `consent.js` is the legacy version.
- **`netlify/functions/`** — `analyze.js` (simulation: scenario generation, round scoring, report; Upstash Redis rate limit 10/60s per IP, in-memory fallback) and `send-thankyou.js` (Resend email). **These must ship with every deploy** — a deploy without this folder removes them from production and silently kills `/simulate`.

Env vars are set in the Netlify dashboard only: `ANTHROPIC_API_KEY`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RESEND_API_KEY_SSUNDAR`,
`HCAPTCHA_SECRET`.

### Security

CSP and headers via `_headers` (mirrored in `netlify.toml`). `ALLOWED_ORIGINS`
in both functions restricts CORS to ssundar.com and exlprs.com.
`tests/destruction_audit.spec.js` covers string flooding, SQL/XSS/path-traversal
injection, rate-limit surface, header presence, and analytics-before-consent.

```bash
npx playwright test tests/destruction_audit.spec.js --reporter=list
```

---

## Blog publishing

- **Template:** copy `blog-template.html`. It carries the canonical nav, footer, and self-hosted font links. Never hand-roll an article shell.
- **Register the post in `posts.json`** using `category` and `readTime`. `/insights` renders cards from this file; a post using `channel` instead of `category` renders as `UNDEFINED` on the live page.
- **Update `sitemap.xml`.**
- **Nav and footer are site-wide.** If you change either, change it on every page — 100+ files. Grep for the value, not the wrapper class; the same claim often appears in several different markup shapes.

---

## Claims discipline (BINDING)

`claims-register.md` governs both ssundar.com and exlprs.com. **No figure,
credential, client name, or award ships unless it is in the register.**

Retired and must never reappear: `$180M`, `$112M`, `$2.34M`, `$1.16M`,
`70%→95% CSAT`, `300% quality improvement`, `95.14%`, "Fortune 500 scale",
"Three continents"/"50+ countries", Nike, GE, GE Capital, Genpact, Six Sigma.

Confidentiality: never attach data, metrics, parameters, or process names to a
named client. NDAs are signed across all orgs — no job titles, no names.
Sector-only attribution.

## Content discipline (BINDING — every model, every agent)

LinkedIn posts, newsletters, and thought-leadership content follow
`shyam-ssundar-skills` → SKILL 0.

- **Goal is the ₹10 Cr pipeline, not follower count.** Reverse-engineer every post from the qualified DM. Reject broad low-intent reach. Honest target: ~8–10K high-intent followers + 15–20 qualified DMs/month.
- **Ignition formula on every profile post:** named entity + hard number + structural verdict + portable line. All four, or regenerate.
- **Five pillars, weighted:** Decision Autopsy 35% · Contrarian Diagnosis 25% · Architecture Teardown 20% · Judgment-Under-AI 15% · Operator's Receipt 5%. Every pillar ladders to judgment under pressure.
- **EXLPRS is sunsetting.** SSUNDAR is the only external face. Practitioner content is a sub-tier under SSUNDAR, never an EXLPRS-branded external track.
- **Distribution:** Hour 0 profile-only → seed 3–5 first-hour comments → Hour 24 one most-relevant group → Hour 48 extend only if it performed. Never simultaneous multi-group posting. Cadence 5/week, Tue/Wed/Thu, 8–9 AM IST.
- **Comment-as-qualifier:** end Decision Autopsy and Contrarian Diagnosis posts with a diagnostic question only a real operator can answer.
- **Track:** engagement rate (>1.5%), first-hour comment velocity (4+/60min), impressions-per-follower (205:1 → 100:1), profile→DM→call. **Ignore total impressions.**
- **Voice:** authority not aspiration; disagree with consensus; concise and exacting; stark black-and-red. Never soft or corporate-bland.

Source of truth: 365 days of verified LinkedIn analytics (25 Jun 2025 – 24 Jun
2026): 279,739 impressions → 1,362 followers (205:1), 0.62% avg engagement,
five days = 41% of annual reach. The gap is conversion and consistency, not reach.
