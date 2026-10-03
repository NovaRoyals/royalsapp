import { AccountScreen, Note, SettingRow, SettingsCard, SignInGate } from '@/components/account/Settings';
import { useApp } from '@/state/AppProvider';

export default function AccountPersonalScreen() {
  const { household, role } = useApp();
  if (role === 'guest') return <SignInGate title="Personal information" />;
  return (
    <AccountScreen title="Personal information">
      <SettingsCard>
        <SettingRow icon="person-outline" label="Name" value={household.guardianName.trim() || 'No name yet'} />
        <SettingRow icon="mail-outline" tint="sky" label="Email" value={household.email.trim() || 'No email yet'} />
        <SettingRow icon="call-outline" tint="gold" label="Phone" value={household.phone.trim() || 'Not added'} />
        <SettingRow icon="home-outline" tint="blush" label="Address" value={household.address.trim() || 'Add when you need travel times'} last />
      </SettingsCard>
      <Note>Only you and the club office can see this. Coaches and other parents never see your phone, email or address.</Note>
    </AccountScreen>
  );
}
