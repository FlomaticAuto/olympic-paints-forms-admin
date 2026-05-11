import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Anon-key Supabase client — respects RLS.
 * Safe to use in Client Components and browser contexts.
 * Cannot read archived forms or write to admin-only tables.
 */
export function createBrowserClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars'
    );
  }

  return createClient<Database>(url, anon);
}
