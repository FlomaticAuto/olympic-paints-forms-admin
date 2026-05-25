'use client';
import { useState, FormEvent } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { createClient } from '@supabase/supabase-js';
import type { FormField, EnrichedDriveField } from '@/lib/supabase/types';
import OneDriveUploadField from '@/components/OneDriveUploadField';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const STORAGE_BUCKET = 'form-uploads';

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
    } else if (f.type === 'file') {
      initial[f.id] = f.drive ? '' : [];   // drive fields: string URL; native: File[]
    } else if (f.type === 'checkbox_grid' || f.type === 'checkbox') {
      // default may be a comma-separated string of pre-ticked values
      const raw = f.default ?? '';
      initial[f.id] = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else {
      initial[f.id] = f.default ?? '';
    }
  }
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ordered = [...schema].sort((a, b) => a.order - b.order);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    // Validate required drive fields — hidden inputs skip browser constraint validation
    const missingDriveFields = schema.filter(
      (f) => f.type === 'file' && f.drive && f.required && !(values[f.id] as string),
    );
    if (missingDriveFields.length > 0) {
      setError(`Please upload photos for: ${missingDriveFields.map((f) => f.label).join(', ')}`);
      setBusy(false);
      return;
    }

    // Serialise checkbox_grid arrays → comma-separated strings for consistent storage
    const resolvedValues: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(values)) {
      resolvedValues[k] = Array.isArray(val) ? (val as string[]).join(', ') : val;
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

    for (const f of schema) {
      if (f.type !== 'file') continue;
      if (f.drive) continue;  // drive fields already have a URL string — no Supabase upload needed
      const files = values[f.id] as File[];
      if (!files || files.length === 0) continue;

      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading image ${i + 1} of ${files.length}…`);
        const ext   = file.name.split('.').pop() ?? 'jpg';
        const path  = `ncr/${Date.now()}_${i}.${ext}`;
        const { error: upErr } = await sb.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          setError(`Image upload failed: ${upErr.message}`);
          setBusy(false);
          setUploadProgress(null);
          return;
        }
        const { data: urlData } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
      resolvedValues[f.id] = urls.join(', ');
    }
    setUploadProgress(null);

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
        body:    JSON.stringify({ data: resolvedValues, metadata }),
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
        {ordered.map((f) => {
          // Hide _other text fields unless sibling checkbox_grid has "Other" ticked
          if (f.id.endsWith('_other')) {
            const parentId = f.id.slice(0, -6); // strip "_other"
            const parentVal = values[parentId];
            const otherTicked = Array.isArray(parentVal) && (parentVal as string[]).includes('Other');
            if (!otherTicked) return null;
          }
          const enrichedField = f.drive && f.type === 'file'
            ? { ...f, _repName: String(values['servicing_rep'] ?? ''), _storeName: String(values['store_name'] ?? ''), _visitDate: String(values['checked_in_at'] ?? '') }
            : f;

          return (
            <Field key={f.id} field={enrichedField} value={values[f.id]} onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))} />
          );
        })}
        {uploadProgress && <p className="upload-progress">{uploadProgress}</p>}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy} className="submit">
          {busy ? (uploadProgress ? 'Uploading…' : 'Submitting…') : 'Submit'}
        </button>
      </form>
      <style jsx>{styles}</style>
    </main>
  );
}

function Field({ field, value, onChange }: { field: EnrichedDriveField | FormField; value: unknown; onChange: (v: unknown) => void }) {
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

  if (field.type === 'checkbox_grid') {
    const checked = Array.isArray(value) ? (value as string[]) : [];
    const toggle = (opt: string) => {
      const next = checked.includes(opt)
        ? checked.filter((x) => x !== opt)
        : [...checked, opt];
      onChange(next);
    };
    return (
      <fieldset className="field">
        <legend className="label">{field.label}{field.required && ' *'}</legend>
        <div className="cb-grid">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="cb-row">
              <input
                type="checkbox"
                value={opt}
                checked={checked.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
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

  if (field.type === 'file') {
    const enriched = '_repName' in field ? (field as EnrichedDriveField) : null;
    if (field.drive && enriched) {
      return (
        <OneDriveUploadField
          fieldId={field.id}
          label={field.label}
          required={field.required ?? false}
          repName={enriched._repName}
          storeName={enriched._storeName}
          visitDate={enriched._visitDate}
          value={value as string}
          onChange={onChange}
        />
      );
    }

    // Native file input fallback (no Drive configured, or field.drive not set)
    const files = (value as File[] | undefined) ?? [];
    return (
      <div className="field">
        <span className="label">{field.label}{field.required && ' *'}</span>
        <label className="file-label">
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            required={field.required && files.length === 0}
            className="file-input"
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              onChange(selected);
            }}
          />
          <span className="file-btn">
            {files.length === 0 ? '📎 Choose photos / files' : `${files.length} file${files.length > 1 ? 's' : ''} selected`}
          </span>
        </label>
        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f, i) => <li key={i}>{f.name}</li>)}
          </ul>
        )}
      </div>
    );
  }

  const htmlInputType =
    field.type === 'email'          ? 'email'          :
    field.type === 'tel'            ? 'tel'            :
    field.type === 'number'         ? 'number'         :
    field.type === 'date'           ? 'date'           :
    field.type === 'datetime-local' ? 'datetime-local' :
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
  /* ── Base — optimised for 10-inch tablet, easy to read & tap ── */
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Barlow:wght@400;500&display=swap');

  .oly-public {
    background: #0D2040;
    color: #fff;
    font-family: 'Barlow', sans-serif;
    min-height: 100vh;
    padding: 24px 20px 80px;
    font-size: 18px;
  }

  /* Card fills most of a 10-inch screen width */
  .card {
    max-width: 860px;
    margin: 0 auto;
    background: #1A3D6E;
    border-radius: 14px;
    padding: 32px 36px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  h1 {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    color: #F5C400;
    text-transform: uppercase;
    font-size: 36px;
    margin: 0 0 8px;
  }

  .desc {
    color: #B8CCE8;
    margin: 0 0 28px;
    line-height: 1.5;
    font-size: 17px;
  }

  .field {
    display: block;
    margin: 22px 0;
  }

  /* Large, bold field labels — easy to scan */
  .label {
    display: block;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    color: #F5C400;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 14px;
    margin-bottom: 8px;
  }

  /* Inputs — tall enough for easy tapping on tablet */
  input, select, textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 16px 18px;
    min-height: 56px;
    font-size: 18px;
    font-family: 'Barlow', sans-serif;
    background: #0D2040;
    color: #fff;
    border: 1.5px solid rgba(107,158,208,0.4);
    border-radius: 10px;
  }
  input:focus, select:focus, textarea:focus {
    outline: 2.5px solid #F5C400;
    outline-offset: 2px;
  }
  /* Make select options readable */
  select option { background: #0D2040; color: #fff; font-size: 18px; }

  textarea { min-height: 96px; resize: vertical; }

  /* Date picker — force large text on Android/iOS */
  input[type=date] { min-height: 60px; font-size: 18px; color-scheme: dark; }

  .html-block {
    padding: 14px 18px;
    background: rgba(245,196,0,0.08);
    border-left: 4px solid #F5C400;
    border-radius: 10px;
    margin: 22px 0;
    line-height: 1.5;
    font-size: 17px;
  }
  .html-block strong { color: #F5C400; }

  /* Radio rows — extra tall tap targets */
  fieldset { border: 0; padding: 0; margin: 22px 0; }
  legend { padding: 0; }

  .radio-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    min-height: 56px;
    cursor: pointer;
    border-radius: 8px;
    margin: 4px 0;
    transition: background 0.1s;
  }
  .radio-row:hover { background: rgba(245,196,0,0.06); }
  .radio-row input[type=radio] {
    width: 22px;
    height: 22px;
    min-height: auto;
    flex-shrink: 0;
    accent-color: #F5C400;
    cursor: pointer;
  }
  .radio-row span { font-size: 18px; }

  /* Checkbox grid */
  .cb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin-top: 8px; }
  .cb-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 10px;
    min-height: 52px;
    cursor: pointer;
    border-radius: 8px;
    transition: background 0.1s;
  }
  .cb-row:hover { background: rgba(245,196,0,0.08); }
  .cb-row input[type=checkbox] { width: 22px; height: 22px; min-height: auto; flex-shrink: 0; accent-color: #F5C400; cursor: pointer; }
  .cb-row span { font-size: 17px; line-height: 1.3; }

  /* Submit button — big, can't miss it */
  .submit {
    width: 100%;
    padding: 20px;
    min-height: 64px;
    background: #F5C400;
    color: #0D2040;
    border: 0;
    border-radius: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 22px;
    cursor: pointer;
    margin-top: 32px;
  }
  .submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .error {
    color: #FDDCDC;
    background: rgba(232,96,96,0.14);
    border: 1px solid rgba(232,96,96,0.35);
    padding: 14px 18px;
    border-radius: 10px;
    margin-top: 20px;
    font-size: 16px;
  }
  .upload-progress {
    color: #FDF0A0;
    background: rgba(245,196,0,0.10);
    border: 1px solid rgba(245,196,0,0.25);
    padding: 14px 18px;
    border-radius: 10px;
    margin-top: 20px;
    font-size: 16px;
  }

  /* Native file fallback */
  .file-label { display: block; cursor: pointer; }
  .file-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .file-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 56px;
    padding: 16px 18px;
    background: #0D2040;
    color: #B8CCE8;
    border: 1.5px dashed rgba(107,158,208,0.5);
    border-radius: 10px;
    font-size: 18px;
    text-align: center;
    transition: border-color 0.15s;
  }
  .file-label:hover .file-btn { border-color: #F5C400; color: #F5C400; }
  .file-list { margin: 8px 0 0; padding: 0 0 0 16px; color: #B8CCE8; font-size: 15px; }
  .file-list li { margin: 3px 0; }

  /* Tablet: single-column, full width */
  @media (max-width: 900px) {
    .card { padding: 24px 20px; }
    h1 { font-size: 30px; }
  }
  @media (max-width: 540px) {
    .card { padding: 16px 14px; }
    h1 { font-size: 26px; }
    .cb-grid { grid-template-columns: 1fr; }
    .oly-public { padding: 12px 8px 80px; font-size: 16px; }
    input, select, textarea { font-size: 16px; }
    .radio-row span { font-size: 16px; }
  }
`;
