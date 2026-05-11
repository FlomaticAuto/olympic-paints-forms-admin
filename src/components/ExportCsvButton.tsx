'use client';

import type { FormSubmission } from '@/lib/supabase/types';

interface Props {
  submissions: FormSubmission[];
  formTitle: string;
}

export default function ExportCsvButton({ submissions, formTitle }: Props) {
  function handleExport() {
    if (submissions.length === 0) {
      alert('No submissions to export.');
      return;
    }

    // Collect all unique field keys across all submissions
    const fieldKeys = Array.from(
      new Set(submissions.flatMap(s => Object.keys(s.data as Record<string, unknown>)))
    );

    const headers = ['id', 'submitted_by', 'submitted_at', ...fieldKeys];

    const rows = submissions.map(s => {
      const data = s.data as Record<string, unknown>;
      return [
        s.id,
        s.submitted_by ?? '',
        s.submitted_at,
        ...fieldKeys.map(k => {
          const val = data[k];
          if (Array.isArray(val)) return val.join('; ');
          return val != null ? String(val) : '';
        }),
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${formTitle.replace(/[^a-z0-9]/gi, '_')}_submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="btn btn-primary" onClick={handleExport}>
      Export CSV
    </button>
  );
}
