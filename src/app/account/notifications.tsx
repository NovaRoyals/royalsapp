import { AccountScreen, Note, SettingRow, SettingsCard, SignInGate } from '@/components/account/Settings';
import { useApp } from '@/state/AppProvider';

export default function AccountNotificationsScreen() {
  const { notificationPrefs, setNotificationPrefs, role, parentChatOn, setParentChat } = useApp();
  if (role === 'guest') return <SignInGate title="Notification settings" />;
  return (
    <AccountScreen title="Notifications">
      <SettingsCard title="Always on">
        <SettingRow
          icon="alert-circle-outline"
          tint="blush"
          label="Urgent changes"
          detail="Field closures, cancellations and moved sessions always reach you."
          toggle={{ on: true, locked: true }}
          last
        />
      </SettingsCard>

      <SettingsCard title="You choose">
        <SettingRow
          icon="chatbubble-ellipses-outline"
          tint="gold"
          label="Team and coach alerts"
          detail="Messages from your coach, session recaps and reminders."
          toggle={{ on: notificationPrefs.team, onChange: (next) => setNotificationPrefs({ ...notificationPrefs, team: next }) }}
        />
        <SettingRow
          icon="megaphone-outline"
          tint="sky"
          label="Club news"
          detail="Events, fundraisers and community days."
          toggle={{ on: notificationPrefs.community, onChange: (next) => setNotificationPrefs({ ...notificationPrefs, community: next }) }}
        />
        <SettingRow
          icon="location-outline"
          tint="mint"
          label="Fields near you"
          detail="Uses your location only while you choose to look."
          toggle={{ on: notificationPrefs.locationShare, onChange: (next) => setNotificationPrefs({ ...notificationPrefs, locationShare: next }) }}
          last
        />
      </SettingsCard>

      {role === 'guardian' ? (
        <SettingsCard title="Parent chat">
          <SettingRow
            icon="people-outline"
            tint="lilac"
            label="Let team parents message me"
            detail="Off unless you turn it on. Parents are shown as “Parent of” a first name, never by phone or email."
            toggle={{ on: parentChatOn, onChange: setParentChat }}
            last
          />
        </SettingsCard>
      ) : null}

      <Note>We ask before sending anything to this device. Push messages need your permission in your phone’s settings.</Note>
    </AccountScreen>
  );
}
