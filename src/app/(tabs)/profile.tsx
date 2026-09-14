import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Button, DemoBadge, Screen, SectionHeading, StatusPill } from '@/components/ui';
import { demoPrograms } from '@/data/demo';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { UserRole } from '@/types/domain';

const roleLabels: Record<UserRole, string> = {
  guest: 'Guest',
  adult_player: 'Adult player',
  guardian: 'Parent / guardian',
  coach: 'Coach / manager',
  competition_manager: 'Competition manager',
  admin: 'Club administrator',
};

const menu = [
  { icon: 'person-outline' as const, label: 'Personal information', detail: 'Name, phone, address' },
  { icon: 'card-outline' as const, label: 'Payments', detail: 'Receipts and status' },
  { icon: 'document-text-outline' as const, label: 'Waivers & consents', detail: 'Signed documents' },
  { icon: 'notifications-outline' as const, label: 'Notification settings', detail: 'Reminders and alerts' },
];

export default function ProfileScreen() {
  const { role, setRole, household, registrations, resetDemo } = useApp();
  const isStaff = role === 'coach' || role === 'competition_manager' || role === 'admin';

  return (
    <Screen>
      <AppHeader eyebrow="Account" title="Profile" />
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{role === 'guest' ? 'G' : household.guardianName.split(' ').map((part) => part[0]).join('')}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{role === 'guest' ? 'Guest visitor' : household.guardianName}</Text>
          <Text style={styles.role}>{roleLabels[role]}</Text>
          <DemoBadge />
        </View>
        <Pressable accessibilityLabel="Edit profile" style={styles.editButton}>
          <Ionicons name="pencil" size={17} color={colors.ink} />
        </Pressable>
      </View>

      {role === 'guest' ? (
        <View style={styles.signInCard}>
          <Text style={styles.signInTitle}>Make ROYALS yours</Text>
          <Text style={styles.signInCopy}>Save programs, register your family and keep every fixture in one place.</Text>
          <Button label="Create account or sign in" onPress={() => router.push('/onboarding')} />
        </View>
      ) : (
        <>
          <SectionHeading title="Household" />
          <View style={styles.children}>
            {household.children.map((child) => (
              <View key={child.id} style={styles.childRow}>
                <View style={styles.childAvatar}><Text style={styles.childInitial}>{child.firstName[0]}</Text></View>
                <View style={styles.flex}>
                  <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
                  <Text style={styles.privateText}>Birth date kept private · Managed by you</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.stone} />
              </View>
            ))}
            <Pressable onPress={() => router.push('/registration/fall-kids-2026')} style={styles.addChild}>
              <Ionicons name="add-circle-outline" size={20} color={colors.orangeDark} />
              <Text style={styles.addChildText}>Add a child</Text>
            </Pressable>
          </View>

          <SectionHeading title="Registrations" />
          <View style={styles.registrations}>
            {registrations.map((registration) => {
              const program = demoPrograms.find((item) => item.id === registration.programId);
              return (
                <View key={registration.id} style={styles.registration}>
                  <View style={styles.registrationTop}>
                    <View style={styles.flex}>
                      <Text style={styles.registrationTitle}>{program?.title ?? 'Program registration'}</Text>
                      <Text style={styles.registrationPeople}>{registration.participantNames.join(', ')}</Text>
                    </View>
                    <StatusPill
                      label={registration.status}
                      tone={registration.status === 'approved' ? 'success' : 'warning'}
                    />
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Payment</Text>
                    <Text style={styles.paymentValue}>${registration.amountDue} · {registration.paymentStatus}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}

      {isStaff && (
        <>
          <SectionHeading title="Club tools" />
          <Pressable onPress={() => router.push('/admin')} style={styles.adminCard}>
            <View style={styles.adminIcon}><Ionicons name="settings-outline" size={22} color={colors.white} /></View>
            <View style={styles.flex}>
              <Text style={styles.adminTitle}>Open management</Text>
              <Text style={styles.adminCopy}>Registrations, teams, games and announcements</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.orange} />
          </Pressable>
        </>
      )}

      <SectionHeading title="Account & settings" />
      <View style={styles.menu}>
        {menu.map((item, index) => (
          <Pressable key={item.label} style={[styles.menuRow, index < menu.length - 1 && styles.menuBorder]}>
            <Ionicons name={item.icon} size={21} color={colors.orangeDark} />
            <View style={styles.flex}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuDetail}>{item.detail}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.stone} />
          </Pressable>
        ))}
      </View>

      <SectionHeading title="Preview roles" />
      <Text style={styles.previewNote}>Demo-only controls for reviewing role-aware experiences.</Text>
      <View style={styles.roleGrid}>
        {(['guest', 'guardian', 'adult_player', 'coach', 'admin'] as UserRole[]).map((item) => (
          <Pressable key={item} onPress={() => setRole(item)} style={[styles.roleChip, role === item && styles.roleActive]}>
            <Text style={[styles.roleChipText, role === item && styles.roleActiveText]}>{roleLabels[item]}</Text>
          </Pressable>
        ))}
      </View>
      <Button label="Reset demo data" variant="ghost" onPress={resetDemo} style={styles.reset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 20, ...typography.heading },
  identityCopy: { flex: 1, gap: 3 },
  name: { color: colors.white, fontSize: 20, ...typography.heading },
  role: { color: colors.sand, fontSize: 12, ...typography.body },
  editButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  signInCard: { marginTop: spacing.xl, padding: spacing.xl, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.paper },
  signInTitle: { color: colors.ink, fontSize: 22, ...typography.heading },
  signInCopy: { color: colors.stone, lineHeight: 21, ...typography.body },
  children: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.paper },
  childRow: { minHeight: 72, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  childAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.orangeSoft },
  childInitial: { color: colors.orangeDark, ...typography.heading },
  flex: { flex: 1 },
  childName: { color: colors.ink, fontSize: 15, ...typography.heading },
  privateText: { color: colors.stone, fontSize: 11, marginTop: 2, ...typography.body },
  addChild: { minHeight: 54, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addChildText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  registrations: { gap: spacing.md },
  registration: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  registrationTop: { flexDirection: 'row', gap: spacing.md },
  registrationTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  registrationPeople: { color: colors.stone, fontSize: 12, marginTop: 3, ...typography.body },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  paymentLabel: { color: colors.stone, fontSize: 11, ...typography.label },
  paymentValue: { color: colors.charcoal, fontSize: 11, textTransform: 'capitalize', ...typography.label },
  adminCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  adminIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  adminTitle: { color: colors.white, fontSize: 16, ...typography.heading },
  adminCopy: { color: colors.sand, fontSize: 11, marginTop: 3, ...typography.body },
  menu: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.paper },
  menuRow: { minHeight: 66, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { color: colors.ink, fontSize: 14, ...typography.heading },
  menuDetail: { color: colors.stone, fontSize: 11, marginTop: 2, ...typography.body },
  previewNote: { color: colors.stone, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md, ...typography.body },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  roleActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  roleChipText: { color: colors.charcoal, fontSize: 11, ...typography.label },
  roleActiveText: { color: colors.white },
  reset: { marginTop: spacing.lg },
});
