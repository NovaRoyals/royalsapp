import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

export function FieldChangeBanner({ closed, venue }: { closed: boolean; venue: string }) {
  if (!closed) return null;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Ionicons name="warning" size={22} color={colors.white} />
      <View style={styles.flex}>
        <Text style={styles.title}>{venue} is closed</Text>
        <Text style={styles.body}>Do not travel. We will post a makeup plan. This alert stays until staff reopen the field.</Text>
      </View>
    </View>
  );
}

export function GameDayCard({
  headline,
  drive,
  leaveBy,
  field,
  weather,
  bring,
  minutesOut,
  locationOptIn,
}: {
  headline: string;
  drive: string;
  leaveBy: string;
  field: string;
  weather: string;
  bring: string;
  minutesOut: number;
  locationOptIn: boolean;
}) {
  return (
    <View style={styles.game}>
      <Text style={styles.kicker}>GAME-DAY · {minutesOut} MIN</Text>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.line}>{leaveBy}</Text>
      <Text style={styles.meta}>{drive}</Text>
      <Text style={styles.meta}>{field} · {weather}</Text>
      <Text style={styles.bring}>Bring {bring}</Text>
      <Text style={styles.stub}>
        {locationOptIn
          ? 'Drive time is still a Fairfax stub until live maps are connected.'
          : 'Location is off. Drive time uses a Fairfax stub. Enable location in Profile when you want a personal estimate.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    marginBottom: spacing.lg,
  },
  flex: { flex: 1 },
  title: { color: colors.white, ...typography.heading },
  body: { color: colors.white, opacity: 0.92, fontSize: 12, marginTop: 4, lineHeight: 18, ...typography.body },
  game: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
    marginBottom: spacing.lg,
    gap: 6,
  },
  kicker: { color: colors.orange, fontSize: 10, ...typography.label, letterSpacing: 1.2 },
  headline: { color: colors.white, fontSize: 22, lineHeight: 26, ...typography.heading },
  line: { color: colors.white, fontSize: 16, marginTop: 4, ...typography.heading },
  meta: { color: colors.sand, fontSize: 13, ...typography.body },
  bring: { color: colors.orange, fontSize: 13, marginTop: 4, ...typography.heading },
  stub: { color: colors.sand, fontSize: 11, marginTop: 8, lineHeight: 16, ...typography.body },
});
