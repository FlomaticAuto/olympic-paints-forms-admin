import OffsiteDeclarationForm from '@/components/OffsiteDeclarationForm';

export const metadata = {
  title: 'Off-Site Declaration — Olympic Paints',
};

export default function OffsiteDeclarationPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-surface-page)',
      padding: '0 0 56px',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--color-surface-secondary)',
        borderBottom: '2px solid var(--color-brand-primary)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
          <img src="https://flomaticauto.github.io/olympic-paints-clocking/logo.jpg" alt="Olympic Paints" width={44} height={44}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-text-primary)',
            lineHeight: 1.1,
          }}>
            Off-Site Declaration
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-brand-primary)',
            marginTop: 2,
          }}>
            HAVEN · HR &amp; People
          </div>
        </div>
      </div>

      {/* Instruction banner */}
      <div style={{
        background: 'var(--color-info-bg)',
        borderBottom: '1px solid var(--color-info-bd)',
        padding: '14px 20px',
      }}>
        <p style={{
          color: 'var(--color-info-fg)',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 580,
        }}>
          Complete this form <strong>before you leave site</strong> — for overnight stays,
          field visits, delivery runs, or any off-site activity. Your manager will receive
          an approval request immediately.
        </p>
      </div>

      {/* Form body */}
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '24px 16px 0' }}>
        <OffsiteDeclarationForm />
      </div>
    </div>
  );
}
