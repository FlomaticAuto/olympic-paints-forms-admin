import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// GET /admin/logout — clears the session cookie and redirects to login
export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('oly_admin_auth');
  return NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'));
}
