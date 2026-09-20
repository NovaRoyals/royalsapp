import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Screen, StatusPill } from '@/components/ui';
import { usePitchDay } from '@/hooks/useFieldCalendar';
import { clubNowPostedIso } from '@/lib/datetime';
import {
  DEFAULT_PITCH_TIME,
  PITCH_DISCLAIMER,
  clubDateFromPosted,
  conflictHeadline,
  formatTimeChip,
  formatUpdatedAgo,
  statusCopy,
} from '@/lib/fields';
import { safeBack } from '@/lib/nav';
import { locatePitches } from '@/lib/pitchCoords';
import { fetchCatalog } from '@/services/fields';
import { mapsDirectionsUrl } from '@/services/maps';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export async function generateStaticParams() {
  try {
    const catalog = await fetchCatalog();
    return catalog.map((item) => ({ id: item.id }));
  } catch {
    return [];
  }
}

export default function PitchDetailScreen() {
  const { id, date: dateParam, time: timeParam } = useLocalSearchParams<{ id: string; date?: string; time?: string }>();
  const date = dateParam || clubDateFromPosted(clubNowPostedIso());
  const time = timeParam || DEFAULT_PITCH_TIME;
  const day = usePitchDay(date, time, false);
  const located = locatePitches(day.data?.pitches ?? []);
  const pitch = located.find((item) => item.id === id);
  const suggested = day.data?.suggestionId === id;

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/fields')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topTitle}>{pitch?.name ?? 'Fields'}</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.hero}>
        <StatusPill
          label={pitch ? (pitch.status === 'conflict' ? conflictHeadline(pitch, time) : statusCopy(pitch.status)) : 'Pitch'}
          tone={pitch?.status === 'no_conflict' ? 'success' : 'warning'}
        />
        <Text style={styles.title}>{pitch?.name ?? 'Pitch'}</Text>
        <Text style={styles.meta}>{pitch ? `${pitch.pitch} · ${pitch.surface} · ${pitch.location}` : 'Loading catalog…'}</Text>
        <Text style={styles.when}>{formatTimeChip(time)} · {date}</Text>
        {suggested ? <Text style={styles.suggest}>Top pick for this time — not a hold on the pitch.</Text> : null}
      </View>

      <Text style={styles.updated}>{formatUpdatedAgo(day.data?.lastUpdated, day.data?.fromCache)}</Text>

      {day.data && !pitch ? (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={22} color={colors.info} />
          <Text style={styles.noteText}>This pitch isn’t in tonight’s catalog. Head back to Fields and pick another.</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>On the public calendar</Text>
        {pitch?.events.length ? (
          pitch.events.map((event, index) => (
            <View key={`${event.time}-${event.title}-${index}`} style={styles.event}>
              <Text style={styles.eventTime}>{event.time}</Text>
              <View style={styles.flex}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventSource}>{event.source}</Text>
                {event.sourceUrl ? (
                  <Pressable onPress={() => Linking.openURL(event.sourceUrl!).catch(() => undefined)}>
                    <Text style={styles.sourceLink}>See the listing</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.body}>No public-schedule events this day.</Text>
        )}
      </View>

      {pitch?.overlappingEvents.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Around this time</Text>
          {pitch.overlappingEvents.map((event, index) => (
            <Text key={`${event.time}-overlap-${index}`} style={styles.body}>
              {event.time} · {event.title}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={22} color={colors.info} />
        <Text style={styles.noteText}>{PITCH_DISCLAIMER}</Text>
      </View>

      {pitch ? (
        <Button
          label="Open in maps"
          style={styles.maps}
          onPress={() => Linking.openURL(mapsDirectionsUrl(pitch.lat, pitch.lng)).catch(() => undefined)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 44, height: 44 },
  topTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 15, ...typography.heading },
  hero: { marginTop: spacing.md, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.ink, gap: spacing.sm },
  title: { color: colors.white, fontSize: 28, lineHeight: 32, ...typography.display },
  meta: { color: colors.sand, fontSize: 13, ...typography.body },
  when: { color: colors.orange, fontSize: 12, ...typography.label },
  suggest: { color: colors.sand, fontSize: 12, lineHeight: 18, ...typography.body },
  updated: { color: colors.stone, fontSize: 12, marginTop: spacing.lg, ...typography.label },
  section: { marginTop: spacing.xxl, gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 21, ...typography.heading },
  body: { color: colors.stone, fontSize: 15, lineHeight: 23, ...typography.body },
  event: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  eventTime: { width: 72, color: colors.orangeDark, fontSize: 12, ...typography.label },
  eventTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  eventSource: { color: colors.stone, fontSize: 12, marginTop: 3, ...typography.body },
  sourceLink: { color: colors.orangeDark, fontSize: 12, marginTop: 8, ...typography.label },
  flex: { flex: 1 },
  note: { marginTop: spacing.xxl, flexDirection: 'row', gap: spacing.md, backgroundColor: '#E7F0F5', borderRadius: radius.md, padding: spacing.lg },
  noteText: { flex: 1, color: colors.info, fontSize: 13, lineHeight: 19, ...typography.body },
  maps: { marginTop: spacing.xl, marginBottom: spacing.lg },
});
