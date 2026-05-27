// SSUNDAR. / EXLPRS — Netlify Function: send-thankyou
// Sends a branded thank-you email after a user downloads their simulation PDF
// Called from simulate.html after form submission + PDF generation
//
// Env vars required: RESEND_API_KEY_SSUNDAR, HCAPTCHA_SECRET

const ALLOWED_ORIGINS = ['https://exlprs.com', 'https://www.exlprs.com', 'https://ssundar.com', 'https://www.ssundar.com'];

// Strip PII from log messages before writing to logs
function sanitizeForLog(msg) {
  if (typeof msg !== 'string') return String(msg);
  return msg
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[email]')
    .replace(/\b\d{10,}\b/g, '[phone]')
    .substring(0, 300);
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '{"error":"Method not allowed"}' };

  const apiKey = process.env.RESEND_API_KEY_SSUNDAR;
  if (!apiKey) return { statusCode: 500, headers, body: '{"error":"RESEND_API_KEY_SSUNDAR not configured"}' };

  const hcaptchaSecret = process.env.HCAPTCHA_SECRET;

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: '{"error":"Invalid JSON body"}' };
  }

  const { to_email, to_name, company, role, industry, altitude, zone, pattern_name, hcaptcha_token } = payload;
  if (!to_email) return { statusCode: 400, headers, body: '{"error":"Missing to_email"}' };

  // hCaptcha server-side verification
  if (hcaptchaSecret) {
    if (!hcaptcha_token) {
      return { statusCode: 400, headers, body: '{"error":"Missing captcha token"}' };
    }
    try {
      const verifyResp = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${hcaptchaSecret}&response=${hcaptcha_token}`
      });
      const verifyData = await verifyResp.json();
      if (!verifyData.success) {
        console.error('hCaptcha failed:', verifyData['error-codes']);
        return { statusCode: 403, headers, body: '{"error":"Captcha verification failed"}' };
      }
    } catch (err) {
      console.error('hCaptcha verify error:', sanitizeForLog(err.message));
      // Don't block email on captcha network failure — log and continue
    }
  }

  const firstName = (to_name || '').split(' ')[0] || 'there';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Shyam Sundar <shyam@ssundar.com>',
        to: [to_email],
        subject: `${firstName}, your EXLPRS simulation report is attached`,
        html: buildThankyouEmail(firstName, company, role, industry, altitude, zone, pattern_name),
        reply_to: 'shyam@exlprs.com'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend error status:', response.status);
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Email could not be sent' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: data.id }) };

  } catch (err) {
    console.error('send-thankyou error:', sanitizeForLog(err.message));
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service temporarily unavailable' }) };
  }
};

function buildThankyouEmail(firstName, company, role, industry, altitude, zone, pattern_name) {
  const altitudeDisplay = altitude ? altitude.toLocaleString() : '—';

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:20px auto;background:#111111;border-top:3px solid #E31E24;">

    <div style="padding:32px 40px 0;">
      <img src="https://exlprs.com/exlprs-logo-transparent.png" alt="EXLPRS" style="height:36px;margin-bottom:28px;">
      <p style="font-size:11px;font-family:monospace;color:#E31E24;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 12px">
        SIMULATION COMPLETE
      </p>
      <h1 style="font-size:22px;color:#ffffff;margin:0 0 6px;font-weight:700;line-height:1.3;">
        ${firstName}, your leadership architecture report is ready.
      </h1>
      <p style="font-size:13px;color:rgba(255,255,255,0.35);margin:0 0 32px;font-family:monospace;">
        ${industry || ''}${role ? ' · ' + role : ''}${company ? ' · ' + company : ''}
      </p>
    </div>

    <div style="padding:0 40px 32px;">

      <!-- Result card -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:20px 24px;margin-bottom:24px;">
        <p style="font-size:10px;font-family:monospace;color:rgba(255,255,255,0.3);letter-spacing:0.1em;margin:0 0 8px">FINAL ALTITUDE</p>
        <p style="font-size:28px;font-weight:700;color:#ffffff;margin:0 0 4px;font-family:monospace">${altitudeDisplay} ft</p>
        <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:0 0 16px">${zone || ''}</p>
        ${pattern_name ? `
        <p style="font-size:10px;font-family:monospace;color:rgba(255,255,255,0.3);letter-spacing:0.1em;margin:0 0 8px">YOUR LEADERSHIP PATTERN</p>
        <p style="font-size:15px;color:#E31E24;font-weight:600;margin:0">${pattern_name}</p>
        ` : ''}
      </div>

      <p style="font-size:15px;line-height:1.75;color:rgba(255,255,255,0.6);margin:0 0 16px;">
        Hi ${firstName},
      </p>
      <p style="font-size:15px;line-height:1.75;color:rgba(255,255,255,0.6);margin:0 0 16px;">
        Your simulation report is saved to your device. It contains the full leadership pattern analysis, your decision log, and the SSUNDAR. capability recommendation specific to your profile.
      </p>
      <p style="font-size:15px;line-height:1.75;color:rgba(255,255,255,0.6);margin:0 0 24px;">
        One honest observation from your run: the gap between your strongest and weakest dimension is where we typically design the most targeted intervention. Most organizations train the average — we architect for the edge cases that actually break performance.
      </p>

      <!-- CTA -->
      <div style="text-align:center;margin:32px 0;">
        <a href="https://ssundar.com/consulting.html#engage"
           style="display:inline-block;background:#E31E24;color:#ffffff;padding:14px 36px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.05em;font-family:monospace;">
          DISCUSS YOUR RESULTS →
        </a>
      </div>

      <p style="font-size:13px;line-height:1.7;color:rgba(255,255,255,0.35);margin:24px 0 4px;">
        Shyam Sundar<br>
        <span style="color:rgba(255,255,255,0.2)">Founder, EXLPRS LLP · Performance Systems Architecture</span>
      </p>
    </div>

    <div style="background:#000000;padding:16px 40px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;font-family:monospace;">
        <a href="https://exlprs.com" style="color:rgba(255,255,255,0.3);text-decoration:none;">exlprs.com</a> ·
        <a href="https://ssundar.com/simulate.html" style="color:rgba(255,255,255,0.3);text-decoration:none;">Run another simulation</a> ·
        <a href="https://ssundar.com/insights.html" style="color:rgba(255,255,255,0.3);text-decoration:none;">Research</a>
      </p>
      <p style="font-size:10px;color:rgba(255,255,255,0.1);margin:6px 0 0;font-family:monospace;">
        Excellence isn't taught. It's engineered.
      </p>
    </div>
  </div>
</body>
</html>`;
}
