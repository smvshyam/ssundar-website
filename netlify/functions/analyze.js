// SSUNDAR. / EXLPRS — Netlify Function: analyze
// Handles 3 request types from simulate.html:
//   1. generate_scenarios — returns 5 industry-specific leadership scenarios
//   2. round_analysis     — scores a custom free-text decision and returns impacts
//   3. generate_report    — generates full leadership pattern analysis post-simulation
//
// Security hardening (May 2026):
//   - Persistent IP rate limiting via Upstash Redis REST (survives cold-starts)
//   - In-memory fallback if Upstash env vars not set
//   - Payload size cap (10 KB hard limit)
//   - Input validation + length caps on all user-supplied strings
//   - AbortController timeout (9s) on every Anthropic call
//   - Graceful fallback if Anthropic is unavailable
//   - PII-stripped error logging
//   - Stack traces never leak to client
//
// Env vars required:
//   ANTHROPIC_API_KEY
//   UPSTASH_REDIS_REST_URL   (optional — falls back to in-memory if absent)
//   UPSTASH_REDIS_REST_TOKEN (optional — falls back to in-memory if absent)

'use strict';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ALLOWED_ORIGINS   = ['https://exlprs.com', 'https://www.exlprs.com', 'https://ssundar.com', 'https://www.ssundar.com'];

// ── Constants ────────────────────────────────────────────────────────────────
const MAX_BODY_BYTES    = 10 * 1024;   // 10 KB hard payload cap
const RATE_LIMIT_MAX    = 10;          // max requests per window per IP
const RATE_LIMIT_WINDOW_S = 60;        // 60-second sliding window (Redis TTL)
const RATE_LIMIT_WINDOW = 60 * 1000;   // same in ms (for in-memory fallback)
const CLAUDE_TIMEOUT_MS = 9000;        // abort Anthropic call after 9s
const UPSTASH_TIMEOUT_MS = 2000;       // abort Redis call after 2s
const FREE_TEXT_MAX     = 2000;        // max chars for user free-text
const STRING_FIELD_MAX  = 200;         // max chars for industry / scale / title fields
const VALID_TYPES       = new Set(['generate_scenarios', 'round_analysis', 'generate_report']);

// ── In-memory fallback rate limiter ──────────────────────────────────────────
// Used when Upstash env vars are not configured. Resets on cold-start.
const rateLimitStore = new Map();

function isRateLimitedMemory(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

// ── Upstash Redis persistent rate limiter ─────────────────────────────────────
// Uses Redis INCR + EXPIRE via the Upstash REST API (no npm dependency).
// Pattern: INCR key → if count===1 set EXPIRE 60s → if count > limit → blocked.
// Atomic window: the 60s TTL is set only on the first hit, so the window is
// fixed from first request rather than sliding — intentional, simple, correct.
async function isRateLimitedRedis(ip) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return isRateLimitedMemory(ip);

  const key = `ssundar:analyze:${ip}`;

  try {
    // Step 1: INCR — atomic counter increment
    const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json'
      },
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS)
    });

    if (!incrRes.ok) throw new Error(`Upstash INCR ${incrRes.status}`);
    const { result: count } = await incrRes.json();

    // Step 2: On first hit, set TTL (fire-and-forget — don't block the request)
    if (count === 1) {
      fetch(`${url}/expire/${encodeURIComponent(key)}/${RATE_LIMIT_WINDOW_S}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS)
      }).catch(() => {}); // non-critical — worst case window never expires
    }

    return count > RATE_LIMIT_MAX;

  } catch (e) {
    // Redis unavailable — degrade gracefully to in-memory limiter
    console.error('Upstash rate limit error, falling back to memory:', e.message?.substring(0, 80));
    return isRateLimitedMemory(ip);
  }
}

// Public alias used by handler
const isRateLimited = isRateLimitedRedis;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCorsHeaders(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':      allowedOrigin,
    'Access-Control-Allow-Headers':     'Content-Type',
    'Access-Control-Allow-Methods':     'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type':                     'application/json'
  };
}

function getClientIp(event) {
  const h = event.headers || {};
  return h['x-forwarded-for']?.split(',')[0].trim()
      || h['x-nf-client-connection-ip']
      || h['client-ip']
      || 'unknown';
}

// Strip emails and phone-like patterns before logging
function sanitizeForLog(msg) {
  if (typeof msg !== 'string') return String(msg);
  return msg
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[email]')
    .replace(/\b\d{10,}\b/g, '[phone]')
    .substring(0, 300);
}

// Clamp and sanitize a string field
function safeStr(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').substring(0, maxLen).trim();
}

function err(statusCode, message, HEADERS) {
  return { statusCode, headers: HEADERS, body: JSON.stringify({ error: message }) };
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const HEADERS = getCorsHeaders(event);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST')    return err(405, 'Method not allowed', HEADERS);

  // ── 1. Payload size guard ─────────────────────────────────────────────────
  const bodyStr = event.body || '';
  if (Buffer.byteLength(bodyStr, 'utf8') > MAX_BODY_BYTES) {
    return err(413, 'Request payload too large', HEADERS);
  }

  // ── 2. Rate limiting ──────────────────────────────────────────────────────
  const clientIp = getClientIp(event);
  if (isRateLimited(clientIp)) {
    return err(429, 'Too many requests. Please wait a moment before trying again.', HEADERS);
  }

  // ── 3. API key check ──────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return err(500, 'Service configuration error', HEADERS);

  // ── 4. Parse and validate body ────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(bodyStr);
  } catch {
    return err(400, 'Invalid request format', HEADERS);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return err(400, 'Invalid request format', HEADERS);
  }

  const { type } = body;
  if (!VALID_TYPES.has(type)) {
    return err(400, 'Invalid request type', HEADERS);
  }

  // ── 5. Dispatch ───────────────────────────────────────────────────────────
  try {
    if (type === 'generate_scenarios') return await handleGenerateScenarios(body, apiKey, HEADERS);
    if (type === 'round_analysis')     return await handleRoundAnalysis(body, apiKey, HEADERS);
    if (type === 'generate_report')    return await handleGenerateReport(body, apiKey, HEADERS);
  } catch (e) {
    // Never leak stack traces or raw messages to client
    console.error('analyze error:', sanitizeForLog(e.message));
    if (e.message && e.message.includes('UNAVAILABLE')) {
      return err(503, 'The analysis service is temporarily unavailable. Please try again in a moment.', HEADERS);
    }
    return err(500, 'Analysis could not be completed. Please try again.', HEADERS);
  }
};

// ─── TYPE 1: Generate 5 industry-specific scenarios ──────────────────────────
async function handleGenerateScenarios({ industry, scale }, apiKey, HEADERS) {
  // Validate + sanitize inputs
  const safeIndustry = safeStr(industry, STRING_FIELD_MAX);
  const safeScale    = safeStr(scale, STRING_FIELD_MAX);
  if (!safeIndustry || !safeScale) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Industry and scale are required' }) };
  }

  const prompt = `You are generating leadership simulation scenarios for an executive development platform called EXLPRS.

Industry: ${safeIndustry}
Organization scale: ${safeScale}

Generate exactly 5 realistic, high-stakes leadership scenarios that a senior leader in ${safeIndustry} would face. Each scenario must feel specific to this industry — use real terminology, real pressures, real consequences.

Respond ONLY with valid JSON in this exact structure:
{
  "scenarios": [
    {
      "title": "SHORT DRAMATIC TITLE IN CAPS",
      "desc": "2-3 sentence scenario description with specific stakes and timeline",
      "options": [
        {
          "name": "OPTION NAME IN CAPS",
          "desc": "1-2 sentences describing this choice",
          "costs": { "budget": -10, "board": -5, "time": -10, "bench": -5 },
          "impacts": { "continuity": 5, "readiness": 3, "velocity": -2, "architecture": 4, "coherence": 2 },
          "altitude": 1500,
          "consequence": "2-3 sentences describing what actually happens after this choice, with specific organizational consequences",
          "pattern": "operator"
        },
        {
          "name": "OPTION NAME IN CAPS",
          "desc": "1-2 sentences describing this choice",
          "costs": { "budget": -15, "board": -10, "time": -5, "bench": -10 },
          "impacts": { "continuity": 2, "readiness": 8, "velocity": -5, "architecture": 7, "coherence": -2 },
          "altitude": 2000,
          "consequence": "2-3 sentences describing what actually happens after this choice",
          "pattern": "systems_thinker"
        },
        {
          "name": "OPTION NAME IN CAPS",
          "desc": "1-2 sentences describing this choice",
          "costs": { "budget": -5, "board": -15, "time": -15, "bench": -20 },
          "impacts": { "continuity": -3, "readiness": 5, "velocity": 8, "architecture": -2, "coherence": 4 },
          "altitude": 1000,
          "consequence": "2-3 sentences describing what actually happens after this choice",
          "pattern": "risk_taker"
        }
      ]
    }
  ]
}

Rules:
- All 5 scenarios must be distinct (succession, crisis, transformation, resource, culture)
- pattern values must be one of: operator, systems_thinker, pragmatist, risk_taker, consensus_builder, analyst, innovator, conservative
- costs values: integers between -30 and 0 (negative = resource cost)
- impacts values: integers between -10 and 10
- altitude values: integers between 500 and 3000 (altitude gained/lost by this choice)
- Return ONLY the JSON object, no markdown, no explanation`;

  const data   = await callClaude(prompt, apiKey, 2000);
  const parsed = JSON.parse(data);
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(parsed) };
}

// ─── TYPE 2: Analyse a free-text custom decision ──────────────────────────────
async function handleRoundAnalysis({
  scenario_title, scenario_desc, free_text, industry, round, current_altitude, current_metrics
}, apiKey, HEADERS) {
  // Validate + sanitize all user-supplied inputs
  const safeTitle    = safeStr(scenario_title, STRING_FIELD_MAX);
  const safeDesc     = safeStr(scenario_desc,  1000);
  const safeText     = safeStr(free_text,       FREE_TEXT_MAX);
  const safeIndustry = safeStr(industry,        STRING_FIELD_MAX);
  const safeRound    = Number.isInteger(round) && round >= 1 && round <= 10 ? round : 1;
  const safeAlt      = typeof current_altitude === 'number' ? Math.max(0, Math.min(35000, current_altitude)) : 15000;
  const safeMetrics  = (typeof current_metrics === 'object' && current_metrics !== null)
    ? current_metrics : {};

  if (!safeText) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Decision text is required' }) };
  }

  const prompt = `You are an executive performance analyst for EXLPRS, an elite leadership development firm.

SIMULATION CONTEXT:
- Industry: ${safeIndustry}
- Round: ${safeRound} of 5
- Current organizational altitude: ${safeAlt} ft (max 35000, represents org health)
- Current metrics: ${JSON.stringify(safeMetrics)}

SCENARIO: ${safeTitle}
${safeDesc}

LEADER'S CUSTOM DECISION:
"${safeText}"

Evaluate this decision as a real leadership consultant would. Consider: quality of thinking, systemic awareness, risk calibration, stakeholder management, and ${safeIndustry}-specific context.

Respond ONLY with valid JSON:
{
  "altitude_change": 1500,
  "metric_impacts": { "continuity": 3, "readiness": 4, "velocity": 2, "architecture": 3, "coherence": 2 },
  "resource_costs": { "budget": -8, "board_confidence": -5, "time": -10, "strategic_bench": -5 },
  "consequence": "2-3 sentences describing the specific organizational consequence of this decision. Be concrete and realistic.",
  "pattern_tag": "systems_thinker",
  "insight": "1 sentence of sharp professional insight about this leader's decision-making pattern"
}

Rules:
- altitude_change: integer between -5000 and +4000 (negative if decision is poor)
- metric_impacts values: integers between -8 and 8
- resource_costs values: integers between -20 and 0
- pattern_tag must be one of: operator, systems_thinker, pragmatist, risk_taker, consensus_builder, analyst, innovator, conservative
- Be honest — reward good thinking, penalize shallow or reactive decisions
- Return ONLY JSON, no markdown`;

  const data   = await callClaude(prompt, apiKey, 600);
  const parsed = JSON.parse(data);
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(parsed) };
}

// ─── TYPE 3: Generate final leadership pattern report ─────────────────────────
async function handleGenerateReport({
  decisions, industry, scale, final_altitude, final_metrics, final_zone
}, apiKey, HEADERS) {
  const safeIndustry = safeStr(industry, STRING_FIELD_MAX);
  const safeScale    = safeStr(scale, STRING_FIELD_MAX);
  const safeZone     = safeStr(final_zone, 100);
  const safeAlt      = typeof final_altitude === 'number' ? Math.max(0, Math.min(35000, final_altitude)) : 15000;
  const safeMetrics  = (typeof final_metrics === 'object' && final_metrics !== null) ? final_metrics : {};

  // Sanitize decisions array — cap at 10 entries, sanitize each string field
  const safeDecisions = Array.isArray(decisions)
    ? decisions.slice(0, 10).map(d => ({
        round:          Number.isInteger(d.round) ? d.round : 0,
        scenario:       safeStr(d.scenario,    200),
        choice_name:    safeStr(d.choice_name, 200),
        pattern:        safeStr(d.pattern,      50),
        altitude_change: typeof d.altitude_change === 'number' ? d.altitude_change : 0
      }))
    : [];

  const decisionSummary = safeDecisions.map(d =>
    `Round ${d.round}: "${d.scenario}" → ${d.choice_name} (pattern: ${d.pattern}, altitude change: ${d.altitude_change > 0 ? '+' : ''}${d.altitude_change})`
  ).join('\n');

  const prompt = `You are SSUNDAR.'s principal analyst generating a post-simulation leadership assessment.

SIMULATION RESULTS:
- Industry: ${safeIndustry}
- Organization scale: ${safeScale}
- Final altitude: ${safeAlt} ft of 35000 (performance ceiling)
- Final zone: ${safeZone}
- Final metrics: ${JSON.stringify(safeMetrics)}

DECISIONS MADE:
${decisionSummary}

Generate a sharp, honest, specific leadership pattern analysis. This is delivered to senior executives — it must read like real consultant insight, not generic praise.

Respond ONLY with valid JSON:
{
  "pattern_name": "The [Archetype Name] — 4-6 words",
  "pattern_description": "One sentence defining this leadership archetype",
  "sector_context": "One sentence on how this pattern typically plays out in ${safeIndustry}",
  "executive_summary": "3-4 paragraphs of honest leadership analysis. Paragraph 1: what the pattern reveals. Paragraph 2: where it created value in this simulation. Paragraph 3: where it created risk or left value on the table. Paragraph 4: what this means for organizational impact. Separate with double newline.",
  "strongest_dimension": "1-2 sentences on the metric where this leader showed most consistency",
  "critical_gap": "1-2 sentences on the metric or pattern that represents the most significant blind spot",
  "pattern_protected": "1-2 sentences on what this leadership style reliably protects even under pressure",
  "ssundar_recommendation": "2-3 sentences on the specific SSUNDAR. intervention that would address the critical gap — be specific about the methodology (simulation, judgment architecture, capability design)",
  "industry_insight": "1-2 sentences of ${safeIndustry}-specific benchmark context for this pattern"
}

Rules:
- Be specific to the decisions made, not generic
- pattern_name must reflect the actual dominant pattern from the decisions
- Do NOT use filler phrases like 'your journey', 'remarkable', 'impressive'
- Return ONLY JSON, no markdown`;

  const data   = await callClaude(prompt, apiKey, 1200);
  const parsed = JSON.parse(data);
  return { statusCode: 200, headers: HEADERS, body: JSON.stringify(parsed) };
}

// ─── Anthropic API call with timeout + graceful error ─────────────────────────
async function callClaude(prompt, apiKey, maxTokens) {
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json'
      },
      body:   JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages:   [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('UNAVAILABLE: request timed out');
    throw new Error('UNAVAILABLE: network error reaching analysis service');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Log status code only — never log response body which may contain sensitive data
    console.error('Anthropic API status:', response.status);
    if (response.status === 529 || response.status === 503 || response.status === 502) {
      throw new Error('UNAVAILABLE: analysis service is temporarily down');
    }
    throw new Error('Analysis could not be completed');
  }

  const json = await response.json();
  const text = json.content[0].text.trim();

  // Strip markdown code fences if Claude wraps the JSON
  return text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
}
