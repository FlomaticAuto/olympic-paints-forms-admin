# Olympic Paints — Forms Admin (REPO 2)

Next.js 15 App Router application deployed on Vercel. Provides:
- A protected admin dashboard at `/admin/forms`
- API routes for creating, archiving, and reading form submissions
- A Supabase backend with RLS-enforced access control

**REPO 1 (form renderer):** `github.com/FlomaticAuto/forms` → `flomaticauto.github.io/forms`

---

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works — see note on pg_cron below)
- A Vercel account for deployment

---

## 1. Supabase setup

### Create a project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **API keys** (Settings → API)

### Run the migration

In the Supabase dashboard → SQL Editor, paste and run the full contents of:

```
supabase/migrations/20260511000000_form_system.sql
```

This creates:
- `form_schemas` table + RLS policies
- `form_submissions` table + RLS policies
- `archive_expired_forms()` function
- pg_cron daily job *(Pro plan only — skip the `cron.schedule` line on free tier)*

### Free tier note on auto-archive

pg_cron is not available on the Supabase free tier. Either:
- Call `POST /api/forms/run-archive` manually when needed, or
- Set up a GitHub Actions scheduled workflow to call it daily (see below)

---

## 2. Local development

```bash
git clone https://github.com/FlomaticAuto/olympic-paints-forms-admin
cd olympic-paints-forms-admin
npm install
cp .env.example .env.local
# Fill in .env.local with your real Supabase and secret values
npm run dev
```

Visit `http://localhost:3000` → redirects to `/admin/login`.

---

## 3. Vercel deployment

1. Push the repo to GitHub
2. Import into Vercel (New Project → select repo)
3. Add all variables from `.env.example` in **Vercel → Project Settings → Environment Variables**
4. Deploy — Vercel detects Next.js automatically

---

## 4. Environment variables

See [`.env.example`](.env.example) for the full list with descriptions.

| Variable | Required | Safe to expose? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Never** |
| `ADMIN_SECRET` | Yes | **Never** |
| `FORM_ADMIN_SECRET` | Yes | **Never** |
| `NEXT_PUBLIC_GITHUB_PAGES_BASE_URL` | Yes | Yes |
| `NEXT_PUBLIC_APP_URL` | Yes | Yes |

---

## 5. Creating a form via curl

Replace `YOUR_ADMIN_SECRET` and `https://your-admin-app.vercel.app` with real values.

### Minimal form (text + select)

```bash
curl -s -X POST https://your-admin-app.vercel.app/api/forms/create \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{
    "title": "Store Visit Report",
    "description": "Fill in after each merchandising visit.",
    "created_by": "Quintus",
    "schema": [
      {
        "id": "rep_name",
        "type": "text",
        "label": "Your name",
        "placeholder": "e.g. Byron Minnie",
        "required": true,
        "order": 1
      },
      {
        "id": "store",
        "type": "select",
        "label": "Store visited",
        "placeholder": "Choose store",
        "required": true,
        "options": ["Lenasia", "Soweto", "Roodepoort", "Sandton", "Midrand"],
        "order": 2
      },
      {
        "id": "visit_date",
        "type": "date",
        "label": "Visit date",
        "required": true,
        "order": 3
      },
      {
        "id": "notes",
        "type": "textarea",
        "label": "Notes",
        "placeholder": "Observations, stock levels, issues…",
        "required": false,
        "order": 4
      }
    ]
  }'
```

**Response:**

```json
{
  "form_id": "550e8400-e29b-41d4-a716-446655440000",
  "public_url": "https://flomaticauto.github.io/forms?id=550e8400-e29b-41d4-a716-446655440000"
}
```

### Form with expiry date

```bash
curl -s -X POST https://your-admin-app.vercel.app/api/forms/create \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{
    "title": "April Promo Feedback",
    "active_from": "2026-04-01T00:00:00Z",
    "active_until": "2026-04-30T23:59:59Z",
    "schema": [
      {
        "id": "rating",
        "type": "radio",
        "label": "How would you rate the promo?",
        "required": true,
        "options": ["Excellent", "Good", "Average", "Poor"],
        "order": 1
      }
    ]
  }'
```

---

## 6. Sharing the form link

After `POST /api/forms/create` returns a `public_url`, share it directly:

```
https://flomaticauto.github.io/forms?id=550e8400-e29b-41d4-a716-446655440000
```

Or copy it from the admin dashboard at `/admin/forms` using the **Copy link** button.

The link works until:
- `active_until` passes (auto-archived by pg_cron or `run-archive`), or
- An admin manually archives the form

---

## 7. Reading submissions via curl

```bash
curl -s https://your-admin-app.vercel.app/api/forms/550e8400-e29b-41d4-a716-446655440000/submissions \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

**Response:**

```json
{
  "form_id": "550e8400-e29b-41d4-a716-446655440000",
  "form_title": "Store Visit Report",
  "submissions": [
    {
      "id": "...",
      "submitted_by": "Byron Minnie",
      "submitted_at": "2026-05-11T09:23:00Z",
      "data": {
        "rep_name": "Byron Minnie",
        "store": "Lenasia",
        "visit_date": "2026-05-11",
        "notes": "Good shelf placement, stock low on 5L Sheen."
      },
      "metadata": {
        "user_agent": "Mozilla/5.0 ...",
        "submitted_at": "2026-05-11T09:23:00Z"
      }
    }
  ]
}
```

---

## 8. Archiving a form via curl

```bash
curl -s -X POST https://your-admin-app.vercel.app/api/forms/archive \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{ "form_id": "550e8400-e29b-41d4-a716-446655440000" }'
```

**Response:**

```json
{ "success": true }
```

Archived forms immediately return "Form unavailable" to anyone who visits the public link.

---

## 9. Triggering manual archive (free tier)

```bash
curl -s -X POST https://your-admin-app.vercel.app/api/forms/run-archive \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

**Response:**

```json
{ "archived_count": 2 }
```

### Optional: GitHub Actions daily auto-archive

Create `.github/workflows/archive.yml` in this repo:

```yaml
name: Auto-archive expired forms
on:
  schedule:
    - cron: '0 0 * * *'   # midnight UTC daily
  workflow_dispatch:       # allow manual trigger

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger run-archive
        run: |
          curl -s -X POST ${{ secrets.ADMIN_APP_URL }}/api/forms/run-archive \
            -H "x-admin-secret: ${{ secrets.FORM_ADMIN_SECRET }}"
```

Add `ADMIN_APP_URL` and `FORM_ADMIN_SECRET` as GitHub Actions secrets.

---

## 10. Field schema reference

Each entry in the `schema` array must follow this shape:

```jsonc
{
  "id":          "unique_snake_case_id",  // used as the data key in submissions
  "type":        "text",                  // see supported types below
  "label":       "Display label",         // shown above the field
  "placeholder": "Hint text",            // optional
  "required":    true,                   // optional, default false
  "options":     ["A", "B", "C"],        // required for select / radio / checkbox
  "order":       1                       // ascending render order
}
```

**Supported types:**

| Type | Renders as |
|---|---|
| `text` | Single-line text input |
| `textarea` | Multi-line text area |
| `number` | Numeric input |
| `email` | Email input (validates format) |
| `tel` | Phone number input |
| `date` | Date picker |
| `select` | Dropdown — requires `options` |
| `radio` | Radio button group — requires `options` |
| `checkbox` | Checkbox group — requires `options`; value stored as array |

---

## 11. Admin dashboard

| URL | What you see |
|---|---|
| `/admin/login` | Password prompt |
| `/admin/forms` | All active forms — title, dates, submission count, copy link, archive |
| `/admin/forms/:id` | All submissions for one form — sortable table + Export CSV |
| `/admin/logout` | Clears session cookie, redirects to login |

---

## File structure

```
src/
├── app/
│   ├── layout.tsx                          Root layout (fonts, global CSS)
│   ├── page.tsx                            Redirect → /admin/forms
│   ├── admin/
│   │   ├── login/page.tsx                  Login page (Server Action)
│   │   ├── logout/route.ts                 Clear cookie + redirect
│   │   ├── forms/
│   │   │   ├── page.tsx                    Forms list
│   │   │   └── [form_id]/page.tsx          Submissions detail + CSV export
│   └── api/forms/
│       ├── create/route.ts                 POST — create form
│       ├── archive/route.ts                POST — archive form
│       ├── list/route.ts                   GET  — list forms + counts
│       ├── run-archive/route.ts            POST — trigger archive RPC
│       └── [form_id]/submissions/route.ts  GET  — submissions for one form
├── components/
│   ├── AdminShell.tsx                      Topbar + layout wrapper
│   ├── ArchiveButton.tsx                   Client — archive with confirm
│   ├── CopyLinkButton.tsx                  Client — copy URL to clipboard
│   └── ExportCsvButton.tsx                 Client — CSV download
├── lib/supabase/
│   ├── server.ts                           Service-role client (server only)
│   ├── client.ts                           Anon client (browser safe)
│   └── types.ts                            TypeScript types + Database generic
├── middleware.ts                           Edge auth guard for /admin/*
└── styles/globals.css                      Full Olympic Paints token system
```
