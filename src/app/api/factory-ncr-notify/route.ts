import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = '8042233389';

// POST /api/factory-ncr-notify
// Called client-side after a successful Factory Non-Conformance submission.
// Sends a Telegram message to Quintus. Non-critical — errors are logged but not surfaced.
export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[factory-ncr-notify] TELEGRAM_BOT_TOKEN not set — skipping notification');
    return NextResponse.json({ ok: false, reason: 'no token' });
  }

  const { report_ref, date, location, nc_type, severity, product, batch_no, supervisor, description, photo_url } = body;

  const lines = [
    `⚠️ *Factory Non-Conformance Logged*`,
    ``,
    `*Ref:* \`${report_ref}\``,
    `*Date:* ${date}`,
    ``,
    `*Type:* ${nc_type}`,
    `*Severity:* ${severity}`,
    `*Location:* ${location}`,
    `*Product:* ${product}`,
    `*Batch:* ${batch_no}`,
    ``,
    `*Supervisor:* ${supervisor}`,
  ];
  if (description?.trim()) lines.push(`*Description:* ${description.trim()}`);
  if (photo_url?.trim()) lines.push(`\n📷 [View Photo](${photo_url.trim()})`);

  const text = lines.join('\n');

  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({
        chat_id:    TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[factory-ncr-notify] Telegram error:', err);
      return NextResponse.json({ ok: false });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[factory-ncr-notify] fetch failed:', err);
    return NextResponse.json({ ok: false });
  }
}
