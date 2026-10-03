import { AccountScreen, Note, SettingRow, SettingsCard, SignInGate } from '@/components/account/Settings';
import { EmptyState } from '@/components/ui';
import { demoPrograms } from '@/data/demo';
import { paymentLine } from '@/lib/registrationFlow';
import { useApp } from '@/state/AppProvider';

export default function AccountPaymentsScreen() {
  const { registrations, role } = useApp();
  if (role === 'guest') return <SignInGate title="Payments" />;
  return (
    <AccountScreen title="Payments">
      {registrations.length === 0 ? (
        <EmptyState pose="idea" title="No payments yet" message="When the club approves a registration, what you owe shows up here." />
      ) : (
        <SettingsCard>
          {registrations.map((registration, index) => (
            <SettingRow
              key={registration.id}
              icon="card-outline"
              tint="gold"
              label={demoPrograms.find((program) => program.id === registration.programId)?.title ?? 'Registration'}
              detail={registration.participantNames.join(', ')}
              value={paymentLine(registration)}
              last={index === registrations.length - 1}
            />
          ))}
        </SettingsCard>
      )}
      <Note>Paying online isn’t switched on yet. The club will message you when it is.</Note>
    </AccountScreen>
  );
}
