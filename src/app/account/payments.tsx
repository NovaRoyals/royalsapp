import { Screen } from '@/components/ui';
import { useApp } from '@/state/AppProvider';

import { Header, Row } from './personal';

export default function AccountPaymentsScreen() {
  const { registrations } = useApp();
  const first = registrations[0];
  return (
    <Screen>
      <Header title="Payments" />
      <Row label="Latest" value={first ? `$${first.amountDue} · ${first.paymentStatus}` : 'None'} />
      <Row label="Method" value="Demo · no card charged" last />
    </Screen>
  );
}
