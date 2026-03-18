'use client';

import dynamic from 'next/dynamic';

const InvitationForm = dynamic(
  () => import('../components/InvitationForm'),
  { ssr: false }
);

export default function InvitationPage() {
  return <InvitationForm />;
}
