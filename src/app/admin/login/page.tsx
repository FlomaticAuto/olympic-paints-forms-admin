import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;

  // Server Action — runs on the server, never exposes ADMIN_SECRET to the client
  async function handleLogin(formData: FormData) {
    'use server';
    const password   = formData.get('password') as string;
    const nextPath   = (formData.get('next') as string) || '/admin/forms';
    const secret     = process.env.ADMIN_SECRET ?? '';

    if (!password || password !== secret) {
      const url = `/admin/login?error=1&next=${encodeURIComponent(nextPath)}`;
      redirect(url);
    }

    // Set a session cookie valid for 7 days
    const cookieStore = await cookies();
    cookieStore.set('oly_admin_auth', secret, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    });

    redirect(nextPath);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--color-surface-page)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'var(--color-surface-base)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
      }}>
        {/* Header strip */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-surface-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/logo.jpg" alt="Olympic Paints" width={36} height={36}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
            }}>Olympic Paints</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>
              Forms Admin
            </div>
          </div>
        </div>

        {/* Form body */}
        <form action={handleLogin} style={{ padding: '28px' }}>
          <input type="hidden" name="next" value={next ?? '/admin/forms'} />

          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 22,
              textTransform: 'uppercase',
              color: 'var(--color-text-primary)',
              marginBottom: 6,
            }}>
              Sign in
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              Enter the admin password to continue.
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px',
              marginBottom: 16,
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-bd)',
              borderRadius: 'var(--r-md)',
              color: 'var(--color-danger-fg)',
              fontSize: 13,
            }}>
              Incorrect password. Please try again.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            <label style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: 13,
              color: 'var(--color-text-primary)',
            }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--color-text-primary)',
                background: 'var(--color-surface-sunken)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--r-md)',
                padding: '10px 14px',
                width: '100%',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '12px 28px',
              borderRadius: 'var(--r-pill)',
              border: 'none',
              background: 'var(--color-brand-primary)',
              color: 'var(--color-text-on-brand)',
              cursor: 'pointer',
              width: '100%',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
