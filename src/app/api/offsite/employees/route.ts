import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/offsite/employees
// Public — returns active employee list for the declaration form dropdown.
export async function GET() {
  const db = createServerClient();

  const { data, error } = await db
    .from('haven_employees')
    .select('id, full_name, department, employer')
    .eq('active', true)
    .order('full_name');

  if (error) {
    console.error('[offsite/employees]', error);
    return NextResponse.json({ error: 'Failed to load employees' }, { status: 500 });
  }

  return NextResponse.json({ employees: data ?? [] });
}
