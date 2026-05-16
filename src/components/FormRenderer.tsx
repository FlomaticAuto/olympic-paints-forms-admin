'use client';
import { useState, FormEvent } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import type { FormField } from '@/lib/supabase/types';

interface Props {
  formId:      string;
  title:       string;
  description: string | null;
  schema:      FormField[];
  prefill:     Record<string, string>;
}

export default function FormRenderer({ formId, title, description, schema, prefill }: Props) {
  const initial: Record<string, unknown> = {};
  for (const f of schema) {
    if (f.type === 'html') continue;
    if (f.type === 'hidden') {
      initial[f.id] = prefill[f.id] ?? f.default ?? '';
    } else {
      initial[f.id] = f.default ?? (f.type === 'checkbox' ? [] : '');
    }
  }
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = [...schema].sort((a, b) => a.order - b.order);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const metadata = {
      rep_code:          prefill.rep ?? '',
      rep_email:         prefill.email ?? '',
      competitor:        prefill.competitor ?? '',
      category:          prefill.category ?? '',
      submitted_from_ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    try {
      const res = await fetch(`/api/submit/${formId}`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ data: values, metadata }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.code === 'DUPLICATE') {
          setError('You already submitted this form. Refresh to see the confirmation page.');
        } else {
          setError(j.error ?? 'Submission failed');
        }
        setBusy(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="oly-public">
        <div className="card">
          <h1>Thanks!</h1>
          <p>Your responses have been recorded. You can close this tab.</p>
        </div>
        <style jsx>{styles}</style>
      </main>
    );
  }

  return (
    <main className="oly-public">
      <form onSubmit={onSubmit} className="card">
        <h1>{title}</h1>
        {description && <p className="desc">{description}</p>}
        {ordered.map((f) => (
          <Field key={f.id} field={f} value={values[f.id]} onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))} />
        ))}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy} className="submit">
          {busy ? 'Submitting…' : 'Submit verification'}
        </button>
      </form>
      <style jsx>{styles}</style>
    </main>
  );
}

function Field({ field, value, onChange }: { field: FormField; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === 'html') {
    return <div className="html-block" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(field.html ?? '') }} />;
  }
  if (field.type === 'hidden') {
    return null;
  }

  const v = typeof value === 'string' ? value : '';

  if (field.type === 'select') {
    return (
      <label className="field">
        <span className="label">{field.label}{field.required && ' *'}</span>
        <select
          value={v}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">— select —</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === 'radio') {
    return (
      <fieldset className="field">
        <legend className="label">{field.label}{field.required && ' *'}</legend>
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="radio-row">
            <input
              type="radio"
              name={field.id}
              value={opt}
              checked={v === opt}
              onChange={(e) => onChange(e.target.value)}
              required={field.required}
            />
            <span>{opt}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (field.type === 'textarea') {
    return (
      <label className="field">
        <span className="label">{field.label}{field.required && ' *'}</span>
        <textarea
          value={v}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={3}
        />
      </label>
    );
  }

  const htmlInputType =
    field.type === 'email' ? 'email' :
    field.type === 'tel'   ? 'tel'   :
    field.type === 'number' ? 'number' :
    field.type === 'date'  ? 'date'  :
    'text';

  return (
    <label className="field">
      <span className="label">{field.label}{field.required && ' *'}</span>
      <input
        type={htmlInputType}
        value={v}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        required={field.required}
      />
    </label>
  );
}

const styles = `
  .oly-public { background:#0D2040; color:#fff; font-family:'Barlow',sans-serif; min-height:100vh; padding:24px 16px 64px; }
  .card { max-width:680px; margin:0 auto; background:#1A3D6E; border-radius:12px; padding:24px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
  h1 { font-family:'Barlow Condensed',sans-serif; font-weight:900; color:#F5C400; text-transform:uppercase; font-size:28px; margin:0 0 8px; }
  .desc { color:#B8CCE8; margin:0 0 24px; line-height:1.4; }
  .field { display:block; margin:16px 0; }
  .label { display:block; font-family:'Barlow Condensed',sans-serif; font-weight:700; color:#F5C400; text-transform:uppercase; letter-spacing:0.08em; font-size:11px; margin-bottom:6px; }
  input, select, textarea { width:100%; box-sizing:border-box; padding:12px 14px; min-height:44px; font-size:16px; font-family:'Barlow',sans-serif; background:#0D2040; color:#fff; border:1px solid rgba(107,158,208,0.35); border-radius:8px; }
  input:focus, select:focus, textarea:focus { outline:2px solid #F5C400; outline-offset:2px; }
  textarea { min-height:80px; resize:vertical; }
  .html-block { padding:12px 14px; background:rgba(245,196,0,0.08); border-left:4px solid #F5C400; border-radius:8px; margin:16px 0; line-height:1.4; }
  .html-block strong { color:#F5C400; }
  .radio-row { display:flex; align-items:center; gap:10px; padding:10px 0; min-height:44px; cursor:pointer; }
  .radio-row input { width:auto; min-height:auto; }
  fieldset { border:0; padding:0; margin:16px 0; }
  legend { padding:0; }
  .submit { width:100%; padding:16px; min-height:52px; background:#F5C400; color:#0D2040; border:0; border-radius:8px; font-family:'Barlow Condensed',sans-serif; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; font-size:16px; cursor:pointer; margin-top:24px; }
  .submit:disabled { opacity:0.5; cursor:not-allowed; }
  .error { color:#FDDCDC; background:rgba(232,96,96,0.14); border:1px solid rgba(232,96,96,0.35); padding:12px; border-radius:8px; margin-top:16px; }
  @media (max-width:480px) { h1 { font-size:24px; } .card { padding:16px; } }
`;
