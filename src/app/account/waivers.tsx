import { AccountScreen, SettingRow, SettingsCard, SignInGate } from '@/components/account/Settings';
import { EmptyState } from '@/components/ui';
import { useApp } from '@/state/AppProvider';

export default function AccountWaiversScreen() {
  const { documents, role } = useApp();
  if (role === 'guest') return <SignInGate title="Waivers and consents" />;
  return (
    <AccountScreen title="Waivers and consents">
      {documents.length === 0 ? (
        <EmptyState pose="thumbsup" title="Nothing to sign" message="Waivers you sign while registering are kept here." />
      ) : (
        <SettingsCard>
          {documents.map((doc, index) => (
            <SettingRow
              key={doc.id}
              icon={doc.kind === 'receipt' ? 'receipt-outline' : 'document-text-outline'}
              tint={doc.kind === 'receipt' ? 'gold' : 'mint'}
              label={doc.title}
              value={doc.status}
              last={index === documents.length - 1}
            />
          ))}
        </SettingsCard>
      )}
    </AccountScreen>
  );
}
