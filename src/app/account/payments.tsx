import { Screen } from '@/components/ui';
import { useApp } from '@/state/AppProvider';

import { Header, Row, SignInRequired } from './personal';

export default function AccountPaymentsScreen() {
  const { registrations, role } = useApp();
  if (role === 'guest') return <SignInRequired title="Payments" />;
  const first = registrations[0];
  return (
    <Screen>
      <Header title="Payments" />
      <Row label="Latest" value={first ? `$${first.amountDue} · ${first.paymentStatus}` : 'None'} />
      <Row label="Method" value="Demo · no card charged" last />
    </Screen>
  );
}
