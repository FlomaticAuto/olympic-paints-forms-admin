import { createServerClient } from '@/lib/supabase/server';
import type { FormSchema } from '@/lib/supabase/types';
import FormRenderer from '@/components/FormRenderer';

interface PageProps {
  params:       Promise<{ form_id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PublicFormPage({ params, searchParams }: PageProps) {
  const { form_id } = await params;
  const sp = await searchParams;

  const db = createServerClient();
  const { data: raw } = await db
    .from('form_schemas')
    .select('id,title,description,schema,active_from,active_until,is_archived')
    .eq('id', form_id)
    .maybeSingle();
  const form = raw as FormSchema | null;

  if (!form) {
    return <NotFound title="Form not found" message="This link may be wrong or the form may have been removed." />;
  }
  if (form.is_archived) {
    return <NotFound title="Form archived" message="This form is no longer accepting responses." />;
  }
  const now = new Date();
  if (form.active_until && new Date(form.active_until) < now) {
    return <NotFound title="Form closed" message="The deadline for this verification has passed." />;
  }

  const prefill: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') prefill[k] = v;
  }

  if (prefill.rep) {
    const { data: existing } = await db
      .from('form_submissions')
      .select('id,submitted_at')
      .eq('form_id', form_id)
      .filter('metadata->>rep_code', 'eq', prefill.rep)
      .limit(1);
    const list = (existing ?? []) as { id: string; submitted_at: string }[];
    if (list.length > 0) {
      return <AlreadySubmitted submittedAt={list[0].submitted_at} />;
    }
  }

  return (
    <FormRenderer
      formId={form.id}
      title={form.title}
      description={form.description}
      schema={form.schema}
      prefill={prefill}
    />
  );
}

function NotFound({ title, message }: { title: string; message: string }) {
  return (
    <main style={{ padding: 32, textAlign: 'center', color: '#fff', background: '#0D2040', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>
      <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C400', textTransform: 'uppercase', fontWeight: 900 }}>{title}</h1>
      <p style={{ color: '#B8CCE8' }}>{message}</p>
    </main>
  );
}

function AlreadySubmitted({ submittedAt }: { submittedAt: string }) {
  const when = new Date(submittedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <main style={{ padding: 32, textAlign: 'center', color: '#fff', background: '#0D2040', minHeight: '100vh', fontFamily: 'Barlow, sans-serif' }}>
      <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', color: '#F5C400', textTransform: 'uppercase', fontWeight: 900 }}>Thanks — already submitted</h1>
      <p style={{ color: '#B8CCE8' }}>You completed this verification on {when}.</p>
      <p style={{ color: '#6B9ED0', fontSize: 14, marginTop: 24 }}>Need to correct an answer? Reply to the email and we&apos;ll edit it manually.</p>
    </main>
  );
}
