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

From Windows, the mirror step is:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\shyam\.openclaw\mirror-to-github.ps1"
```

It clones fresh to a temp dir, copies `ssundar-src` over it, refuses to commit
`.env` or `.deploy-config`, then pushes. Run it after every deploy.

The local clone at `F:\Website build Claude\Ssundar Build\Build April 2026` lost
its `.git` directory on 2026-09-12, so it is a plain folder now and cannot push.
The mirror script does not depend on it (it only reads `.deploy-config` for the
token), so that folder is no longer load-bearing.

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

From Windows, use `C:\Users\shyam\.openclaw\deploy-ssundar-live.ps1`. It zips
`ssundar-src`, runs a file-count safety check, POSTs to the Netlify API and
polls to `ready`. This is the working local path and the one to use when the
Cowork workspace shell is unavailable.

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\shyam\.openclaw\deploy-ssundar-live.ps1"
```

`scripts\netlify-deploy.ps1` is **disabled** (`netlify-deploy.ps1.disabled.ps1`)
and must stay disabled. It deployed a stale tree and caused the divergence above.
Do not create additional deploy scripts. Two deploy paths is what broke this
site twice; keep it to one.

**API zip deploys do NOT build Netlify Functions** (verified 2026-11-02: every
zip deploy shows "No functions deployed" and `/simulate` dies until the next
GitHub-triggered build restores them). So the zip path is only acceptable if
the GitHub mirror push follows immediately — the push triggers the build that
ships `netlify/functions/`. Preferred: push to GitHub and let Netlify build;
skip the zip entirely.

**A deploy replaces the entire site.** Always deploy the complete folder, never
a subset. Before deploying, sanity-check the file count — a bundle materially
smaller than ~100 HTML files means something is missing; abort.

Credentials live in `.env` / `.deploy-config`, both gitignored. Never commit them.

**Internal files must never ship.** This file, `AGENTS.md`, `CHANGELOG.md` and
`SEND_QUEUE.md` live in `ssundar-src` because agents read them — but the deploy
zips the whole folder, and for a period they were publicly readable at
`https://ssundar.com/CLAUDE.md` and friends. That exposed the Netlify site id,
the claims register (including retired client names), and outreach contact
details. `deploy-ssundar-live.ps1` now excludes `.md`, `.ps1`, `.bat`, `.env*`,
`.deploy-config`, `.pem` and `.key`, aborts if any survive the filter, and
asserts those URLs return 404 after every deploy. Do not weaken those checks.
If you add an internal note to this folder, give it one of those extensions.
**2026-10-23 recurrence:** the blog publisher's own deploy re-exposed these files
because its zip had no exclusions. Its scheduled prompt now excludes them and
asserts 404 after every deploy, and `_redirects` force-404s `/*.md`, `/*.ps1`,
`/.env` and `/.deploy-config` so even a leaking bundle cannot serve them.


---

## Architecture

Hand-authored static HTML5. No framework, preprocessor, or bundler. No build
step. `netlify.toml` sets publish dir to `.` and bundles `netlify/functions/`
with esbuild.

- **`app.js`** — mobile nav, IntersectionObserver reveals, `[data-count]` counters, z-depth parallax (`[data-z-speed]`), horizontal drag scroll (`.hscroll-track`), engage-form validation + bot protection (honeypot, 3s timing gate, `_humanInteracted`), GA4 events, scroll-depth milestones, tab-visibility-aware timer.
- **`styles.css`** — site-wide. `.hero` sets its own dark background and forces white on all descendant text; do not reintroduce a bare `.hero{color:#fff}` (white-on-white regression). `.nav-cta` is a filled red button because the nav bar is white.
- **`blog.css`** — article typography. Required by every article page.
- **`fonts.css` + `/fonts/*.woff2`** — self-hosted Chakra Petch, Inter Tight, JetBrains Mono. **Never load Google Fonts from CDN.**
- **`cookie-consent.js`** — the ONLY analytics loader (`localStorage` key `exlprs_cookie_consent`). Every page includes `<script src="/cookie-consent.js"></script>` before `</body>`; it injects GA4 + Clarity only after consent. Never add an inline `gtag/js` or Clarity snippet to a page, and never reference the legacy `consent.js` (different key → second banner, GA never loads). Normalised across all 158 pages on 2026-11-02; `blog-template.html` is already clean.
- **GA4 events** live in `app.js` and resolve `window.gtag` at fire time (consent may arrive after app.js runs). Key events: `engage_submit` (form sent), `engage_click`, `article_read`. Mark new ones in GA4 Admin → Events → star.
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


## Front door (BINDING from 2026-11-06)

The offer is **Capability Forward**; the entry point is the **March Bench Diagnosis**; the hero headline is
"Capability is the margin you lose before anyone forecasts it." with "Know in January whether your March
bench will hold." as line two (decided 2026-11-06). No third name. The homepage is a STATIC, dense page (decided 2026-11-07: no scroll-snapping, no moving
button, no stepper, no toggles, no fade-ins): hero (ask + two buttons + four offer facts) → leak → forecast table →
scorecard model → gates table → all six proof figures with mechanisms → who/after;
`bench-sim.js` is a plain facts-and-figures model (decided 2026-11-07: NO animation, NO 3D, no bar charts): per
geography a scorecard — delivery-ready today, needed in March, week-13 forecast, a 13-week red/green strip, reasons
ranked by seats each leak costs, the first action and its effect. Up to five geographies (India, Philippines, China,
MENA, South Africa, Europe, North America, Latin America, ANZ) with editable, ILLUSTRATIVE starting points (never
presented as benchmarks), incl. delivery-ready today, tenured attrition, speed to proficiency after graduation and
no-show rate. `/vendor/three.min.js` is unreferenced and can be deleted. Buyer's sentence
first, ours second. Never "AI-era", never a tagline above the headline, never an eleven-tile menu.

- **No prices on the open site.** Engage asks where delivery and budget sit; the success screen and the
  Resend email (`send-thankyou.js`, `kind:"diagnosis"`) route to ONE unlisted page:
  India `/march-bench-diagnosis-in-6r9qc8fy9qv0` (₹5,38,400) or rest of world `/march-bench-diagnosis-gl-yzwfy653kcly` (US$24,650).
  Both are `noindex` (meta + `X-Robots-Tag` in `_headers`), absent from the sitemap, and must never be
  linked from any public page. `/capability-forward` is the public one-pager, without a fee.
- **Treeng appears once** (homepage forecast panel) as what runs on the client's data during the
  diagnostic. No orb, no nav item, no product CTA. Treeng is 16 modules.
- Nav (updated 2026-11-20 by Shyam's instruction): Writing · Evidence · Programs ▾ (dropdown) · Intelligence · Simulate · About; CTA `/engage` "Start the March Bench Diagnosis".
  `app.js` no longer injects anything Treeng-related.
- Contracting entity is SSUNDAR. EXLPRS is not named as the contracting party anywhere.
- Cleared figures only: 77→93% (90 days, headcount up 70%); 30 working days→4, errors down over 90%;
  ~30% fewer new-hire attritions and underperformers; 70→89% CSAT; 79→89% (second cohort 88→98%);
  5.00 facilitator / 100% would recommend. HOLD (never publish): 22–25%, 30–40%, ~90%, 44 trainers.
  NEVER: $2.1M, 35%, 97.2%, 82.6→96, "10 to 15% of revenue", client names, city names, "four continents".
  Geography is "Asia, North America and Europe".
- GA4 key events: `bench_red_week`, `question_answered`, `engage_submit` (carries region, budget owner,
  seats band, account_named — no PII).
- Second pass only after five buyer conversations: the "survives Monday" proof page (every line approved
  by Shyam) and the "after the diagnostic" restructure of the old menu pages.

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
- **Punch-first line 1 (added 2026-08-19):** Every post on every surface (profile, SSUNDAR. page, EXLPRS page, newsletter) opens its FIRST line with the punchy title or a standalone punch line, alone as its own paragraph. LinkedIn hides the headline and shows only the first ~2 lines, so line 1 must land the hook before the fold. No scene-setting, context, or warm-up before the punch. Line 1 does not punch → regenerate.
- **Five pillars, weighted:** Decision Autopsy 35% · Contrarian Diagnosis 25% · Architecture Teardown 20% · Judgment-Under-AI 15% · Operator's Receipt 5%. Every pillar ladders to judgment under pressure.
- **EXLPRS is sunsetting.** SSUNDAR is the only external face. Practitioner content is a sub-tier under SSUNDAR, never an EXLPRS-branded external track.
- **Distribution:** Hour 0 profile-only → seed 3–5 first-hour comments → Hour 24 one most-relevant group → Hour 48 extend only if it performed. Never simultaneous multi-group posting. Cadence 5/week, Tue/Wed/Thu, 8–9 AM IST.
- **Comment-as-qualifier:** end Decision Autopsy and Contrarian Diagnosis posts with a diagnostic question only a real operator can answer.
- **Track:** engagement rate (>1.5%), first-hour comment velocity (4+/60min), impressions-per-follower (205:1 → 100:1), profile→DM→call. **Ignore total impressions.**
- **Voice:** authority not aspiration; disagree with consensus; concise and exacting; stark black-and-red. Never soft or corporate-bland.

Source of truth: 365 days of verified LinkedIn analytics (25 Jun 2025 – 24 Jun
2026): 279,739 impressions → 1,362 followers (205:1), 0.62% avg engagement,
five days = 41% of annual reach. The gap is conversion and consistency, not reach.


## 2026-11-14 additions
- `/simulate` is in the nav on every page. Simulator funnel events (`sim_view`, `sim_launch`, `sim_begin`, `sim_round`, `sim_complete`, `sim_report`, `sim_to_engage`) live in simulate.html; the PDF is emailed as an attachment by `send-thankyou`, which accepts `RESEND_API_KEY` or `RESEND_API_KEY_SSUNDAR`. EXLPRS branding is retired from emails and AI prompts.
- SEO hub: `/leadership-skills-training` (targets leadership skills / leadership skills training). Do not mention client or employer names; sector descriptors only (E-commerce GCC etc.).
- Search Console (22 Oct-10 Nov 2026): 94 impressions, 2 clicks, 8 queries, all brand or misspelled brand; no generic leadership queries yet.

## 2026-11-20 port from the prototype review
- Homepage hero has a proof bar (cleared figures only). Simulator can copy a scenario link (`/?s=<geo:values;...>&geo=..#sim`, all inputs in the URL, no personal data) and a plain-text COO brief stamped ILLUSTRATIVE; GA events `sim_share_link`, `sim_share_brief`.
- `/about` is now a plain executive bio (sector-level record, no employer names, no tenure number until Shyam confirms 24 vs 25). The interactive career map lives at `/about-map` (noindex). 
- `/capability-forward` has a "How your data is handled" section (#data): only statements that are true today; claim no certifications.
- NOT ported, deliberately: employer names with metrics, Google Fonts CDN, "built to pass InfoSec in week zero", Treeng/Work Intelligence as a licensed product (waits for five buyer conversations).

## 2026-11-20 decisions (Shyam delegated 2 and 4; decided 1 and 3)
- Tenure is "24+ years" everywhere. Never "twenty-five".
- /evidence scale figures (<5% calibration variance, 27 lines of business, 150+ trainers, 250+ QAs) approved by Shyam to stay. "44 trainers/facilitators" remains HOLD and was removed.
- Hero line stays "Know in January whether your March bench will hold." It is correct for the current selling season and the offer is named for March. REVISIT BY 15 JAN 2027: from February the line and the offer name ("March Bench Diagnosis") must move together to the next season (e.g. June/September) on every page; a rolling hero alone would contradict the fixed offer name in the nav CTA.
- Career map retired from the site: /about-map and /about-classic 301 to /about (files kept, not linked). Reason: it paired employer names with job titles, process names and unregistered numbers, which the NDA/claims rules forbid. External career-map links replaced with /about. Employer history lives on LinkedIn.

## 2026-11-20 EXLPRS programs moved in (Shyam: "move exlprs build into this as exlprs is being sunset")
- `/programs` carries the 14 EXLPRS programs in three groups (operations/quality/ramp, leadership, the learning function): problem, what we build, what changes, how it is measured, and only CLEARED figures as "on record". EXLPRS outcome claims were stripped (35%, 40%, 30-40%, -40-50%, 2x, +15-20%, 3 continents, 25+ years, Fortune 500, city names, "even in Amazon" quote).
- Program enquiry form on /programs posts to Formspree xykdyqyj; GA events `program_enquiry`, `program_ask_click`. Lower-friction lead path than /engage.
- Nav "Work" became "Programs" with a dropdown on every page (desktop hover/focus; mobile overlay links to /programs). /work is no longer in the nav.
- /academy, /consulting, /play-labs, /workshops, /services 301 to the matching /programs anchors. /platform (Treeng) untouched and noindexed.
- Not yet ported from EXLPRS: 6 whitepapers, 6 industry pages, 11 SEO landing pages, insights. exlprs.com is a separate Netlify site; its 301 map to ssundar.com is still to do.

## 2026-11-20 "The leak upstairs" (Shyam asked for it prominently)
- Homepage now has a full-width black band `#upstairs` between 01 The leak and 02 The forecast: "You promoted your best performer. You lost them that day." / "And you gained a manager nobody taught to lead." / body / verdict "Test readiness before the promotion. Not after the team has paid for it." Links to /programs#leadership-readiness and /simulate. Same line opens the Leadership group on /programs and /leadership-skills-training. Never attribute or quote the Peter Principle; it is stated as SSUNDAR's own verdict, aimed at the system, not the person.

## 2026-11-23 Whitepapers ported from EXLPRS
- `/whitepapers` hub + six pages at `/whitepaper-<slug>` (same slugs as exlprs.com, so the exlprs redirect map is 1:1): competency-pipeline, curriculum-trap, framework-shift, judgment-gap, learning-curve-collapse, ramp-paradox.
- Scrubbed before publishing: every unregistered figure (62->94%, 10X, 400%, 30 to 1,500+, 712 sessions, 40%, 30-40%, $1.16M retired), all results tables, client-identifying detail (GIS + city + start date; named ad products; a client's proprietary framework name; month/year dates), and a job-title quote attribution. Build scripts and rewrite rules: build/wp in the Cowork session (not in src).
- Linked from the Programs dropdown, homepage section 08 and /programs. Each paper ends with the program it supports.

## 2026-11-23 Booking, WhatsApp, whitepapers placement
- Calendly: https://calendly.com/shyam-ssundar/30min (UTM utm_source=ssundar&utm_medium=site&utm_content=<place>). Linked in the homepage hero (under the two buttons), every footer, the /engage success screen and /programs enquiry. GA event `calendly_click` (app.js).
- WhatsApp click-to-chat button on every page via app.js (bottom-left, wa.me/919663974926, prefilled with the page path). GA event `whatsapp_click`.
- Whitepapers live under Evidence: a "The long version" section on /evidence links all six; removed from the Programs dropdown. Hub /whitepapers and homepage section-08 row remain.

## 2026-11-23 exlprs.com sunset, cost layer, calculator, gates diagram
- exlprs.com: NO redirects to ssundar.com, ever (Shyam, 2026-11-23: tax and legal reasons; he is removing exlprs from Search Console). A redirect commit to smvshyam/exlprs-site was made and reverted the same day; that repo is back to its prior state. Do not link exlprs.com from ssundar.com either.
- bench-sim.js: optional "cost of the gap" (currency + fully loaded monthly cost per seat). Cost = seat-weeks below need x monthly cost x 12/52; also shows what the first action recovers; in summary, COO brief and share link (&c=&cur=). GA `sim_cost_entered`. User-supplied, never stored, no default figure.
- /bench-calculator: standalone calculator page (WebApplication schema, sitemap), linked from homepage section 03.
- Homepage section 04 has a static SVG week 0-16 gates diagram above the table (hidden under 700px; the table carries it on phones).
