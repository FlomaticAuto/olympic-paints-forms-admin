import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const APP_URL          = process.env.NEXT_PUBLIC_APP_URL ?? '';
const TELEGRAM_TOKEN   = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT    = '8042233389';
const WA_WEBHOOK       = process.env.WHATSAPP_WEBHOOK_URL ?? 'https://hook.eu2.make.com/og4xli5ljkagkuas1om2oragzy2xxpm2';

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

  // Fetch approver for this department
  const { data: approverRow } = await db
    .from('haven_dept_approvers')
    .select('approver_name, approver_email, approver_wa')
    .eq('department', department)
    .maybeSingle();

  // Fall back to Quintus if dept not configured
  const approver = approverRow ?? {
    approver_name: 'Quintus Lategan',
    approver_email: 'quintusl@olympicpaints.co.za',
    approver_wa: '27748660437',
  };

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
      approver_email: approver.approver_email,
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

  // Build notification messages
  const isOvernight = activity_type === 'Overnight Stay';
  const dateRange = date_from === date_to ? date_from : `${date_from} to ${date_to}`;
  const timeInfo  = !isOvernight && departure_time
    ? ` | Dep: ${departure_time}${return_expected ? ` → Return: ${return_expected}` : ''}`
    : '';

  const waMsg = `*Off-Site Declaration — ${activity_type}*\n\n` +
    `Employee: ${employee_name} (${employee_id})\n` +
    `Dept: ${department}\n` +
    `Date: ${dateRange}${timeInfo}\n` +
    `Location: ${location}\n` +
    `Purpose: ${purpose}\n\n` +
    `Tap to approve/reject:\n${approvalUrl}`;

  const tgMsg = `📋 *Off-Site Declaration*\n\n` +
    `*${employee_name}* (${employee_id})\n` +
    `${department} · ${activity_type}\n` +
    `Dates: ${dateRange}${timeInfo}\n` +
    `Location: ${location}\n` +
    `Purpose: ${purpose}\n\n` +
    `[Approve/Reject](${approvalUrl})`;

  // Send WhatsApp to approver (if WA number available)
  if (approver.approver_wa) {
    fetch(WA_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: approver.approver_wa, message: waMsg }),
    }).catch(e => console.error('[offsite/declare wa]', e));
  }

  // Always send Telegram to Quintus for visibility
  if (TELEGRAM_TOKEN) {
    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: tgMsg, parse_mode: 'Markdown' }),
    }).catch(e => console.error('[offsite/declare tg]', e));
  }

  return NextResponse.json({ declaration_id: rec.id }, { status: 201 });
}
