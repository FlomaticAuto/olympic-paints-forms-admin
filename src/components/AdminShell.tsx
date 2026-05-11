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
        <div style={{ marginLeft: 'auto' }}>
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
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
