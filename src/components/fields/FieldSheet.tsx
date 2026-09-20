import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { conflictHeadline, PITCH_DISCLAIMER } from '@/lib/fields';
import type { LocatedPitch } from '@/lib/pitchCoords';
import { mapsDirectionsUrl } from '@/services/maps';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function FieldSheet({
  pitch,
  time,
  isTopPick,
}: {
  pitch?: LocatedPitch;
  time: string;
  isTopPick: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setExpanded(false);
  }, [pitch?.id]);
  if (!pitch) return null;
  const busy = pitch.status === 'conflict';
  const events = expanded ? pitch.events : [];

  return (
    <View style={styles.sheet}>
      <Text style={[styles.kicker, isTopPick && styles.kickerGold]}>{isTopPick ? '★ Top pick' : pitch.location}</Text>
      <Text style={styles.name}>{pitch.name}</Text>
      <Text style={styles.sub}>{pitch.pitch} · {pitch.surface}</Text>
      <View style={[styles.badge, busy ? styles.badgeBusy : styles.badgeClear]}>
        <Text style={[styles.badgeText, busy ? styles.badgeBusyText : styles.badgeClearText]}>
          {busy ? `⚠ ${conflictHeadline(pitch, time)}` : '✓ No conflicts found'}
        </Text>
      </View>

      {busy ? (
        <View style={styles.events}>
          {pitch.overlappingEvents.slice(0, 3).map((event, index) => (
            <Text key={`${event.time}-${event.title}-${index}`} style={styles.overlap}>
              <Text style={styles.overlapTime}>{event.time}  </Text>
              {event.title}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.note}>{PITCH_DISCLAIMER}</Text>
      )}

      {expanded ? (
        <View style={styles.day}>
          {events.length ? (
            events.map((event, index) => (
              <View key={`${event.time}-full-${index}`} style={styles.dayRow}>
                <Text style={styles.overlapTime}>{event.time}</Text>
                <View style={styles.flex}>
                  <Text style={styles.dayTitle}>{event.title}</Text>
                  {event.sourceUrl ? (
                    <Pressable onPress={() => Linking.openURL(event.sourceUrl!).catch(() => undefined)} hitSlop={8}>
                      <Text style={styles.source}>{event.source} ↗</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.sourceMuted}>{event.source}</Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.note}>No public-schedule events this day.</Text>
          )}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Get directions"
          style={styles.flex}
          onPress={() => Linking.openURL(mapsDirectionsUrl(pitch.lat, pitch.lng)).catch(() => undefined)}
        />
        <Button label="Full day" variant="secondary" style={styles.flex} onPress={() => setExpanded((open) => !open)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 8,
  },
  kicker: { color: colors.stone, fontSize: 11, ...typography.label, textTransform: 'uppercase', letterSpacing: 1.2 },
  kickerGold: { color: '#C4841A' },
  name: { color: colors.ink, fontSize: 22, ...typography.heading },
  sub: { color: colors.orangeDark, fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  badge: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  badgeClear: { backgroundColor: colors.successSoft },
  badgeBusy: { backgroundColor: colors.orangeSoft },
  badgeText: { fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  badgeClearText: { color: '#1F7A45' },
  badgeBusyText: { color: colors.orangeDark },
  events: { gap: 4 },
  overlap: { color: colors.charcoal, fontSize: 14, ...typography.body },
  overlapTime: { color: colors.orangeDark, fontSize: 12, ...typography.label },
  note: { color: colors.stone, fontSize: 13, lineHeight: 19, ...typography.body },
  day: { gap: spacing.sm, paddingTop: spacing.sm },
  dayRow: { flexDirection: 'row', gap: spacing.md },
  dayTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  source: { color: colors.orangeDark, fontSize: 12, marginTop: 4, ...typography.label },
  sourceMuted: { color: colors.stone, fontSize: 12, marginTop: 4, ...typography.body },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
