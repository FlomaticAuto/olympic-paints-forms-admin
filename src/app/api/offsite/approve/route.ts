import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT  = '8042233389';
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
// WhatsApp notifications disabled until the approval channel is ready.
// const WA_WEBHOOK  = process.env.WHATSAPP_WEBHOOK_URL ?? '';

const NOTIFICATION_EMAIL = 'quintusl@olympicpaints.co.za';

async function sendDecisionEmail(
  decision: string,
  approverName: string,
  employeeName: string,
  employeeId: string,
  activityType: string,
  dateRange: string,
  location: string,
  notes: string | undefined,
) {
  if (!RESEND_API_KEY) return;
  const isApproved = decision === 'approved';
  const verb       = isApproved ? 'APPROVED' : 'REJECTED';
  const colour     = isApproved ? '#2D8C7A' : '#E86060';
  const notesRow   = notes?.trim()
    ? `<tr><td style="padding:14px 20px;">
         <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Notes</span><br>
         <span style="font-size:15px;color:#C8C7C0;">${notes.trim()}</span>
       </td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0D0D0B;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0B;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#1A1A18;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
      <tr><td style="background:${colour};padding:20px 28px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);">HAVEN · HR &amp; People</p>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;color:#FFFFFF;">Declaration ${verb}</h1>
      </td></tr>
      <tr><td style="padding:28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0B;border-radius:8px;border:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
          <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Employee</span><br>
            <span style="font-size:16px;font-weight:600;color:#E8E7E2;">${employeeName} <span style="color:#949390;font-weight:400;">(${employeeId})</span></span>
          </td></tr>
          <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Activity</span><br>
            <span style="font-size:16px;color:#E8E7E2;">${activityType} · ${dateRange}</span>
          </td></tr>
          <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Location</span><br>
            <span style="font-size:16px;color:#E8E7E2;">${location}</span>
          </td></tr>
          <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Decision by</span><br>
            <span style="font-size:16px;color:#E8E7E2;">${approverName}</span>
          </td></tr>
          ${notesRow}
        </table>
        <p style="margin:0;font-size:12px;color:#5C5B58;text-align:center;">Olympic Paints · HAVEN HR System</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'HAVEN HR <haven@olympicpaints.co.za>',
      to: [NOTIFICATION_EMAIL],
      subject: `Off-Site Declaration ${verb} — ${employeeName} (${activityType})`,
      html,
    }),
  }).catch(e => console.error('[offsite/approve email]', e));
}

// POST /api/offsite/approve
// Public (token-protected) — approver submits decision from Form B.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { token, decision, approver_name, notes } =
    body as { token?: string; decision?: string; approver_name?: string; notes?: string };

  if (!token || !decision || !approver_name) {
    return NextResponse.json({ error: 'token, decision, and approver_name are required' }, { status: 400 });
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 });
  }

  const db = createServerClient();

  // Fetch and lock the declaration
  const { data: declRaw, error: fetchErr } = await db
    .from('haven_offsite_declarations')
    .select('id, status, employee_name, employee_id, department, activity_type, date_from, date_to, location')
    .eq('approval_token', token)
    .maybeSingle();

  if (fetchErr || !declRaw) {
    return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });
  }

  const decl = declRaw as {
    id: string; status: string; employee_name: string; employee_id: string;
    department: string; activity_type: string; date_from: string; date_to: string; location: string;
  };

  if (decl.status !== 'pending') {
    return NextResponse.json({ error: 'Already decided', current_status: decl.status }, { status: 409 });
  }

  // Update declaration status
  const { error: updErr } = await db
    .from('haven_offsite_declarations')
    .update({ status: decision } as never)
    .eq('id', decl.id);

  if (updErr) {
    console.error('[offsite/approve update]', updErr);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  // Insert approval record
  await db.from('haven_offsite_approvals').insert({
    declaration_id: decl.id,
    approver_name,
    decision,
    notes: notes ?? null,
  } as never);

  // Build notification
  const dateRange = decl.date_from === decl.date_to ? decl.date_from : `${decl.date_from} to ${decl.date_to}`;
  const notesLine = notes?.trim() ? `\nNotes: ${notes.trim()}` : '';
  const verb      = decision === 'approved' ? 'APPROVED ✓' : 'REJECTED ✕';

  // Email decision notification
  sendDecisionEmail(
    decision, approver_name ?? '',
    decl.employee_name, decl.employee_id,
    decl.activity_type, dateRange, decl.location, notes,
  ).catch(e => console.error('[offsite/approve email]', e));

  // Telegram notification
  if (TELEGRAM_TOKEN) {
    const tgMsg = `📋 *Off-Site ${verb}*\n\n` +
      `*${decl.employee_name}* (${decl.employee_id})\n` +
      `${decl.activity_type} · ${dateRange}\n` +
      `Location: ${decl.location}\n` +
      `Decided by: ${approver_name}${notesLine}`;
    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: tgMsg, parse_mode: 'Markdown' }),
    }).catch(e => console.error('[offsite/approve tg]', e));
  }

  return NextResponse.json({ ok: true, decision });
}
