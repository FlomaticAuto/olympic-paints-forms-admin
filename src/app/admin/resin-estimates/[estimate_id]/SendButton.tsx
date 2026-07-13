'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SendButton({
  estimateId, defaultSubject, defaultBody,
}: { estimateId: string; defaultSubject: string; defaultBody: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyText, setBodyText] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/resin-estimates/${estimateId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, bodyText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Send failed');
      setMsg({ ok: true, text: `Sent to ${(data.sentTo ?? []).join(', ')}` });
      setTimeout(() => { setOpen(false); router.refresh(); }, 1400);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Send failed' });
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={primaryBtn}>Email PDF to Kim</button>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 50 }}>
      <div style={{ width: '100%', maxWidth: '560px', background: 'var(--color-surface-base)', borderRadius: 'var(--r-xl)', padding: '22px', boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', textTransform: 'uppercase', margin: '0 0 4px' }}>Email estimate</h3>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
          The branded PDF will be attached. In review mode this goes to <b>kimw@olympicresins.co.za</b> only.
        </p>
        <label style={labelStyle}>Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
        <label style={{ ...labelStyle, marginTop: '12px' }}>Message</label>
        <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={9} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-body)' }} />
        {msg && (
          <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: 'var(--r-md)', fontSize: '13px',
            background: msg.ok ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            color: msg.ok ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }}>{msg.text}</div>
        )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '18px', justifyContent: 'flex-end' }}>
          <button onClick={() => setOpen(false)} disabled={sending} style={secondaryBtn}>Cancel</button>
          <button onClick={send} disabled={sending} style={{ ...primaryBtn, opacity: sending ? 0.6 : 1 }}>{sending ? 'Sending…' : 'Send now'}</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '14px', fontFamily: 'var(--font-body)',
  border: '1px solid var(--color-border-default)', borderRadius: 'var(--r-md)',
  background: 'var(--color-surface-base)', color: 'var(--color-text-primary)',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--color-text-secondary)', marginBottom: '4px',
};
const primaryBtn: React.CSSProperties = {
  background: 'var(--color-brand-primary)', color: '#0D0D0B', border: 'none', borderRadius: 'var(--r-pill)',
  padding: '10px 22px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'var(--font-body)',
};
const secondaryBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--r-pill)', padding: '9px 18px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-body)',
};
