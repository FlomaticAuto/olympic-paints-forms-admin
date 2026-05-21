'use client';
import { useEffect, useRef } from 'react';
import type { FormField } from '@/lib/supabase/types';
import DOMPurify from 'isomorphic-dompurify';

interface Props {
  title: string;
  description: string | null;
  schema: FormField[];
  onClose: () => void;
}

export default function FormPreviewPanel({ title, description, schema, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Trap focus inside panel
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const ordered = [...schema].sort((a, b) => a.order - b.order);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 100,
        }}
        aria-hidden
      />

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview: ${title}`}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(520px, 100vw)',
          background: '#0D2040', overflowY: 'auto', zIndex: 101,
          boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          outline: 'none',
        }}
      >
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(107,158,208,0.20)',
          background: '#1A3D6E', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#F5C400', marginBottom: 2 }}>
              Form Preview
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 800, fontSize: 16, textTransform: 'uppercase', color: '#fff' }}>
              {title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            style={{
              background: 'none', border: 'none', color: '#B8CCE8', fontSize: 22,
              cursor: 'pointer', lineHeight: 1, padding: '4px 8px', borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Watermark banner */}
        <div style={{
          background: 'rgba(245,196,0,0.10)', borderBottom: '1px solid rgba(245,196,0,0.20)',
          padding: '6px 20px', flexShrink: 0,
          fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: 10,
          textTransform: 'uppercase', letterSpacing: '0.12em', color: '#F5C400',
          textAlign: 'center',
        }}>
          Preview — fields are read-only and cannot be submitted
        </div>

        {/* Form fields */}
        <div style={{ padding: '20px', flexGrow: 1 }}>
          {description && (
            <p style={{ color: '#B8CCE8', fontSize: 14, lineHeight: 1.5, marginBottom: 20, fontFamily: 'Barlow, sans-serif' }}>
              {description}
            </p>
          )}

          {ordered.map((f) => (
            <PreviewField key={f.id} field={f} />
          ))}

          {/* Fake submit button */}
          <div style={{
            marginTop: 24, padding: '16px', background: 'rgba(245,196,0,0.15)',
            border: '2px dashed rgba(245,196,0,0.35)', borderRadius: 8,
            textAlign: 'center',
            fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 900,
            textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 14,
            color: 'rgba(245,196,0,0.5)',
          }}>
            Submit (disabled in preview)
          </div>
        </div>
      </div>
    </>
  );
}

function PreviewField({ field }: { field: FormField }) {
  if (field.type === 'hidden') {
    return (
      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.10)', borderRadius: 6 }}>
        <FieldLabel>🔒 Hidden: {field.label}</FieldLabel>
        <span style={{ fontSize: 12, color: '#5C6B7A', fontFamily: 'Barlow, sans-serif' }}>Prefilled from URL — not visible to respondent</span>
      </div>
    );
  }

  if (field.type === 'html') {
    return (
      <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(245,196,0,0.06)', borderLeft: '4px solid rgba(245,196,0,0.40)', borderRadius: 8, lineHeight: 1.5, color: '#B8CCE8', fontSize: 14 }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(field.html ?? '') }}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <div className="pf-field">
        <FieldLabel required={field.required}>{field.label}</FieldLabel>
        <select disabled style={inputStyle}>
          <option>— select —</option>
          {(field.options ?? []).map(o => <option key={o}>{o}</option>)}
        </select>
        <OptionPills options={field.options} />
      </div>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="pf-field">
        <FieldLabel required={field.required}>{field.label}</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
          {(field.options ?? []).map(o => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', color: '#B8CCE8', fontFamily: 'Barlow, sans-serif', fontSize: 14 }}>
              <input type="radio" disabled style={{ accentColor: '#F5C400' }} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'checkbox_grid' || field.type === 'checkbox') {
    return (
      <div className="pf-field">
        <FieldLabel required={field.required}>{field.label}</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginTop: 4 }}>
          {(field.options ?? []).map(o => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', color: '#B8CCE8', fontFamily: 'Barlow, sans-serif', fontSize: 14, borderRadius: 6 }}>
              <input type="checkbox" disabled style={{ width: 18, height: 18, accentColor: '#F5C400' }} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="pf-field">
        <FieldLabel required={field.required}>{field.label}</FieldLabel>
        <textarea disabled placeholder={field.placeholder ?? ''} rows={3} style={{ ...inputStyle, resize: 'none', minHeight: 80 }} />
      </div>
    );
  }

  if (field.type === 'file') {
    return (
      <div className="pf-field">
        <FieldLabel required={field.required}>{field.label}</FieldLabel>
        <div style={{ padding: '12px 14px', background: '#0D2040', border: '1px dashed rgba(107,158,208,0.35)', borderRadius: 8, color: '#5C6B7A', fontSize: 14, fontFamily: 'Barlow, sans-serif', textAlign: 'center' }}>
          📎 {field.drive ? 'Google Drive upload' : 'File upload'} — disabled in preview
        </div>
      </div>
    );
  }

  // text / email / tel / number / date
  const inputType =
    field.type === 'email' ? 'email' :
    field.type === 'tel' ? 'tel' :
    field.type === 'number' ? 'number' :
    field.type === 'date' ? 'date' : 'text';

  return (
    <div className="pf-field">
      <FieldLabel required={field.required}>{field.label}</FieldLabel>
      <input type={inputType} disabled placeholder={field.placeholder ?? ''} style={inputStyle} />
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span style={{
      display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
      color: '#F5C400', textTransform: 'uppercase', letterSpacing: '0.08em',
      fontSize: 11, marginBottom: 6,
    }}>
      {children}{required && ' *'}
    </span>
  );
}

function OptionPills({ options }: { options?: string[] }) {
  if (!options?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {options.map(o => (
        <span key={o} style={{ padding: '2px 8px', background: 'rgba(107,158,208,0.15)', border: '1px solid rgba(107,158,208,0.25)', borderRadius: 20, fontSize: 11, color: '#B8CCE8', fontFamily: 'Barlow, sans-serif' }}>
          {o}
        </span>
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 42,
  fontSize: 15, fontFamily: 'Barlow, sans-serif',
  background: 'rgba(13,32,64,0.6)', color: 'rgba(255,255,255,0.3)',
  border: '1px solid rgba(107,158,208,0.20)', borderRadius: 8,
  opacity: 0.7,
};
