'use client';
import dynamic from 'next/dynamic';
import type { FormField } from '@/lib/supabase/types';

// ssr: false keeps isomorphic-dompurify / jsdom / @exodus/bytes off the server bundle.
const FormRenderer = dynamic(() => import('@/components/FormRenderer'), { ssr: false });

interface Props {
  formId:      string;
  title:       string;
  description: string | null;
  schema:      FormField[];
  prefill:     Record<string, string>;
}

export default function FormRendererClientWrapper(props: Props) {
  return <FormRenderer {...props} />;
}
