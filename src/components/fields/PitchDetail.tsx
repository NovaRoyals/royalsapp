import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { atTimeStatus, formatTimeChip, PITCH_DISCLAIMER } from '@/lib/fields';
import type { LocatedPitch } from '@/lib/pitchCoords';
import { mapsDirectionsUrl } from '@/services/maps';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function PitchDetail({
  pitch,
  time,
}: {
  pitch: LocatedPitch;
  time: string;
}) {
  const busy = pitch.status === 'conflict';
  const timeLabel = formatTimeChip(time);

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.key}>Surface</Text>
          <Text style={styles.val}>{pitch.surface}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.key}>Area</Text>
          <Text style={styles.val}>{pitch.location || 'Northern Virginia'}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.key}>At {timeLabel}</Text>
          <Text style={[styles.val, busy ? styles.busy : styles.clear]}>{atTimeStatus(pitch)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.key}>Events today</Text>
          <Text style={styles.val}>{pitch.events.length}</Text>
        </View>
      </View>

      <Text style={styles.scheduleLabel}>Full day schedule</Text>
      {pitch.events.length ? (
        pitch.events.map((event, index) => (
          <View key={`${event.time}-${event.title}-${index}`} style={styles.event}>
            <Text style={styles.eventTime}>{event.time}</Text>
            <View style={styles.flex}>
              <Text style={styles.eventTitle}>{event.title}</Text>
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

      {!busy ? <Text style={styles.note}>{PITCH_DISCLAIMER}</Text> : null}

      <Button
        label="Get directions"
        onPress={() => Linking.openURL(mapsDirectionsUrl(pitch.lat, pitch.lng)).catch(() => undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, paddingTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  key: { color: colors.stone, fontSize: 10, ...typography.label, textTransform: 'uppercase' },
  val: { color: colors.ink, fontSize: 14, ...typography.heading },
  clear: { color: '#1F7A45' },
  busy: { color: colors.orangeDark },
  scheduleLabel: { color: colors.stone, fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  event: { flexDirection: 'row', gap: spacing.md },
  eventTime: { width: 72, color: colors.orangeDark, fontSize: 12, ...typography.label },
  eventTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  source: { color: colors.orangeDark, fontSize: 12, marginTop: 4, ...typography.label },
  sourceMuted: { color: colors.stone, fontSize: 12, marginTop: 4, ...typography.body },
  note: { color: colors.stone, fontSize: 13, lineHeight: 19, ...typography.body },
  flex: { flex: 1 },
});
