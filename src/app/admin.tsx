import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen, StatusPill } from '@/components/ui';
import { demoPrograms, demoTeams } from '@/data/demo';
import { funnelCounts, getEvents } from '@/lib/analytics';
import { formatEventParts } from '@/lib/datetime';
import { ACTIVE_COACH } from '@/lib/coachRecap';
import { can } from '@/lib/capabilities';
import { canWaive, paymentLine, statusWord } from '@/lib/registrationFlow';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type AdminTab = 'registrations' | 'announcements' | 'teams' | 'games';

export default function AdminScreen() {
  const {
    role,
    registrations,
    schedule,
    announcements,
    decideRegistration,
    waiveRegistrationFee,
    updateEventResult,
    assignRegistrationTeam,
    setFieldStatus,
    upsertEvent,
    recaps,
    managerCanSendRecap,
    setManagerCanSendRecap,
  } = useApp();
  const [tab, setTab] = useState<AdminTab>(can(role, 'review_registrations') ? 'registrations' : 'announcements');
  const [result, setResult] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [funnelStats, setFunnelStats] = useState<{ views: number; starts: number; done: number } | null>(null);
  const [reasonFor, setReasonFor] = useState<{ id: string; kind: 'reject' | 'waive' } | null>(null);
  const allowed = role === 'admin' || role === 'coach' || role === 'competition_manager';
  const canReview = can(role, 'review_registrations');
  const canEditSchedule = can(role, 'edit_schedules');
  const assignedEvents = schedule.filter((event) => (role === 'coach' ? event.teamId === 'nova-royals-kids-u8' : Boolean(event.teamId)));

  useEffect(() => {
    getEvents().then((events) => {
      const counts = funnelCounts(events);
      setFunnelStats({ views: counts.programViewed, starts: counts.registrationStarted, done: counts.registrationCompleted });
    });
  }, [registrations]);

  if (!allowed) {
    return (
      <Screen contentStyle={styles.denied}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.orange} />
        <Text style={styles.deniedTitle}>Staff access required</Text>
        <Text style={styles.deniedCopy}>Management routes are role protected in the client and reinforced by row-level security in Supabase.</Text>
        <Button label="Return to profile" onPress={() => router.replace('/(tabs)/profile')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/profile')} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <View style={styles.flex}><Text style={styles.eyebrow}>ROLE-PROTECTED · DEMO</Text><Text style={styles.title}>{role === 'coach' ? 'U8 staff tools' : 'Club management'}</Text></View>
        <View style={styles.adminMark}><Text style={styles.adminText}>A</Text></View>
      </View>

      <View style={styles.metrics}>
        {canReview ? <Metric value={String(registrations.length)} label="REGISTRATIONS" /> : <Metric value="U8" label="ASSIGNED TEAM" />}
        <Metric value={String(role === 'coach' ? 1 : demoTeams.length)} label="TEAMS" />
        {canReview ? (
          <Metric value={funnelStats ? `${funnelStats.done}/${funnelStats.starts}` : '—'} label="SIGN-UPS DONE / STARTED" />
        ) : (
          <Metric value="Staff" label="SCOPED ACCESS" />
        )}
      </View>

      {can(role, 'audit_coach_updates') ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coach update delivery</Text>
          <Text style={styles.sectionCopy}>Guardians see only their household. Child logins do not receive these notes. Managers send only with an explicit grant.</Text>
          {recaps.filter((item) => item.status === 'sent').map((item) => (
            <Text key={item.id} style={styles.sectionCopy}>
              {item.coachName} · {item.recipientCount} families · {item.deliveryStatus ?? 'delivered'}
            </Text>
          ))}
          {!recaps.some((item) => item.status === 'sent') ? <Text style={styles.sectionCopy}>No recaps sent yet.</Text> : null}
          <Button
            label={managerCanSendRecap ? 'Revoke manager send' : 'Grant manager send'}
            variant="secondary"
            onPress={() => setManagerCanSendRecap(!managerCanSendRecap)}
          />
        </View>
      ) : null}

      <View style={styles.tabs}>
        {(
          [
            canReview ? (['registrations', 'Registrations'] as const) : null,
            can(role, 'send_announcement') ? (['announcements', 'Announcements'] as const) : null,
            canReview || role === 'admin' ? (['teams', 'Teams'] as const) : null,
            ['games', 'Games'] as const,
          ].filter(Boolean) as [AdminTab, string][]
        ).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'registrations' && canReview && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration review</Text>
          <Text style={styles.sectionCopy}>Approving asks the family to pay. Every decision is recorded with who made it. Demo mode keeps changes on this device.</Text>
          {registrations.map((registration) => {
            const open = reasonFor?.id === registration.id ? reasonFor : null;
            return (
              <View key={registration.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{demoPrograms.find((program) => program.id === registration.programId)?.title}</Text>
                    <Text style={styles.cardMeta}>{registration.participantNames.join(', ')}</Text>
                    <Text style={styles.cardMeta}>{paymentLine(registration)}</Text>
                  </View>
                  <StatusPill label={statusWord(registration.status)} tone={registration.status === 'approved' ? 'success' : registration.status === 'rejected' || registration.status === 'cancelled' ? 'danger' : 'warning'} />
                </View>
                <View style={styles.inline}>
                  <Button label="Approve" variant={registration.status === 'approved' ? 'primary' : 'secondary'} onPress={() => { setReasonFor(null); decideRegistration(registration.id, 'approve'); }} style={styles.flex} />
                  <Button label="Waitlist" variant="secondary" onPress={() => { setReasonFor(null); decideRegistration(registration.id, 'waitlist'); }} style={styles.flex} />
                  <Button label="Decline" variant="secondary" onPress={() => setReasonFor({ id: registration.id, kind: 'reject' })} style={styles.flex} />
                </View>
                <View style={styles.inline}>
                  {canWaive(registration) ? <Button label="Waive fee" variant="ghost" onPress={() => setReasonFor({ id: registration.id, kind: 'waive' })} /> : null}
                  {can(role, 'assign_child_team') ? (
                    <Button label="Assign U8" variant="ghost" onPress={() => assignRegistrationTeam(registration.id, 'nova-royals-kids-u8', ACTIVE_COACH.displayName)} />
                  ) : null}
                </View>
                {open ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.cardMeta}>{open.kind === 'reject' ? 'Why isn’t this registration going ahead?' : 'Why is the fee being waived?'}</Text>
                    <View style={styles.reasonRow}>
                      {(open.kind === 'reject' ? ['Program is full', 'Outside the age range', 'Duplicate registration'] : ['Scholarship', 'Volunteer family', 'Club decision']).map((reason) => (
                        <Pressable
                          key={reason}
                          accessibilityRole="button"
                          onPress={() => {
                            if (open.kind === 'reject') decideRegistration(registration.id, 'reject', reason);
                            else waiveRegistrationFee(registration.id, reason);
                            setReasonFor(null);
                          }}
                          style={styles.reasonChip}
                        >
                          <Text style={styles.reasonText}>{reason}</Text>
                        </Pressable>
                      ))}
                      <Pressable accessibilityRole="button" onPress={() => setReasonFor(null)} style={styles.reasonChip}>
                        <Text style={styles.reasonText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {tab === 'announcements' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Announcements</Text>
          <Text style={styles.sectionCopy}>
            Write to the whole club, or to specific teams. Cancellations take the session off the schedule and can’t be muted.
          </Text>
          <Button label="Write an announcement" icon="create-outline" onPress={() => router.push('/announcements/new' as never)} />
          <Button label="See all announcements" variant="secondary" icon="megaphone-outline" onPress={() => router.push('/announcements' as never)} style={styles.flexTop} />
          <Text style={styles.subheading}>Recently sent</Text>
          {announcements.slice(0, 5).map((announcement) => (
            <Pressable key={announcement.id} accessibilityRole="link" onPress={() => router.push(`/message/${announcement.id}` as never)} style={styles.announcement}>
              <Ionicons accessible={false} name="megaphone-outline" size={20} color={colors.orangeDark} />
              <View style={styles.flex}><Text style={styles.cardTitle}>{announcement.title}</Text><Text style={styles.cardMeta}>{announcement.scopeLabel} · {formatEventParts(announcement.publishedAt).month} {formatEventParts(announcement.publishedAt).day}</Text></View>
            </Pressable>
          ))}
        </View>
      )}

      {tab === 'teams' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Teams & rosters</Text>
          <Text style={styles.sectionCopy}>Managers see only teams granted through team_staff assignments.</Text>
          {demoTeams.map((team) => (
            <Pressable key={team.id} onPress={() => router.push(`/team/${team.id}`)} style={styles.team}>
              <View style={[styles.teamMark, { backgroundColor: team.accent }]}><Text style={styles.teamMarkText}>{team.shortName.slice(-2)}</Text></View>
              <View style={styles.flex}><Text style={styles.cardTitle}>{team.name}</Text><Text style={styles.cardMeta}>{team.memberCount} members · {team.competitionName}</Text></View>
              <Ionicons name="chevron-forward" size={18} color={colors.stone} />
            </Pressable>
          ))}
        </View>
      )}

      {tab === 'games' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game & result editor</Text>
          <Text style={styles.sectionCopy}>The first scheduled team match is available for demo editing.</Text>
          {assignedEvents.slice(0, 2).map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.cardMeta}>{event.venue} · {event.status}</Text>
              <Field label="Result / score line" value={event.id === schedule.find((item) => item.teamId)?.id ? result : event.result ?? ''} onChangeText={setResult} placeholder="ROYALS 2–1 OPPONENT" />
              <Button label="Save result" variant="secondary" disabled={!result} onPress={() => { updateEventResult(event.id, result); setResult(''); }} />
              {can(role, 'urgent_field_closure') ? (
                <Button label={event.fieldStatus === 'closed' ? 'Reopen field' : 'Close field'} variant="ghost" onPress={() => setFieldStatus(event.id, event.fieldStatus === 'closed' ? 'open' : 'closed')} />
              ) : null}
            </View>
          ))}
          {canEditSchedule ? (
            <View style={styles.form}>
              <Text style={styles.subheading}>ADD SESSION</Text>
              <Field label="Title" value={newTitle} onChangeText={setNewTitle} placeholder="Saturday training" />
              <Field label="Venue" value={newVenue} onChangeText={setNewVenue} placeholder="Sully Highlands" />
              <Button
                label="Save to club schedule"
                disabled={!newTitle || !newVenue}
                onPress={() => {
                  upsertEvent({
                    id: `event-${Date.now()}`,
                    type: 'training',
                    sport: 'soccer',
                    title: newTitle,
                    subtitle: 'Staff added · demo',
                    startsAt: new Date(Date.now() + 86400000).toISOString(),
                    venue: newVenue,
                    status: 'scheduled',
                    fieldStatus: 'open',
                    demo: true,
                  });
                  setNewTitle('');
                  setNewVenue('');
                }}
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  flexTop: { marginTop: spacing.sm },
  reasonBox: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.sand, gap: spacing.sm },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  reasonText: { color: colors.ink, fontSize: 12, ...typography.label },
  denied: { flex: 1, minHeight: 600, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  deniedTitle: { color: colors.ink, fontSize: 24, ...typography.heading },
  deniedCopy: { maxWidth: 400, color: colors.stone, textAlign: 'center', lineHeight: 21, ...typography.body },
  header: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: colors.orangeDark, fontSize: 9, ...typography.label, letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 25, ...typography.heading },
  adminMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  adminText: { color: colors.orange, ...typography.heading },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metric: { flex: 1, padding: 14, borderRadius: 22, backgroundColor: colors.ink },
  metricValue: { color: colors.white, fontSize: 24, ...typography.heading },
  metricLabel: { color: colors.mint, fontSize: 9, marginTop: 4, ...typography.label, letterSpacing: 0.8 },
  tabs: { flexDirection: 'row', marginTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.orange },
  tabText: { color: colors.stone, fontSize: 9, ...typography.label },
  tabTextActive: { color: colors.ink },
  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 22, ...typography.heading },
  sectionCopy: { color: colors.stone, fontSize: 12, marginTop: -spacing.sm, ...typography.body },
  card: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', gap: spacing.md },
  cardTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  cardMeta: { color: colors.stone, fontSize: 11, marginTop: 3, ...typography.body },
  inline: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  form: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  subheading: { color: colors.stone, fontSize: 10, marginTop: spacing.lg, ...typography.label, letterSpacing: 1 },
  announcement: { minHeight: 70, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  team: { minHeight: 76, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  teamMark: { width: 44, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  teamMarkText: { color: colors.white, fontSize: 12, ...typography.display },
});
