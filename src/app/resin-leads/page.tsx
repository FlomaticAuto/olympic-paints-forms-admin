import type { Metadata, Viewport } from 'next';
import ResinLeadForm from '@/components/ResinLeadForm';

// PWA metadata — scoped to this route only, so the other forms in the app
// are unaffected. Makes /resin-leads installable as a standalone phone app.
export const metadata: Metadata = {
  title: 'Olympic Resins — Lead Manager',
  manifest: '/resin-leads.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Resins Leads',
  },
  icons: {
    apple: '/olympic-resins-icon-180.png',
    icon: '/olympic-resins-icon-192.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#F6C324',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function ResinLeadsPage() {
  return <ResinLeadForm />;
}
