# AGENTS.md — Instructions for Any AI Working on ssundar-src

## WHO WORKS HERE
This codebase is actively maintained by two AI agents working in real-time:

### JARVIS (OpenClaw)
- **Role:** Strategy, content creation, bulk HTML updates, SEO pages, blog engine, newsletter, cron jobs, Netlify deployments
- **Owns:** Blog pipeline, posts.json, sitemap.xml, netlify.toml, scripts/, newsletter content, SEO article pages
- **Schedule:** Auto-runs Monday 6AM IST (blog publish), plus on-demand via Shyam
- **Deploy access:** Yes — uses `scripts/netlify-deploy.ps1`

### Claude (Cowork Mode — Anthropic Desktop App)
- **Role:** Platform integrations, UI/UX redesigns, creative copy, CSS architecture, new feature sections, app.ssundar.com bridge work
- **Owns:** Platform Gateway terminal section (index.html), hero audit hook (index.html), simulate.html platform interrupt, blog.css platform styles, app.ssundar.com nav links across all pages
- **Deploy access:** No — flags changes in CHANGELOG.md for JARVIS or Shyam to deploy
- **How to reach:** Shyam opens Cowork mode → new session → reads CHANGELOG.md first

### COMMUNICATION PROTOCOL (real-time)
- CHANGELOG.md is the shared message bus between agents
- Read it before ANY change. Log to it after ANY change.
- If you see another agent's entry marked "Pending deploy" — DO NOT overwrite. Note conflicts explicitly.
- Claude logs here after every session. JARVIS logs after every run.

Both agents work on behalf of **Shyam Sundar MV** (shyam@ssundar.com).

## MANDATORY PROTOCOL — READ BEFORE MODIFYING ANYTHING

### Step 1: Read CHANGELOG.md
Before making ANY changes, read `CHANGELOG.md` to understand:
- What was last changed and by whom
- What's been deployed vs. what's pending
- Any in-progress work you might conflict with

### Step 2: Check for pending changes
If CHANGELOG.md shows "pending deploy" entries, those changes exist in the files but aren't live yet. Don't overwrite them.

### Step 3: Log your changes
After completing work, add an entry to `CHANGELOG.md` with:
- Date/time IST
- Your agent name
- Files modified
- What changed and why
- Deploy status

### Step 4: Don't deploy without confirming
If another agent's changes are pending deploy, either:
- Deploy everything together, OR
- Ask Shyam which to deploy first

## SITE ARCHITECTURE RULES

### Nav structure (7 links, this order)
1. Systems.
2. Evidence.
3. Process.
4. Simulate. ← has `.nav-link-live` class (pulsing red dot)
5. Insights.
6. Platform. ← has `.nav-link-live` class, opens `app.ssundar.com` in new tab
7. Engage.

### Footer rules
- Location: **Hyderabad, India**
- Below location: **Headquartered in India — serving organizations globally**
- Footer nav must include Platform link in red (`style="color:var(--red)"`)
- Copyright: © 2026 SSUNDAR. ALL RIGHTS RESERVED.

### Brand rules
- Colors: Black (#000000) + Red (#E31E24) only. No gradients.
- Fonts: Chakra Petch (headings), JetBrains Mono (labels), Inter Tight (body)
- Red dot signature: `<span class="dot">.</span>` at end of headings
- All headings uppercase

### Tracking (must be on EVERY page)
- Google Analytics 4: `G-17GGZ3QCQF`
- Microsoft Clarity: `venlbqedo4`

### New articles
- Copy `blog-template.html` → rename to slug
- Add entry to `posts.json`
- Add URL to `sitemap.xml`
- Add redirect to `netlify.toml`

### Deploy
- Auto: `scripts/netlify-deploy.ps1` (uses Netlify API)
- Manual: Drag ssundar-src/ contents to Netlify deploy panel
- Site ID: `a5ecad5f-6c16-446a-aaba-2e2188c8c741`

## DO NOT
- Change location from Hyderabad without Shyam's approval
- Remove or revert the terminal diagnostic section in index.html (`.terminal-window`) — replaces the old module grid by design
- Remove the hero audit hook in index.html (`.hero-audit-hook`) — intentionally understated, not a bug
- Remove the simulate.html platform interrupt (`.sim-interrupt`) before the footer
- Remove the Platform nav link (position 6, opens app.ssundar.com in new tab)
- Modify `.env` credentials
- Delete any existing pages without asking
- Push changes that break the nav consistency across pages (7 links, fixed order — see nav structure above)
- Remove `blog.css` platform styles (`.terminal-window`, `.hero-audit-hook`, `.sim-interrupt`) — they're load-bearing for the new sections
