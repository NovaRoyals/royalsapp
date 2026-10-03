import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RegistrationLadder } from '@/components/interactions/RegistrationLadder';
import { Button, Screen, StatusPill } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { calendarGateway } from '@/services/calendar';
import { demoPrograms, demoRegistrations, demoTeams } from '@/data/demo';
import { formatEventParts } from '@/lib/datetime';
import { safeBack } from '@/lib/nav';
import { money, paymentLine, registrationLadder } from '@/lib/registrationFlow';
import { paymentGateway } from '@/services/payments';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return demoRegistrations.map((item) => ({ registrationId: item.id }));
}

export default function SeasonHubScreen() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const { registrations, schedule, household, role } = useApp();
  const toast = useToast();
  const allowed = role === 'guardian' || role === 'admin';
  const registration = allowed ? registrations.find((item) => item.id === registrationId) ?? registrations[0] : undefined;
  const program = demoPrograms.find((item) => item.id === registration?.programId);
  const team = demoTeams.find((item) => item.id === registration?.teamId);
  const first = schedule.find((event) => event.id === registration?.firstSessionEventId) ?? schedule.find((event) => event.programId === registration?.programId);
  const parts = first ? formatEventParts(first.startsAt) : null;
  const assigned = Boolean(registration?.teamId);
  const ladder = registration ? registrationLadder(registration) : null;
  const [paying, setPaying] = useState(false);

  async function startPayment() {
    if (!registration || paying) return;
    setPaying(true);
    try {
      const result = await paymentGateway.beginCheckout({ registrationId: registration.id });
      if (result.kind === 'unavailable') toast(result.message);
      else await WebBrowser.openBrowserAsync(result.url);
    } finally {
      setPaying(false);
    }
  }

  if (!allowed) {
    return (
      <Screen contentStyle={styles.empty}>
        <Text style={styles.kicker}>FIRST SESSION</Text>
        <Text style={styles.title}>First session: Sunday 9:00 AM · Arrowhead 3A</Text>
        <Text style={styles.gateCopy}>Create an account to unlock your briefing — coach, kit, and the path through 11 Sundays.</Text>
        <Button label="Create an account" onPress={() => router.replace('/onboarding')} />
        <Button label="Browse programs" variant="secondary" onPress={() => router.replace('/(tabs)/programs')} />
      </Screen>
    );
  }

  if (!registration || !ladder) {
    return (
      <Screen contentStyle={styles.empty}>
        <Text style={styles.title}>No season yet</Text>
        <Button label="Browse programs" onPress={() => router.replace('/(tabs)/programs')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/programs')} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <View style={styles.flex}><Text style={styles.eyebrow}>SEASON HUB</Text><Text style={styles.topTitle}>{program?.title ?? 'Your season'}</Text></View>
      </View>

      <View style={styles.hero}>
        <StatusPill label={ladder.headline} tone={ladder.tone === 'danger' ? 'danger' : ladder.tone === 'success' ? 'success' : ladder.tone === 'warning' ? 'warning' : 'neutral'} />
        <Text style={styles.heroTitle}>{registration.participantNames.join(' & ')}</Text>
        <Text style={styles.heroBody}>{ladder.detail}</Text>
      </View>

      <RegistrationLadder ladder={ladder} />
      {ladder.actionable ? (
        <View style={styles.payBlock}>
          <Button
            label={registration.paymentStatus === 'failed' ? `Try again · ${money(registration.amountDue)}` : `Pay ${money(registration.amountDue)}`}
            icon="card-outline"
            loading={paying}
            onPress={startPayment}
          />
        </View>
      ) : null}

      <HubRow icon="card-outline" label="Payment" value={paymentLine(registration)} />
      <HubRow icon="shirt-outline" label="Team assignment" value={assigned ? team?.name ?? 'Assigned' : 'Not assigned yet'} />
      <HubRow icon="person-outline" label="Coach" value={registration.coachName ?? team?.coachName ?? 'Assigned after grouping'} />
      <HubRow
        icon="calendar-outline"
        label="First session"
        value={first ? `${parts?.weekday} ${parts?.time} · ${first.venue}` : 'Publishes with the season calendar'}
      />
      <HubRow icon="bag-outline" label="What to bring" value={first?.whatToBring ?? program?.whatToBring?.join(', ') ?? 'Coach will confirm'} />
      <HubRow icon="document-text-outline" label="Waiver / documents" value={registration.waiverVersion ? `Signed · ${registration.waiverVersion}` : 'On file'} last />

      <View style={styles.actions}>
        <Button
          label="Add season to calendar"
          icon="calendar-outline"
          onPress={() => {
            if (first) {
              calendarGateway.add(first);
              toast('Season session added · stub calendar');
            }
          }}
        />
        <Button
          label="Contact coach"
          variant="secondary"
          icon="chatbubble-outline"
          onPress={() => router.push('/message/announcement-3' as never)}
        />
        {first ? <Button label="Open first session" variant="ghost" onPress={() => router.push(`/event/${first.id}`)} /> : null}
      </View>
      <Text style={styles.privacy}>Youth details stay with {household.guardianName}. Coaches see first names only.</Text>
    </Screen>
  );
}

function HubRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.border]}>
      <View style={styles.icon}><Ionicons name={icon} size={20} color={colors.orangeDark} /></View>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  payBlock: { marginTop: spacing.md, marginBottom: spacing.lg },
  empty: { minHeight: 400, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  eyebrow: { color: colors.orangeDark, fontSize: 9, ...typography.label },
  topTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  title: { color: colors.ink, fontSize: 24, ...typography.heading },
  hero: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.ink, gap: spacing.sm, marginBottom: spacing.xl },
  heroTitle: { color: colors.white, fontSize: 28, ...typography.heading },
  heroBody: { color: colors.sand, fontSize: 13, lineHeight: 19, ...typography.body },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  border: { borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.stone, fontSize: 10, ...typography.label },
  value: { color: colors.ink, fontSize: 14, marginTop: 3, ...typography.heading },
  actions: { gap: spacing.sm, marginTop: spacing.xl },
  privacy: { color: colors.stone, fontSize: 11, marginTop: spacing.lg, ...typography.body },
  gateCopy: { color: colors.stone, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 360, ...typography.body },
  kicker: { color: colors.orangeDark, fontSize: 11, ...typography.label, letterSpacing: 1.2 },
});
