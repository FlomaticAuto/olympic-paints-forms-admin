import OffsiteDeclarationForm from '@/components/OffsiteDeclarationForm';

export const metadata = {
  title: 'Off-Site Declaration — Olympic Paints',
};

export default function OffsiteDeclarationPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-surface-page)',
      padding: '0 0 40px',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--color-surface-secondary)',
        borderBottom: '1px solid var(--color-border-subtle)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          <img src="/logo.jpg" alt="Olympic Paints" width={36} height={36}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 18,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-primary)',
          }}>
            Off-Site Declaration
          </div>
          <div style={{
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}>
            HAVEN · HR & People
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 600, margin: '32px auto', padding: '0 20px' }}>
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: 14,
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          Use this form when you will not be clocking in/out on site — overnight stays,
          field visits, delivery runs, or any other off-site activity. Your declaration
          will be sent to your approver before you leave.
        </p>

        <OffsiteDeclarationForm />
      </div>
    </div>
  );
}
