import { Screen } from '@/components/ui';
import { demoPrograms } from '@/data/demo';
import { paymentLine } from '@/lib/registrationFlow';
import { useApp } from '@/state/AppProvider';

import { Header, Row, SignInRequired } from './personal';

export default function AccountPaymentsScreen() {
  const { registrations, role } = useApp();
  if (role === 'guest') return <SignInRequired title="Payments" />;
  return (
    <Screen>
      <Header title="Payments" />
      {registrations.length === 0 ? <Row label="Registrations" value="None yet" /> : null}
      {registrations.map((registration, index) => (
        <Row
          key={registration.id}
          label={demoPrograms.find((program) => program.id === registration.programId)?.title ?? 'Registration'}
          value={paymentLine(registration)}
        />
      ))}
      <Row label="Pay online" value="Not switched on yet" last />
    </Screen>
  );
}
