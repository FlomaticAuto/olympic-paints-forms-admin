import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendMail } from '@/lib/mailer';

const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? '';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT  = '8042233389';
// WhatsApp is disabled until the approval channel is ready.
// const WA_WEBHOOK  = process.env.WHATSAPP_WEBHOOK_URL ?? '';

// All approval emails currently go to Quintus only.
const APPROVAL_EMAIL = 'quintusl@olympicpaints.co.za';

function buildApprovalEmail(opts: {
  approverName: string;
  employeeName: string;
  employeeId: string;
  department: string;
  activityType: string;
  dateRange: string;
  timeInfo: string;
  location: string;
  purpose: string;
  approvalUrl: string;
}): string {
  const { approverName, employeeName, employeeId, department, activityType,
          dateRange, timeInfo, location, purpose, approvalUrl } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Off-Site Declaration — Approval Required</title></head>
<body style="margin:0;padding:0;background:#0D0D0B;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0B;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#1A1A18;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">

      <!-- Header -->
      <tr><td style="background:#1A3D6E;padding:20px 28px;">
        <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F5C400;">HAVEN · HR &amp; People</p>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;color:#FFFFFF;">Off-Site Declaration</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#B8CCE8;">Approval required — please review and decide below</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:28px;">
        <p style="margin:0 0 20px;font-size:15px;color:#C8C7C0;line-height:1.6;">
          Hi ${approverName},<br><br>
          <strong style="color:#E8E7E2;">${employeeName}</strong> has submitted an off-site declaration that requires your approval.
        </p>

        <!-- Declaration summary table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0D0B;border-radius:8px;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;">
          <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Employee</span><br>
            <span style="font-size:16px;font-weight:600;color:#E8E7E2;">${employeeName} <span style="color:#949390;font-weight:400;">(${employeeId})</span></span>
          </td></tr>
          <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Department</span><br>
            <span style="font-size:16px;color:#E8E7E2;">${department}</span>
          </td></tr>
          <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Activity</span><br>
            <span style="font-size:16px;color:#E8E7E2;">${activityType}</span>
          </td></tr>
          <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Date${timeInfo ? ' &amp; Time' : ''}</span><br>
            <span style="font-size:16px;color:#E8E7E2;">${dateRange}${timeInfo ? `<br><span style="font-size:14px;color:#949390;">${timeInfo.replace(' | ', '')}</span>` : ''}</span>
          </td></tr>
          <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Location</span><br>
            <span style="font-size:16px;color:#E8E7E2;">${location}</span>
          </td></tr>
          <tr><td style="padding:16px 20px;">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#5C5B58;">Purpose</span><br>
            <span style="font-size:15px;color:#C8C7C0;line-height:1.5;">${purpose}</span>
          </td></tr>
        </table>

        <!-- CTA button -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center">
            <a href="${approvalUrl}" style="display:inline-block;background:#F5C400;color:#0D0D0B;font-size:16px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:16px 40px;border-radius:8px;">
              Review &amp; Approve / Reject
            </a>
          </td></tr>
        </table>

        <p style="margin:20px 0 0;font-size:12px;color:#5C5B58;text-align:center;line-height:1.6;">
          Or copy this link into your browser:<br>
          <span style="color:#6B9ED0;word-break:break-all;">${approvalUrl}</span>
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:#5C5B58;text-align:center;">
          Olympic Paints · HAVEN HR System · This email was generated automatically.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}


// POST /api/offsite/declare
// Public — employee submits an off-site declaration.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const {
    employee_id, employee_name, department, activity_type,
    date_from, date_to, departure_time, return_expected,
    location, purpose,
  } = body as Record<string, string | null>;

  if (!employee_id || !employee_name || !department || !activity_type ||
      !date_from || !date_to || !location || !purpose) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = createServerClient();

  // Fetch approver for this department (for name only — email is fixed to Quintus for now)
  const { data: approverRow } = await db
    .from('haven_dept_approvers')
    .select('approver_name, approver_email, approver_wa')
    .eq('department', department)
    .maybeSingle();

  const approverName = (approverRow as { approver_name?: string } | null)?.approver_name ?? 'Quintus Lategan';

  // Fetch employer from employee record
  const { data: empRow } = await db
    .from('haven_employees')
    .select('employer')
    .eq('id', employee_id)
    .maybeSingle();
  const employer = (empRow as { employer?: string } | null)?.employer ?? 'Olympic Paints';

  const { data: inserted, error: insErr } = await db
    .from('haven_offsite_declarations')
    .insert({
      employee_id,
      employee_name,
      department,
      employer,
      activity_type,
      date_from,
      date_to,
      departure_time: departure_time ?? null,
      return_expected: return_expected ?? null,
      location,
      purpose,
      approver_email: APPROVAL_EMAIL,
      status: 'pending',
    } as never)
    .select('id, approval_token')
    .single();

  if (insErr || !inserted) {
    console.error('[offsite/declare insert]', insErr);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }

  const rec = inserted as { id: string; approval_token: string };
  const approvalUrl = `${APP_URL}/offsite-approve/${rec.approval_token}`;

  const isOvernight = activity_type === 'Overnight Stay';
  const dateRange   = date_from === date_to ? date_from : `${date_from} to ${date_to}`;
  const timeInfo    = !isOvernight && departure_time
    ? ` | Dep: ${departure_time}${return_expected ? ` → Return: ${return_expected}` : ''}`
    : '';

  // Send approval email to Quintus
  const emailHtml = buildApprovalEmail({
    approverName,
    employeeName: employee_name ?? '',
    employeeId:   employee_id  ?? '',
    department:   department   ?? '',
    activityType: activity_type ?? '',
    dateRange,
    timeInfo,
    location:     location  ?? '',
    purpose:      purpose   ?? '',
    approvalUrl,
  });

  sendMail({
    to: APPROVAL_EMAIL,
    subject: `Off-Site Approval Required — ${employee_name} (${activity_type})`,
    html: emailHtml,
  }).catch(e => console.error('[offsite/declare email]', e));

  // Telegram to Quintus for visibility
  if (TELEGRAM_TOKEN) {
    const tgMsg = `📋 *Off-Site Declaration*\n\n` +
      `*${employee_name}* (${employee_id})\n` +
      `${department} · ${activity_type}\n` +
      `Dates: ${dateRange}${timeInfo}\n` +
      `Location: ${location}\n` +
      `Purpose: ${purpose}\n\n` +
      `[Approve/Reject](${approvalUrl})`;
    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: tgMsg, parse_mode: 'Markdown' }),
    }).catch(e => console.error('[offsite/declare tg]', e));
  }

  return NextResponse.json({ declaration_id: rec.id }, { status: 201 });
}
