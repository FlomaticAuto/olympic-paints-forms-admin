import ReturnIntakeForm from '@/components/ReturnIntakeForm';

// The form_id for the Returns Intake form, seeded once via seed_returns_form.py.
// Set RETURNS_INTAKE_FORM_ID in Vercel env vars after running the seed script.
const FORM_ID = process.env.RETURNS_INTAKE_FORM_ID ?? 'returns-intake';

export const metadata = {
  title: 'Returns Intake — Olympic Paints',
};

export default function ReturnsIntakePage() {
  return <ReturnIntakeForm formId={FORM_ID} />;
}
