import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen, StatusPill } from '@/components/ui';
import { demoPrograms, demoTeams } from '@/data/demo';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type AdminTab = 'registrations' | 'announcements' | 'teams' | 'games';

export default function AdminScreen() {
  const { role, registrations, schedule, announcements, updateRegistrationStatus, updateEventResult, createAnnouncement } = useApp();
  const [tab, setTab] = useState<AdminTab>('registrations');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState('');
  const allowed = role === 'admin' || role === 'coach' || role === 'competition_manager';

  if (!allowed) {
    return (
      <Screen contentStyle={styles.denied}>
        <Ionicons name="lock-closed" size={40} color={colors.orange} />
        <Text style={styles.deniedTitle}>Staff access required</Text>
        <Text style={styles.deniedCopy}>Management routes are role protected in the client and reinforced by row-level security in Supabase.</Text>
        <Button label="Return to profile" onPress={() => router.replace('/(tabs)/profile')} />
      </Screen>
    );
  }

  const publish = () => {
    if (!title.trim() || !body.trim()) return;
    createAnnouncement({ title, body, audience: 'club', scopeLabel: 'Nova Royals' });
    setTitle('');
    setBody('');
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <View style={styles.flex}><Text style={styles.eyebrow}>ROLE-PROTECTED · DEMO</Text><Text style={styles.title}>Club management</Text></View>
        <View style={styles.adminMark}><Text style={styles.adminText}>A</Text></View>
      </View>

      <View style={styles.metrics}>
        <Metric value={String(registrations.length)} label="REGISTRATIONS" />
        <Metric value={String(demoTeams.length)} label="TEAMS" />
        <Metric value={String(schedule.length)} label="EVENTS" />
      </View>

      <View style={styles.tabs}>
        {([
          ['registrations', 'Registrations'],
          ['announcements', 'Announcements'],
          ['teams', 'Teams'],
          ['games', 'Games'],
        ] as [AdminTab, string][]).map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'registrations' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registration review</Text>
          <Text style={styles.sectionCopy}>Status changes persist locally in demo mode.</Text>
          {registrations.map((registration) => (
            <View key={registration.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{demoPrograms.find((program) => program.id === registration.programId)?.title}</Text>
                  <Text style={styles.cardMeta}>{registration.participantNames.join(', ')} · ${registration.amountDue}</Text>
                </View>
                <StatusPill label={registration.status} tone={registration.status === 'approved' ? 'success' : 'warning'} />
              </View>
              <View style={styles.inline}>
                <Button label="Approve" variant={registration.status === 'approved' ? 'primary' : 'secondary'} onPress={() => updateRegistrationStatus(registration.id, 'approved')} style={styles.flex} />
                <Button label="Waitlist" variant="secondary" onPress={() => updateRegistrationStatus(registration.id, 'waitlisted')} style={styles.flex} />
              </View>
            </View>
          ))}
        </View>
      )}

      {tab === 'announcements' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Publish announcement</Text>
          <Text style={styles.sectionCopy}>Club-wide by default. Team and program audiences share the same model.</Text>
          <View style={styles.form}>
            <Field label="Headline" value={title} onChangeText={setTitle} placeholder="What should members know?" />
            <Field label="Message" value={body} onChangeText={setBody} multiline numberOfLines={4} placeholder="Keep it clear and actionable." />
            <Button label="Publish demo announcement" icon="megaphone-outline" disabled={!title || !body} onPress={publish} />
          </View>
          <Text style={styles.subheading}>Published</Text>
          {announcements.map((announcement) => (
            <View key={announcement.id} style={styles.announcement}>
              <Ionicons name="megaphone-outline" size={20} color={colors.orangeDark} />
              <View style={styles.flex}><Text style={styles.cardTitle}>{announcement.title}</Text><Text style={styles.cardMeta}>{announcement.scopeLabel} · {new Date(announcement.publishedAt).toLocaleDateString()}</Text></View>
            </View>
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
          {schedule.filter((event) => event.teamId).slice(0, 2).map((event) => (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.title}</Text>
              <Text style={styles.cardMeta}>{event.venue} · {event.status}</Text>
              <Field label="Result / score line" value={event.id === schedule.find((item) => item.teamId)?.id ? result : event.result ?? ''} onChangeText={setResult} placeholder="ROYALS 2–1 OPPONENT" />
              <Button label="Save result" variant="secondary" disabled={!result} onPress={() => { updateEventResult(event.id, result); setResult(''); }} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
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
  metric: { flex: 1, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.ink },
  metricValue: { color: colors.white, fontSize: 24, ...typography.heading },
  metricLabel: { color: colors.stone, fontSize: 7, marginTop: 4, ...typography.label, letterSpacing: 0.7 },
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
