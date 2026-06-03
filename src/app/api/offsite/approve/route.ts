import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT  = '8042233389';
const WA_WEBHOOK     = process.env.WHATSAPP_WEBHOOK_URL ?? 'https://hook.eu2.make.com/og4xli5ljkagkuas1om2oragzy2xxpm2';

// Known employee WhatsApp numbers — in production, store in haven_employees table.
// For now we notify Quintus for all decisions (who can relay to the employee directly).
const QUINTUS_WA = process.env.WHATSAPP_DEFAULT_TO ?? '27748660437';

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
  const verb      = decision === 'approved' ? 'APPROVED ✓' : 'REJECTED ✕';
  const notesLine = notes?.trim() ? `\nNotes: ${notes.trim()}` : '';

  const waMsg = `*Off-Site Declaration ${verb}*\n\n` +
    `${decl.employee_name} (${decl.employee_id})\n` +
    `${decl.activity_type} · ${dateRange}\n` +
    `Location: ${decl.location}\n` +
    `Approved by: ${approver_name}${notesLine}`;

  const tgMsg = `📋 *Off-Site ${verb}*\n\n` +
    `*${decl.employee_name}* (${decl.employee_id})\n` +
    `${decl.activity_type} · ${dateRange}\n` +
    `Location: ${decl.location}\n` +
    `Decided by: ${approver_name}${notesLine}`;

  // Notify Quintus via WhatsApp (confirmation that a decision was made)
  fetch(WA_WEBHOOK, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ to: QUINTUS_WA, message: waMsg }),
  }).catch(e => console.error('[offsite/approve wa]', e));

  // Telegram notification
  if (TELEGRAM_TOKEN) {
    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: tgMsg, parse_mode: 'Markdown' }),
    }).catch(e => console.error('[offsite/approve tg]', e));
  }

  return NextResponse.json({ ok: true, decision });
}
