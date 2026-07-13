import Link from 'next/link';

// Shared admin layout shell — topbar + main content area.
// Server Component: no 'use client' needed.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-logo">
          <img src="/logo.jpg" alt="Olympic Paints" width={32} height={32} />
        </div>
        <span className="admin-topbar-title">Olympic Paints</span>
        <span className="admin-topbar-badge">Forms Admin</span>
        <nav style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <Link
            href="/admin/cockpit"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
          >
            Cockpit
          </Link>
          <Link
            href="/admin/forms"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
          >
            Forms
          </Link>
          <Link
            href="/admin/resin-estimates"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
          >
            Resin Estimates
          </Link>
          <Link
            href="/admin/logout"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
              textDecoration: 'none',
            }}
          >
            Sign out
          </Link>
        </nav>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
