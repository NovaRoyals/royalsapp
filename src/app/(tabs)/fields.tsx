import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FieldSheet } from '@/components/fields/FieldSheet';
import PitchMap from '@/components/fields/PitchMap';
import { PIN_BUSY, PIN_CLEAR } from '@/components/fields/mapTypes';
import { PressableScale } from '@/components/motion';
import { AppHeader, Chip, Screen } from '@/components/ui';
import { useFieldCoverage, usePitchDay } from '@/hooks/useFieldCalendar';
import { clubNowPostedIso } from '@/lib/datetime';
import {
  DEFAULT_PITCH_TIME,
  PITCH_DISCLAIMER,
  PITCH_MAP_HINT,
  PITCH_TIMES,
  clearCount,
  clubDateFromPosted,
  conflictHeadline,
  formatDateChip,
  formatTimeChip,
  formatUpdatedAgo,
  isUpdatedStale,
  statusCopy,
  type PitchSort,
  sortPitches,
} from '@/lib/fields';
import { haptic } from '@/lib/haptics';
import { locatePitches } from '@/lib/pitchCoords';
import { useReducedMotion } from '@/lib/reducedMotion';
import { eachDate } from '@/services/fields';
import { colors, radius, shadow, spacing, typography } from '@/theme/tokens';

type SurfaceFilter = 'all' | 'turf' | 'grass';
type BusyFilter = 'all' | 'clear' | 'busy';

export default function FieldsScreen() {
  const coverage = useFieldCoverage();
  const today = clubDateFromPosted(clubNowPostedIso());
  const windowStart = coverage.data?.coverageStart;
  const windowEnd = coverage.data?.coverageEnd;
  const [date, setDate] = useState(today);
  const [time, setTime] = useState<(typeof PITCH_TIMES)[number]>(DEFAULT_PITCH_TIME);
  const [surface, setSurface] = useState<SurfaceFilter>('all');
  const [busy, setBusy] = useState<BusyFilter>('all');
  const [sort, setSort] = useState<PitchSort>('suggestion');
  const [selectedId, setSelectedId] = useState<string>();
  const [flyNonce, setFlyNonce] = useState(0);
  const [now, setNow] = useState(Date.now());
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!windowStart || !windowEnd) return;
    setDate((current) => (current < windowStart ? windowStart : current > windowEnd ? windowEnd : current));
  }, [windowStart, windowEnd]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const day = usePitchDay(date, time, surface === 'turf', Boolean(windowStart));
  const dates = windowStart && windowEnd ? eachDate(windowStart, windowEnd) : [];
  const pitches = useMemo(() => {
    const list = day.data?.pitches ?? [];
    const bySurface = surface === 'grass' ? list.filter((item) => item.surface === 'Grass') : list;
    const byBusy =
      busy === 'clear'
        ? bySurface.filter((item) => item.status === 'no_conflict')
        : busy === 'busy'
          ? bySurface.filter((item) => item.status === 'conflict')
          : bySurface;
    return locatePitches(sortPitches(byBusy, day.data?.suggestionId, sort));
  }, [busy, day.data, sort, surface]);

  const suggestionId = day.data?.suggestionId;
  const selected = pitches.find((item) => item.id === selectedId) ?? pitches.find((item) => item.id === suggestionId) ?? pitches[0];

  useEffect(() => {
    if (!pitches.length) return;
    setSelectedId((current) => {
      if (current && pitches.some((item) => item.id === current)) return current;
      if (suggestionId && pitches.some((item) => item.id === suggestionId)) return suggestionId;
      return pitches[0].id;
    });
  }, [pitches, suggestionId]);

  const updatedIso = day.data?.fromCache ? day.data.cachedAt ?? day.data.lastUpdated : day.data?.lastUpdated ?? coverage.data?.lastUpdated;
  const updated = formatUpdatedAgo(updatedIso, day.data?.fromCache, now);
  const stale = isUpdatedStale(updatedIso, now);
  const clear = clearCount(day.data);
  const emptyDay = Boolean(day.data && day.data.pitches.every((item) => item.events.length === 0));

  function selectPitch(id: string) {
    haptic('light');
    setSelectedId(id);
    setFlyNonce((value) => value + 1);
  }

  return (
    <Screen tabScene>
      <AppHeader eyebrow="Pickup & planning" title="Fields" />
      <Text style={styles.lead}>Check public calendars before you drive. Pick a time, then scan pitches around Northern Virginia.</Text>
      <Text style={[styles.updated, stale && styles.updatedStale]}>{updated}{coverage.data?.incompleteCalendars ? ' · some calendars didn’t refresh' : ''}</Text>
      <Text style={styles.disclaimer}>{coverage.data?.disclaimer ?? PITCH_DISCLAIMER}</Text>

      {coverage.isError && !coverage.data ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Pitch dates didn’t load. We won’t guess the window.</Text>
          <Pressable onPress={() => coverage.refetch()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : null}

      {day.isError ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Couldn’t reach field schedules — showing data from {formatUpdatedAgo(updatedIso, true, now).replace(' · saved copy', '')}
          </Text>
          <Pressable onPress={() => day.refetch()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {dates.map((item) => (
          <Chip key={item} label={formatDateChip(item, today)} active={date === item} onPress={() => setDate(item)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PITCH_TIMES.map((item) => (
          <Chip key={item} label={formatTimeChip(item)} active={time === item} onPress={() => setTime(item)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label="All surfaces" active={surface === 'all'} onPress={() => setSurface('all')} />
        <Chip label="Turf" active={surface === 'turf'} onPress={() => setSurface('turf')} />
        <Chip label="Grass" active={surface === 'grass'} onPress={() => setSurface('grass')} />
        <Chip label="No conflicts" active={busy === 'clear'} onPress={() => setBusy(busy === 'clear' ? 'all' : 'clear')} />
        <Chip label="On the calendar" active={busy === 'busy'} onPress={() => setBusy(busy === 'busy' ? 'all' : 'busy')} />
      </ScrollView>

      <View style={styles.filterRow}>
        <Text style={styles.count}>{pitches.length} PITCHES{day.data ? ` · ${clear} with no public conflicts` : ''}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            <Chip label="Suggested first" active={sort === 'suggestion'} onPress={() => setSort('suggestion')} />
            <Chip label="Clear first" active={sort === 'clear'} onPress={() => setSort('clear')} />
            <Chip label="A–Z" active={sort === 'name'} onPress={() => setSort('name')} />
          </View>
        </ScrollView>
      </View>

      <View style={styles.mapCard}>
        <PitchMap
          pitches={pitches}
          selectedId={selected?.id}
          topPickId={suggestionId}
          reducedMotion={reduced}
          frameKey={`${date}|${time}|${surface}`}
          flyNonce={flyNonce}
          onSelect={selectPitch}
        />
        {suggestionId ? (
          <Pressable
            accessibilityLabel="Top pick"
            onPress={() => selectPitch(suggestionId)}
            style={styles.topPick}
          >
            <Text style={styles.topPickText}>★ Top pick</Text>
          </Pressable>
        ) : null}
        <Text style={styles.attr}>© OpenStreetMap © Esri</Text>
      </View>
      <Text style={styles.hint}>{PITCH_MAP_HINT}</Text>

      <FieldSheet pitch={selected} time={time} isTopPick={selected?.id === suggestionId} />

      {emptyDay ? <Text style={styles.empty}>No public-schedule events this day.</Text> : null}

      <View style={styles.list}>
        {day.isPending && !day.data
          ? [0, 1, 2].map((item) => <View key={item} style={styles.skeleton} />)
          : pitches.map((pitch) => (
              <View key={pitch.id} style={[styles.card, pitch.id === selected?.id && styles.cardSelected]}>
                <PressableScale style={styles.cardMain} onPress={() => selectPitch(pitch.id)}>
                  <View style={[styles.dot, { backgroundColor: pitch.status === 'no_conflict' ? PIN_CLEAR : PIN_BUSY }]} />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{pitch.name}</Text>
                    <Text style={styles.audience}>{pitch.pitch} · {pitch.surface}</Text>
                    <Text numberOfLines={2} style={styles.cardSummary}>
                      {pitch.location} · {pitch.status === 'conflict' ? conflictHeadline(pitch, time) : statusCopy(pitch.status)}
                    </Text>
                  </View>
                </PressableScale>
                <Link href={`/field/${pitch.id}?date=${date}&time=${time}`} asChild>
                  <Pressable accessibilityLabel={`Open ${pitch.name}`} style={styles.chevron}>
                    <Ionicons name="chevron-forward" size={20} color={colors.ink} />
                  </Pressable>
                </Link>
              </View>
            ))}
      </View>

      <Text style={styles.footer}>Data: Fieldchecker API · source health</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.stone, fontSize: 15, lineHeight: 22, marginTop: -spacing.md, marginBottom: spacing.sm, ...typography.body },
  updated: { color: colors.charcoal, fontSize: 12, ...typography.label },
  updatedStale: { color: colors.orangeDark },
  disclaimer: { color: colors.stone, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: spacing.lg, ...typography.body },
  row: { gap: spacing.sm, paddingRight: spacing.xl, paddingBottom: spacing.md },
  filterRow: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  count: { color: colors.stone, fontSize: 10, ...typography.label },
  chips: { flexDirection: 'row', gap: spacing.sm },
  mapCard: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F3F5F3',
    marginBottom: spacing.sm,
    ...shadow,
  },
  topPick: {
    position: 'absolute',
    top: 12,
    right: 12,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topPickText: { color: colors.white, fontSize: 12, ...typography.label },
  attr: { position: 'absolute', left: 10, bottom: 8, color: colors.stone, fontSize: 9, ...typography.body },
  hint: { color: colors.stone, fontSize: 13, lineHeight: 19, marginBottom: spacing.md, ...typography.body },
  empty: { color: colors.stone, fontSize: 14, marginTop: spacing.md, ...typography.body },
  list: { gap: spacing.md, marginTop: spacing.lg },
  skeleton: { height: 88, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'stretch',
  },
  cardSelected: { borderColor: colors.ink, borderWidth: 2 },
  cardMain: { flex: 1, flexDirection: 'row', padding: spacing.md, gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 8 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  audience: { color: colors.orangeDark, fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  cardSummary: { color: colors.stone, fontSize: 12, lineHeight: 17, ...typography.body },
  chevron: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.amberSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { flex: 1, color: colors.charcoal, fontSize: 13, lineHeight: 19, ...typography.body },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { color: colors.orangeDark, fontSize: 12, ...typography.label },
  footer: { color: colors.stone, fontSize: 11, marginTop: spacing.xxl, marginBottom: spacing.lg, ...typography.body },
});
