import ApprovalForm from '@/components/OffsiteApprovalForm';

export const metadata = {
  title: 'Approve Off-Site Declaration — Olympic Paints',
};

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ApprovalForm token={token} />;
}
