import type { Metadata, Viewport } from 'next';
import QuoteChangeForm from '@/components/QuoteChangeForm';

export const metadata: Metadata = {
  title: 'Quote & Price Change Log — Olympic Paints',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#F6C324',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function QuoteChangesPage() {
  return <QuoteChangeForm />;
}
