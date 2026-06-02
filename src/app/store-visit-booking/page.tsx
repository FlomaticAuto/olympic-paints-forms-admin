import StoreVisitBookingForm from '@/components/StoreVisitBookingForm';

// Set STORE_VISIT_BOOKING_FORM_ID in Vercel env vars.
// Value: d06d8fd6-3b0e-4023-bb6e-cfadfa33dbcb (seeded 2026-06-02)
const FORM_ID = process.env.STORE_VISIT_BOOKING_FORM_ID ?? 'd06d8fd6-3b0e-4023-bb6e-cfadfa33dbcb';

export const metadata = {
  title: 'Store Visit Booking — Olympic Paints',
};

export default function StoreVisitBookingPage() {
  return <StoreVisitBookingForm formId={FORM_ID} />;
}
