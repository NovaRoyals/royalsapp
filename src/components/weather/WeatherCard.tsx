import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { canSendAnnouncement } from '@/lib/announcements';
import { formatInstantTime } from '@/lib/datetime';
import { useOutlook } from '@/services/forecast';
import { useApp } from '@/state/AppProvider';
import { colors, tints, typography, type TintName } from '@/theme/tokens';
import type { ScheduleEvent } from '@/types/domain';

const TINT: Record<'good' | 'watch' | 'risky', TintName> = { good: 'mint', watch: 'gold', risky: 'blush' };
const TITLE = { good: 'Forecast', watch: 'Forecast: unsettled', risky: 'Weather watch' } as const;

/**
 * The forecast for one session. A family reads one calm sentence, and when the outlook is risky
 * it is told to wait for the coach's or club's call, because the forecast never decides. Staff
 * read the numbers behind it and get a shortcut to tell families early.
 */
export function WeatherCard({ event, compact = false }: { event?: ScheduleEvent; compact?: boolean }) {
  const { role, postWeatherWatch } = useApp();
  const { outlook, fetchedAt } = useOutlook(event);
  const staff = canSendAnnouncement(role) && role !== 'guest';

  // A risky outlook leaves a heads-up in notifications, once, so it is not missed if Home is not open.
  useEffect(() => {
    if (event && outlook?.level === 'risky') postWeatherWatch(event, outlook);
  }, [event, outlook, postWeatherWatch]);

  if (!event || !outlook) return null;
  const tint = tints[TINT[outlook.level]];

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${TITLE[outlook.level]}. ${staff ? outlook.staff : outlook.family}`}
      style={[styles.card, { backgroundColor: tint.bg }]}
    >
      <View style={styles.top}>
        <View style={styles.icon}>
          <Ionicons accessible={false} name={outlook.icon} size={20} color={tint.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{TITLE[outlook.level]}</Text>
          <Text style={[styles.summary, { color: tint.accent }]}>{outlook.summary}</Text>
        </View>
      </View>
      <Text style={styles.body}>{staff ? outlook.staff : outlook.family}</Text>
      {staff && outlook.level !== 'good' && !compact ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tell families about the weather"
          onPress={() => router.push({ pathname: '/announcements/new', params: { kind: 'weather', event: event.id } } as never)}
          style={styles.action}
        >
          <Text style={styles.actionText}>Tell families</Text>
          <Ionicons accessible={false} name="arrow-forward" size={15} color={colors.white} />
        </Pressable>
      ) : null}
      {!compact ? (
        <Text style={styles.credit}>Forecast from Open-Meteo{fetchedAt ? ` · updated ${formatInstantTime(new Date(fetchedAt))}` : ''}. Forecasts change.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 22, padding: 14, gap: 8, marginBottom: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 15, ...typography.heading },
  summary: { fontSize: 13, marginTop: 1, ...typography.label },
  body: { color: colors.charcoal, fontSize: 14, lineHeight: 20, ...typography.body },
  action: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.ink },
  actionText: { color: colors.white, fontSize: 14, ...typography.label },
  credit: { color: colors.stone, fontSize: 11, ...typography.body },
});
