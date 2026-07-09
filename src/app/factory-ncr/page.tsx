import FactoryNCRForm from '@/components/FactoryNCRForm';

// The form_id for the Factory Non-Conformance form, seeded once via seed_factory_ncr.py.
// Set FACTORY_NCR_FORM_ID in Vercel env vars after running the seed script.
const FORM_ID = process.env.FACTORY_NCR_FORM_ID ?? 'factory-ncr';

export const metadata = {
  title: 'Factory Non-Conformance — Olympic Paints',
};

export default function FactoryNCRPage() {
  return <FactoryNCRForm formId={FORM_ID} />;
}
