# DEPLOY — READ BEFORE SHIPPING

This site has TWO deploy paths pointed at the same Netlify site.
Both work. **The last one to run wins, and it replaces the whole site.**

1. **GitHub auto-deploy** — push to `main` on `smvshyam/ssundar-website`.
   This is the source of truth for all content since Aug 2026.

2. **Netlify API deploy** — `C:\Users\shyam\.openclaw\scripts\netlify-deploy.ps1`
   zips `C:\Users\shyam\.openclaw\ssundar-src` and POSTs it.
   **That folder is STALE.** It still contains the retired terminal/NOT-FOUND
   console, `$180M -> $112M`, `7,000+` beside a named employer,
   "FORTUNE 500 SCALE", and `72 -> 91%` CSAT — every claim the
   claims register kills.

On 2026-08-10 path 2 ran and reverted the entire site, taking out
/testimonials, /work, /academy, /consulting, /workshops and /play-labs
(all 404'd) and restoring retired claims.

## Until this is resolved
Do not run netlify-deploy.ps1. Any agent that calls it must be stopped
or repointed. If the API path is needed, `ssundar-src` must first be
replaced with the contents of this repo.
