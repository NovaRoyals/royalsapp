import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AnnouncementCard } from '@/components/announcements/AnnouncementCard';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Screen } from '@/components/ui';
import { demoTeams } from '@/data/demo';
import {
  allowedTeamIds,
  AUDIENCE_TEAMS,
  canGoClubWide,
  canSendAnnouncement,
  emptyDraft,
  GROUPS,
  KINDS,
  REASONS,
  recipientEstimate,
  templateFor,
  toAnnouncement,
  upcomingSessions,
  validateDraft,
  type Draft,
} from '@/lib/announcements';
import { formatEventParts } from '@/lib/datetime';
import { safeBack } from '@/lib/nav';
import { useOutlook } from '@/services/forecast';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, tints, typography } from '@/theme/tokens';
import type { AnnouncementKind, AudienceGroup, ScheduleEvent } from '@/types/domain';

const KIND_ORDER: AnnouncementKind[] = ['update', 'schedule', 'cancellation', 'weather', 'reminder'];
const COUNTS = Object.fromEntries(demoTeams.map((team) => [team.id, team.memberCount]));

const dayWord = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
const sessionName = (event: ScheduleEvent) => `${dayWord(event.startsAt)}’s ${formatEventParts(event.startsAt).time} ${event.type === 'training' ? 'training' : 'match'}`;

export default function NewAnnouncementScreen() {
  const params = useLocalSearchParams<{ kind?: string; event?: string }>();
  const { role, schedule, publishAnnouncement } = useApp();
  const toast = useToast();

  const first = useMemo(() => schedule.find((event) => event.id === params.event), [params.event, schedule]);
  const [draft, setDraft] = useState<Draft>(() => {
    const base = emptyDraft(role);
    const kind = KIND_ORDER.includes(params.kind as AnnouncementKind) ? (params.kind as AnnouncementKind) : 'update';
    if (first?.teamId && allowedTeamIds(role).includes(first.teamId)) {
      return { ...base, kind, scope: 'teams', teamIds: [first.teamId], eventIds: [first.id], reason: kind === 'weather' ? 'Weather' : '' };
    }
    return { ...base, kind };
  });
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const touched = useRef(false);

  const sessions = useMemo(() => upcomingSessions(schedule, draft.teamIds), [draft.teamIds, schedule]);
  const chosen = useMemo(() => schedule.filter((event) => draft.eventIds.includes(event.id)), [draft.eventIds, schedule]);
  const lead = chosen[0];
  const { outlook } = useOutlook(lead);
  const needsSession = draft.kind === 'cancellation';
  const showSessions = draft.scope === 'teams' && ['cancellation', 'schedule', 'weather', 'reminder'].includes(draft.kind);

  // Fill in starting words, until the writer starts typing their own.
  const teamNames = draft.teamIds.map((id) => AUDIENCE_TEAMS.find((team) => team.id === id)?.label.split(' · ')[0]).filter(Boolean).join(' + ');
  const sessionWords = chosen.length === 0 ? undefined : chosen.length === 1 ? sessionName(chosen[0]) : `${chosen.length} sessions`;
  const weatherLine = outlook?.family ? `${outlook.family} We’ll update everyone here as soon as we decide.` : undefined;
  useEffect(() => {
    if (touched.current) return;
    const text = templateFor(draft.kind, { team: teamNames || 'your team', session: sessionWords, reason: draft.reason, weather: weatherLine });
    const body = draft.kind === 'weather' && weatherLine ? weatherLine : text.body;
    setDraft((current) => (current.title === text.title && current.body === body ? current : { ...current, title: text.title, body }));
  }, [draft.kind, draft.reason, sessionWords, teamNames, weatherLine]);

  const patch = (next: Partial<Draft>) => {
    setError(null);
    setConfirming(false);
    setDraft((current) => ({ ...current, ...next }));
  };
  const type = (next: Partial<Draft>) => {
    touched.current = true;
    patch(next);
  };

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);

  if (!canSendAnnouncement(role)) {
    return (
      <Screen>
        <Header />
        <EmptyState pose="lookLeft" title="Announcements are written by coaches and the club" message="You’ll see them under Announcements and in your notifications." action={<Button label="See announcements" onPress={() => router.replace('/announcements' as never)} />} />
      </Screen>
    );
  }

  const send = () => {
    const problem = validateDraft(draft, role);
    if (problem) {
      setError(problem);
      setConfirming(false);
      return;
    }
    if (draft.kind === 'cancellation' && !confirming) {
      setConfirming(true);
      return;
    }
    const result = publishAnnouncement(draft);
    if (!result.ok) {
      setError(result.error ?? 'That didn’t send. Try again.');
      return;
    }
    toast(draft.kind === 'cancellation' ? 'Cancelled and sent' : 'Announcement sent');
    router.replace('/announcements' as never);
  };

  const preview = { ...toAnnouncement(draft, { name: role === 'coach' ? 'Coach Sakchham Karki' : role === 'admin' ? 'Club office' : 'Team manager', role }), id: 'preview', publishedAt: new Date().toISOString() };
  const reach = recipientEstimate(draft, COUNTS);
  const teams = AUDIENCE_TEAMS.filter((team) => allowedTeamIds(role).includes(team.id));

  return (
    <Screen>
      <Header />

      <Section title="What kind?">
        <View style={styles.wrap}>
          {KIND_ORDER.map((kind) => {
            const meta = KINDS[kind];
            const on = draft.kind === kind;
            const tint = tints[meta.tint];
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${meta.label}. ${meta.blurb}`}
                onPress={() => {
                  touched.current = false;
                  patch({ kind, reason: kind === 'weather' ? 'Weather' : draft.reason, eventIds: kind === 'cancellation' || kind === 'schedule' || kind === 'weather' || kind === 'reminder' ? draft.eventIds : [] });
                }}
                style={[styles.kind, on && { backgroundColor: tint.bg, borderColor: tint.accent }]}
              >
                <Ionicons accessible={false} name={meta.icon} size={18} color={on ? tint.accent : colors.stone} />
                <Text style={[styles.kindText, on && { color: colors.ink }]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Who gets it?">
        {canGoClubWide(role) ? (
          <View accessibilityRole="tablist" style={styles.segment}>
            {([['club', 'Whole club'], ['teams', 'Specific teams']] as const).map(([id, label]) => (
              <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: draft.scope === id }} onPress={() => patch({ scope: id, eventIds: id === 'club' ? [] : draft.eventIds })} style={[styles.segmentItem, draft.scope === id && styles.segmentOn]}>
                <Text style={[styles.segmentText, draft.scope === id && styles.segmentTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {draft.scope === 'club' ? (
          <View style={styles.stack}>
            {GROUPS.map((group) => (
              <Check key={group.id} label={group.label} detail={group.detail} on={draft.groups.includes(group.id)} onPress={() => patch({ groups: toggle<AudienceGroup>(draft.groups, group.id) })} />
            ))}
          </View>
        ) : (
          <View style={styles.stack}>
            {teams.map((team) => (
              <Check
                key={team.id}
                label={team.label}
                detail={team.youth ? 'Parents and guardians' : 'Players'}
                on={draft.teamIds.includes(team.id)}
                onPress={() => patch({ teamIds: toggle(draft.teamIds, team.id), eventIds: [] })}
              />
            ))}
          </View>
        )}
        <Text style={styles.reach}>Goes to: {reach || 'no one yet'}</Text>
      </Section>

      {showSessions ? (
        <Section title={needsSession ? 'Which session is cancelled?' : 'About a session (optional)'}>
          {sessions.length === 0 ? (
            <Text style={styles.muted}>{draft.teamIds.length ? 'No upcoming sessions for those teams.' : 'Pick a team first.'}</Text>
          ) : (
            <View style={styles.stack}>
              {sessions.map((event) => {
                const parts = formatEventParts(event.startsAt);
                const on = draft.eventIds.includes(event.id);
                return (
                  <Pressable
                    key={event.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => patch({ eventIds: needsSession ? toggle(draft.eventIds, event.id) : on ? [] : [event.id] })}
                    style={[styles.row, on && styles.rowOn]}
                  >
                    <View style={[styles.box, on && styles.boxOn]}>{on ? <Ionicons accessible={false} name="checkmark" size={14} color={colors.white} /> : null}</View>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{parts.weekday} {parts.month} {parts.day} · {parts.time}</Text>
                      <Text numberOfLines={1} style={styles.rowDetail}>{event.title} · {event.venue}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          {outlook && lead ? (
            <View style={[styles.forecast, { backgroundColor: tints[outlook.level === 'good' ? 'mint' : outlook.level === 'watch' ? 'gold' : 'blush'].bg }]}>
              <Ionicons accessible={false} name={outlook.icon} size={18} color={colors.ink} />
              <Text style={styles.forecastText}>{outlook.summary} · {outlook.staff}</Text>
            </View>
          ) : null}
          {outlook?.level === 'risky' && draft.kind !== 'weather' && draft.kind !== 'cancellation' ? (
            <Pressable accessibilityRole="button" onPress={() => { touched.current = false; patch({ kind: 'weather', reason: 'Weather' }); }} style={styles.suggest}>
              <Text style={styles.suggestText}>Use the weather heads-up wording</Text>
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      {draft.kind === 'cancellation' ? (
        <Section title="Why?">
          <View style={styles.wrap}>
            {REASONS.map((reason) => (
              <Pressable key={reason} accessibilityRole="button" accessibilityState={{ selected: draft.reason === reason }} onPress={() => { touched.current = false; patch({ reason }); }} style={[styles.chip, draft.reason === reason && styles.chipOn]}>
                <Text style={[styles.chipText, draft.reason === reason && styles.chipTextOn]}>{reason}</Text>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="The message">
        <Text style={styles.label}>Headline</Text>
        <TextInput accessibilityLabel="Headline" value={draft.title} onChangeText={(title) => type({ title })} placeholder="What’s this about?" placeholderTextColor={colors.stone} style={styles.input} maxLength={90} />
        <Text style={styles.label}>Message</Text>
        <TextInput accessibilityLabel="Message" value={draft.body} onChangeText={(body) => type({ body })} placeholder="Keep it clear and kind." placeholderTextColor={colors.stone} style={[styles.input, styles.multiline]} multiline maxLength={1300} />
        {draft.kind === 'update' || draft.kind === 'reminder' ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>Mark as important</Text>
              <Text style={styles.rowDetail}>Shows first on Home and is pushed to anyone with team alerts on. Use it sparingly.</Text>
            </View>
            <Switch accessibilityLabel="Mark as important" value={draft.important} onValueChange={(important) => patch({ important })} trackColor={{ true: colors.ink, false: colors.mintDeep }} thumbColor={colors.white} />
          </View>
        ) : null}
      </Section>

      <Section title="How it will look">
        <AnnouncementCard announcement={preview} preview lines={4} />
      </Section>

      {draft.kind === 'cancellation' ? (
        <Text style={styles.warning}>
          Sending will cancel {chosen.length === 1 ? 'this session' : `these ${chosen.length || ''} sessions`} on the schedule and alert {reach || 'everyone chosen'} right away. Cancellation alerts can’t be muted.
        </Text>
      ) : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

      <Button
        label={confirming ? 'Yes, cancel and send' : draft.kind === 'cancellation' ? 'Review and send' : 'Send announcement'}
        icon={confirming ? 'close-circle-outline' : 'send-outline'}
        onPress={send}
        style={styles.send}
      />
      {confirming ? <Button label="Keep editing" variant="ghost" onPress={() => setConfirming(false)} /> : null}
    </Screen>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/announcements' as never)} style={styles.back}>
        <Ionicons name="arrow-back" size={21} color={colors.ink} />
      </Pressable>
      <Text style={styles.title}>New announcement</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Check({ label, detail, on, onPress }: { label: string; detail?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={[styles.row, on && styles.rowOn]}>
      <View style={[styles.box, on && styles.boxOn]}>{on ? <Ionicons accessible={false} name="checkmark" size={14} color={colors.white} /> : null}</View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{label}</Text>
        {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.ink, fontSize: 22, ...typography.pageTitle },
  section: { marginTop: 14, gap: 8 },
  sectionTitle: { color: colors.stone, fontSize: 11, marginLeft: 6, ...typography.label, letterSpacing: 1.1, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.border },
  kindText: { color: colors.stone, fontSize: 13, ...typography.label },
  segment: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 16, padding: 4 },
  segmentItem: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: colors.ink },
  segmentText: { color: colors.stone, fontSize: 13, ...typography.label },
  segmentTextOn: { color: colors.white },
  stack: { gap: 6 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1.5, borderColor: 'transparent' },
  rowOn: { borderColor: colors.ink, backgroundColor: colors.mint },
  rowTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  rowDetail: { color: colors.stone, fontSize: 12, lineHeight: 17, marginTop: 1, ...typography.body },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.mintDeep, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  reach: { color: colors.charcoal, fontSize: 13, marginLeft: 6, ...typography.bodyMedium },
  muted: { color: colors.stone, fontSize: 13, ...typography.body },
  forecast: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 18 },
  forecastText: { flex: 1, color: colors.charcoal, fontSize: 13, lineHeight: 18, ...typography.body },
  suggest: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.sky },
  suggestText: { color: colors.info, fontSize: 13, ...typography.label },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.ink },
  chipText: { color: colors.charcoal, fontSize: 13, ...typography.label },
  chipTextOn: { color: colors.white },
  label: { color: colors.stone, fontSize: 12, marginLeft: 6, ...typography.label },
  input: { minHeight: 48, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 15, ...typography.body },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.paper },
  warning: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 12, ...typography.bodyMedium },
  error: { color: colors.danger, fontSize: 13, marginTop: 10, ...typography.label },
  send: { marginTop: 14 },
});
