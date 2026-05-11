'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ArchiveButton({ formId }: { formId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleArchive() {
    if (!confirm('Archive this form? It will no longer be accessible to respondents.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/forms/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET ?? '',
        },
        body: JSON.stringify({ form_id: formId }),
      });
      if (!res.ok) throw new Error('Archive failed');
      router.refresh();
    } catch (err) {
      alert('Failed to archive form. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="btn btn-danger"
      onClick={handleArchive}
      disabled={loading}
      aria-label="Archive form"
    >
      {loading ? 'Archiving…' : 'Archive'}
    </button>
  );
}
