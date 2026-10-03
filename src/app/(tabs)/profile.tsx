import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Button, DemoBadge, Screen, SectionHeading, StatusPill } from '@/components/ui';
import { SeasonDots } from '@/components/interactions/SeasonDots';
import { demoPrograms, followCatalog } from '@/data/demo';
import { funnelCounts, getEvents } from '@/lib/analytics';
import { paymentLine, statusWord } from '@/lib/registrationFlow';
import { mayaAttendanceHistory } from '@/lib/attendance';
import { sessionIdentity } from '@/lib/coachRecap';
import { can, isStaff } from '@/lib/capabilities';
import { showReviewerLabs } from '@/lib/prototype';
import { isDemoMode } from '@/lib/supabase';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { UserRole } from '@/types/domain';
import { useEffect, useState } from 'react';

const roleLabels: Record<UserRole, string> = {
  guest: 'Guest',
  adult_player: 'Adult player',
  guardian: 'Parent / guardian',
  coach: 'Coach / manager',
  volunteer: 'Volunteer',
  competition_manager: 'Team manager',
  admin: 'Club administrator',
};

const menu = [
  { icon: 'person-outline' as const, label: 'Personal information', detail: 'Name, phone, address', href: '/account/personal' },
  { icon: 'card-outline' as const, label: 'Payments', detail: 'Receipts and status', href: '/account/payments' },
  { icon: 'document-text-outline' as const, label: 'Waivers & consents', detail: 'Signed documents', href: '/account/waivers' },
  { icon: 'notifications-outline' as const, label: 'Notification settings', detail: 'Reminders and alerts', href: '/account/notifications' },
  { icon: 'heart-outline' as const, label: 'About the club', detail: 'Story, contact, support', href: '/about' },
];

export default function ProfileScreen() {
  const {
    role,
    setRole,
    household,
    registrations,
    resetDemo,
    documents,
    notificationPrefs,
    setNotificationPrefs,
    followedIds,
    setFollowedIds,
    persona,
    schedule,
    pendingStaffRole,
  } = useApp();
  const staff = isStaff(role);
  const parentView = role === 'guardian';
  const [funnel, setFunnel] = useState<ReturnType<typeof funnelCounts> | null>(null);
  const kidsEvent = schedule.find((event) => event.id === 'kids-2026-09-20');
  const recorded = kidsEvent?.checkIns ?? [];
  const presentNow = recorded.filter((item) => item.present).length;
  const unrecorded = Math.max(0, 17 - recorded.length);

  useEffect(() => {
    getEvents().then((events) => setFunnel(funnelCounts(events)));
  }, [registrations]);

  return (
    <Screen tabScene>
      <AppHeader eyebrow="Account" title="Profile" />
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{role === 'guest' ? 'G' : household.guardianName.split(' ').map((part) => part[0]).join('')}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{role === 'guest' ? 'Guest visitor' : household.guardianName}</Text>
          <Text style={styles.role}>
            {pendingStaffRole === 'coach'
              ? 'Coach · pending review'
              : pendingStaffRole === 'competition_manager'
                ? 'Manager · pending review'
                : roleLabels[role]}
          </Text>
          <DemoBadge />
        </View>
        {role === 'guest' ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => router.push('/account/personal' as never)} style={styles.editButton}>
            <Ionicons accessible={false} importantForAccessibility="no" name="pencil-outline" size={17} color={colors.ink} />
          </Pressable>
        )}
      </View>

      {pendingStaffRole ? (
        <View style={styles.signInCard}>
          <Text style={styles.signInTitle}>Staff access requested</Text>
          <Text style={styles.signInCopy}>
            {pendingStaffRole === 'coach' ? 'Coach' : 'Manager'} tools are not unlocked from onboarding. An admin still needs to approve this account.
          </Text>
        </View>
      ) : null}

      {role === 'guest' ? (
        <View style={styles.signInCard}>
          <Text style={styles.signInTitle}>Make ROYALS yours</Text>
          <Text style={styles.signInCopy}>Save programs, register your family and keep every fixture in one place.</Text>
          <Button label="Create account or sign in" onPress={() => router.push('/onboarding')} />
        </View>
      ) : (
        <>
          {parentView ? (
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
              </View>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Add a child" onPress={() => { if (can(role, 'register_child')) router.push('/registration/fall-kids-2026'); }} style={styles.addChild}>
              <Ionicons accessible={false} importantForAccessibility="no" name="add-circle-outline" size={20} color={colors.orangeDark} />
              <Text style={styles.addChildText}>Add a child</Text>
            </Pressable>
          </View>

          <SectionHeading title="Registrations" />
          <View style={styles.registrations}>
            {registrations.map((registration) => {
              const program = demoPrograms.find((item) => item.id === registration.programId);
              return (
                <View key={registration.id} style={styles.registration}>
                  <Pressable accessibilityRole="link" accessibilityLabel={`${program?.title ?? 'Program registration'}, ${registration.participantNames.join(', ')}`} onPress={() => router.push(`/season/${registration.id}` as never)}>
                    <View style={styles.registrationTop}>
                      <View style={styles.flex}>
                        <Text style={styles.registrationTitle}>{program?.title ?? 'Program registration'}</Text>
                        <Text style={styles.registrationPeople}>{registration.participantNames.join(', ')}</Text>
                      </View>
                      <StatusPill
                        label={statusWord(registration.status)}
                        tone={registration.status === 'approved' ? 'success' : 'warning'}
                      />
                    </View>
                    <View style={styles.paymentRow}>
                      <Text style={styles.paymentLabel}>Season hub</Text>
                      <Text style={styles.paymentValue}>{paymentLine(registration)}</Text>
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>
            </>
          ) : null}

          {parentView && persona === 'demo' ? (
            <>
              <SectionHeading title="Maya’s attendance" />
              <View style={styles.registration}>
                <SeasonDots history={mayaAttendanceHistory} childName="Maya" />
              </View>
            </>
          ) : null}

          {role === 'coach' || role === 'admin' ? (
            <>
              <SectionHeading title="Session recap" />
              <Pressable accessibilityRole="link" accessibilityLabel={`${kidsEvent ? sessionIdentity(kidsEvent).kicker : 'Session'} attendance`} onPress={() => router.push('/event/kids-2026-09-20')} style={styles.registration}>
                <Text style={styles.registrationTitle}>{kidsEvent ? sessionIdentity(kidsEvent).kicker : 'Session'} · attendance</Text>
                <Text style={styles.registrationPeople}>{presentNow} present · {unrecorded} not recorded</Text>
              </Pressable>
              <Pressable accessibilityRole="link" accessibilityLabel="Record session recap" onPress={() => router.push('/session/kids-2026-09-20/recap' as never)} style={styles.registration}>
                <Text style={styles.registrationTitle}>Record session recap</Text>
                <Text style={styles.registrationPeople}>Shared note for attending families</Text>
              </Pressable>
            </>
          ) : null}
          {parentView ? (
            <Pressable accessibilityRole="link" accessibilityLabel="Coach updates" onPress={() => router.push('/updates' as never)} style={styles.registration}>
              <Text style={styles.registrationTitle}>Coach updates</Text>
              <Text style={styles.registrationPeople}>Session recaps and notes about your child</Text>
            </Pressable>
          ) : null}

          {parentView ? (
            <>
          <SectionHeading title="Bills & documents" />
          <View style={styles.menu}>
            {documents.map((doc, index) => (
              <View key={doc.id} style={[styles.menuRow, index < documents.length - 1 && styles.menuBorder]}>
                <Ionicons accessible={false} importantForAccessibility="no" name={doc.kind === 'waiver' ? 'document-text-outline' : 'card-outline'} size={21} color={colors.orangeDark} />
                <View style={styles.flex}>
                  <Text style={styles.menuLabel}>{doc.title}</Text>
                  <Text style={styles.menuDetail}>{doc.status}</Text>
                </View>
              </View>
            ))}
          </View>
            </>
          ) : null}

          <SectionHeading title="Followed" />
          <View style={styles.roleGrid}>
            {followCatalog.map((item) => {
              const active = followedIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label}, ${active ? 'following' : 'not following'}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setFollowedIds(active ? followedIds.filter((id) => id !== item.id) : [...followedIds, item.id])}
                  style={[styles.roleChip, active && styles.roleActive]}
                >
                  <Text style={[styles.roleChipText, active && styles.roleActiveText]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionHeading title="Notification preferences" />
          <Pressable accessibilityRole="switch" accessibilityLabel="Team alerts" accessibilityState={{ checked: notificationPrefs.team }} onPress={() => setNotificationPrefs({ ...notificationPrefs, team: !notificationPrefs.team })} style={styles.menuRow}>
            <Text style={styles.menuLabel}>Team alerts {notificationPrefs.team ? 'on' : 'off'}</Text>
          </Pressable>
          <Pressable accessibilityRole="switch" accessibilityLabel="Community alerts" accessibilityState={{ checked: notificationPrefs.community }} onPress={() => setNotificationPrefs({ ...notificationPrefs, community: !notificationPrefs.community })} style={styles.menuRow}>
            <Text style={styles.menuLabel}>Community {notificationPrefs.community ? 'on' : 'off'}</Text>
          </Pressable>
          <Pressable accessibilityRole="switch" accessibilityLabel="Location for travel" accessibilityState={{ checked: notificationPrefs.locationShare }} onPress={() => setNotificationPrefs({ ...notificationPrefs, locationShare: !notificationPrefs.locationShare })} style={styles.menuRow}>
            <Text style={styles.menuLabel}>Location for travel {notificationPrefs.locationShare ? 'on' : 'off'}</Text>
          </Pressable>
          <Text style={styles.previewNote}>Location stays opt-in. Drive times remain a Fairfax stub until maps are connected. Urgent field closures always appear in-app.</Text>
        </>
      )}

      {staff && (
        <>
          <SectionHeading title={role === 'admin' ? 'Club tools' : 'Staff tools'} />
          <Pressable accessibilityRole="link" accessibilityLabel={role === 'coach' ? 'Open team tools' : 'Open management'} onPress={() => router.push('/admin')} style={styles.adminCard}>
            <View style={styles.adminIcon}><Ionicons accessible={false} importantForAccessibility="no" name="settings-outline" size={22} color={colors.white} /></View>
            <View style={styles.flex}>
              <Text style={styles.adminTitle}>{role === 'coach' ? 'Open team tools' : 'Open management'}</Text>
              <Text style={styles.adminCopy}>
                {role === 'coach'
                  ? 'Attendance, team messages, and assigned-session tools. Club registrations stay with administrators.'
                  : funnel
                    ? `Funnel · views ${funnel.programViewed} · starts ${funnel.registrationStarted} · completions ${funnel.registrationCompleted}`
                    : 'Registrations, fields, attendance, announcements'}
              </Text>
            </View>
            <Ionicons accessible={false} importantForAccessibility="no" name="arrow-forward" size={20} color={colors.orange} />
          </Pressable>
        </>
      )}

      <SectionHeading title="Account & settings" />
      <View style={styles.menu}>
        {(role === 'guest' ? menu.filter((item) => item.href === '/about') : menu).map((item, index, items) => (
          <Pressable
            key={item.label}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            onPress={() => router.push(item.href as never)}
            style={[styles.menuRow, index < items.length - 1 && styles.menuBorder]}
          >
            <Ionicons accessible={false} importantForAccessibility="no" name={item.icon} size={21} color={colors.orangeDark} />
            <View style={styles.flex}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuDetail}>{item.detail}</Text>
            </View>
            <Ionicons accessible={false} importantForAccessibility="no" name="chevron-forward" size={17} color={colors.stone} />
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="link" accessibilityLabel="About ROYALS" onPress={() => router.push('/about')} style={[styles.adminCard, { marginTop: 12 }]}>
        <View style={styles.flex}>
          <Text style={styles.adminTitle}>About ROYALS</Text>
          <Text style={styles.adminCopy}>About, Support Us, Sponsors, Volunteer, Contact</Text>
        </View>
        <Ionicons accessible={false} importantForAccessibility="no" name="arrow-forward" size={20} color={colors.orange} />
      </Pressable>

      {isDemoMode ? (
        <View style={styles.reviewBlock}>
          <SectionHeading title="Preview roles" />
          <Text style={styles.previewNote}>Board review only. These chips load a seeded household and are separate from account settings.</Text>
          {showReviewerLabs ? (
            <>
              <Pressable accessibilityRole="link" accessibilityLabel="Open Interaction Lab" onPress={() => router.push('/lab')} style={[styles.adminCard, { marginBottom: 16 }]}>
                <View style={styles.flex}>
                  <Text style={styles.adminTitle}>Open Interaction Lab</Text>
                  <Text style={styles.adminCopy}>Compare RSVP, supporter, attendance and calendar variants. Not in tab navigation.</Text>
                </View>
                <Ionicons accessible={false} importantForAccessibility="no" name="flask-outline" size={20} color={colors.orange} />
              </Pressable>
              <Pressable accessibilityRole="link" accessibilityLabel="Open Roy Lab" onPress={() => router.push('/roy' as never)} style={[styles.adminCard, { marginBottom: 16 }]}>
                <View style={styles.flex}>
                  <Text style={styles.adminTitle}>Open Roy Lab</Text>
                  <Text style={styles.adminCopy}>Preview idle, enter, wave, point, celebrate, bounce, and exit. Not in tab navigation.</Text>
                </View>
                <Ionicons accessible={false} importantForAccessibility="no" name="sparkles-outline" size={20} color={colors.orange} />
              </Pressable>
            </>
          ) : null}
          <View style={styles.roleGrid}>
            {(['guest', 'guardian', 'adult_player', 'coach', 'competition_manager', 'volunteer', 'admin'] as UserRole[]).map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`Preview as ${roleLabels[item]}`}
                accessibilityState={{ selected: role === item }}
                onPress={() => setRole(item)}
                style={[styles.roleChip, role === item && styles.roleActive]}
              >
                <Text style={[styles.roleChipText, role === item && styles.roleActiveText]}>{roleLabels[item]}</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Reset demo data" variant="ghost" onPress={resetDemo} style={styles.reset} />
        </View>
      ) : null}
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
  reviewBlock: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  previewNote: { color: colors.stone, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md, ...typography.body },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  roleActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  roleChipText: { color: colors.charcoal, fontSize: 11, ...typography.label },
  roleActiveText: { color: colors.white },
  reset: { marginTop: spacing.lg },
  history: { marginTop: spacing.md, gap: spacing.xs },
  historyRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
