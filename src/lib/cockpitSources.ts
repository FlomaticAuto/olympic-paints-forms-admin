// Operations Cockpit — source registry.
//
// One entry per department reporting source. Adding a department to the
// cockpit = add an entry here (and build its form if it doesn't exist yet).
// The cockpit page reads this list, pulls each source's records, and renders
// one card per entry for the selected day.
//
// Two source kinds:
//   - form:  records live in form_submissions.data (jsonb); date is a path in data
//   - table: records are rows of a dedicated table; date is a column
//
// NOTE: returns rows have NULL submitted_at — the only reliable date is the
// 'date' field inside data. That's why forms carry their own dateField.

export type CockpitRecord = Record<string, unknown>;

export type CockpitSourceKind =
  | { type: 'form';  formId: string; dateField: string }
  | { type: 'table'; table: string;  dateColumn: string };

export interface CockpitSource {
  key:        string;   // stable id, e.g. 'returns'
  label:      string;   // card title
  department: string;   // department name
  owner:      string;   // who files it
  cadence:    'weekday' | 'daily';  // when a blank day = "not filed" signal
  unit:       string;   // unit for the headline metric, e.g. 'units'
  href?:      string;   // optional link to the underlying manager view
  source:     CockpitSourceKind;
  // headline metric for a single day's records
  metric:     (records: CockpitRecord[]) => number;
  // optional exception lines surfaced on the card
  exceptions?: (records: CockpitRecord[]) => string[];
}

const num = (v: unknown): number => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
};

export const COCKPIT_SOURCES: CockpitSource[] = [
  {
    key: 'returns',
    label: 'Returns / Rework',
    department: 'Production — Internal Logistics',
    owner: 'Jagdish + production supervisors',
    cadence: 'weekday',
    unit: 'units',
    href: '/returns-manager',
    source: { type: 'form', formId: process.env.RETURNS_INTAKE_FORM_ID ?? '7a7cce73-7b90-45b4-9535-5d1edf948313', dateField: 'date' },
    metric: (recs) => recs.reduce((s, r) => s + num(r.qty), 0),
    exceptions: (recs) =>
      recs
        .filter((r) => String(r.return_type) === 'Written Off')
        .map((r) => `${num(r.qty)}× ${r.product ?? r.category ?? 'item'} written off`),
  },
  {
    key: 'store_visits',
    label: 'Store Visits',
    department: 'Merchandising',
    owner: 'Merchandisers',
    cadence: 'weekday',
    unit: 'visits',
    source: { type: 'table', table: 'store_visit_captures', dateColumn: 'visit_date' },
    metric: (recs) => recs.length,
    exceptions: (recs) =>
      recs
        .filter((r) => ['Poor', 'Fair'].includes(String(r.overall_store_condition)))
        .map((r) => `${r.store_name ?? 'store'}: ${r.overall_store_condition} condition`),
  },
  {
    key: 'safety',
    label: 'Safety / Non-Conformance',
    department: 'Safety & Compliance',
    owner: 'Masingita',
    cadence: 'daily',
    unit: 'reports',
    // Form exists but has had 0 submissions — renders "Not filed" until used.
    source: { type: 'form', formId: '796c234d-51f0-43f7-a8c5-a1642415bf71', dateField: 'date' },
    metric: (recs) => recs.length,
  },
];
