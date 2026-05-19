import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = '8042233389';

// POST /api/returns-notify
// Called client-side after a successful return intake submission.
// Sends a Telegram message to Quintus. Non-critical — errors are logged but not surfaced.
export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('[returns-notify] TELEGRAM_BOT_TOKEN not set — skipping notification');
    return NextResponse.json({ ok: false, reason: 'no token' });
  }

  const { report_ref, date, category, product, colour, size, qty, supervisor, notes } = body;

  const lines = [
    `📦 *Returns Intake Logged*`,
    ``,
    `*Ref:* \`${report_ref}\``,
    `*Date:* ${date}`,
    ``,
    `*Category:* ${category}`,
    `*Product:* ${product}`,
    `*Colour:* ${colour}`,
    `*Size:* ${size}`,
    `*Qty:* ${qty} unit${Number(qty) !== 1 ? 's' : ''}`,
    ``,
    `*Supervisor:* ${supervisor}`,
  ];
  if (notes?.trim()) lines.push(`*Notes:* ${notes.trim()}`);

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
      console.error('[returns-notify] Telegram error:', err);
      return NextResponse.json({ ok: false });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[returns-notify] fetch failed:', err);
    return NextResponse.json({ ok: false });
  }
}
