import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { BestPickBanner } from '@/components/fields/BestPickBanner';
import { FieldToolbar } from '@/components/fields/FieldToolbar';
import PitchMap from '@/components/fields/PitchMap';
import { PitchDetail } from '@/components/fields/PitchDetail';
import { PitchRow } from '@/components/fields/PitchRow';
import { AppHeader, Screen } from '@/components/ui';
import { venueCatalog, venueTitle } from '@/data/venues';
import { useFieldCoverage, usePitchDay } from '@/hooks/useFieldCalendar';
import { clubNowPostedIso } from '@/lib/datetime';
import {
  DEFAULT_PITCH_TIME,
  PITCH_FILTER_HINT,
  PITCH_TIMES,
  clubDateFromPosted,
  formatUpdatedAgo,
  isUpdatedStale,
  collapseSplitPitches,
  minutesForTime,
  resolveSuggestionId,
  sortPitches,
} from '@/lib/fields';
import { haptic } from '@/lib/haptics';
import { latestVenueUpdate } from '@/lib/operations';
import { locatePitches } from '@/lib/pitchCoords';
import { useReducedMotion } from '@/lib/reducedMotion';
import { eachDate } from '@/services/fields';
import { fieldStatusLabel } from '@/services/weather';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

function boundedDate(value: string, start?: string, end?: string) {
  if (!start || !end) return value;
  if (value < start) return start;
  if (value > end) return end;
  return value;
}

const PREVIEW_COUNT = 5;

export default function FieldsScreen() {
  const { schedule, venueUpdates } = useApp();
  const coverage = useFieldCoverage();
  const today = clubDateFromPosted(clubNowPostedIso());
  const windowStart = coverage.data?.coverageStart;
  const windowEnd = coverage.data?.coverageEnd;
  const windowToday = boundedDate(today, windowStart, windowEnd);
  const [pickedDate, setPickedDate] = useState<string>();
  const date = boundedDate(pickedDate ?? windowToday, windowStart, windowEnd);
  const [time, setTime] = useState<(typeof PITCH_TIMES)[number]>(DEFAULT_PITCH_TIME);
  const [turfOnly, setTurfOnly] = useState(true);
  const [pickedPitch, setPickedPitch] = useState<string>();
  const [expandedId, setExpandedId] = useState<string>();
  const [flyNonce, setFlyNonce] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDocked, setPanelDocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const reduced = useReducedMotion();
  const pickupMinutes = minutesForTime(time);
  const { width, height } = useWindowDimensions();
  const mapHeight = Math.max(220, Math.min(300, height - 520));
  const [showAllPitches, setShowAllPitches] = useState(false);
  const [showFieldStatus, setShowFieldStatus] = useState(false);
  const twoCol = width >= 640;
  const panelWidth = Math.min(width * 0.8, 340);
  const webFull: ViewStyle | undefined = fullscreen
    ? Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          height: '100%',
          ...(reduced
            ? {}
            : {
                transitionDuration: '380ms',
                transitionProperty: 'top, left, right, bottom, height, border-radius',
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              }),
        } as ViewStyle)
      : undefined
    : undefined;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const day = usePitchDay(date, pickupMinutes, turfOnly, Boolean(windowStart));
  const dates =
    windowStart && windowEnd
      ? eachDate(today < windowStart ? windowStart : today > windowEnd ? windowEnd : today, windowEnd)
      : [];
  const pitches = useMemo(
    () => locatePitches(sortPitches(collapseSplitPitches(day.data?.pitches ?? []))),
    [day.data],
  );
  const suggestionId = useMemo(
    () => resolveSuggestionId(pitches, day.data?.suggestionId),
    [pitches, day.data?.suggestionId],
  );
  const selectedId =
    pickedPitch && pitches.some((item) => item.id === pickedPitch)
      ? pickedPitch
      : suggestionId && pitches.some((item) => item.id === suggestionId)
        ? suggestionId
        : pitches[0]?.id;
  const selected = pitches.find((item) => item.id === selectedId);
  const suggestion = pitches.find((item) => item.id === suggestionId);
  const ranked = useMemo(() => {
    const suggested = pitches.find((item) => item.id === suggestionId);
    const others = pitches.filter((item) => item.id !== suggestionId);
    return [
      ...(suggested ? [suggested] : []),
      ...others.filter((item) => item.status !== 'conflict'),
      ...others.filter((item) => item.status === 'conflict'),
    ];
  }, [pitches, suggestionId]);
  const listed = showAllPitches
    ? ranked
    : ranked.filter((item, index) => index < PREVIEW_COUNT || item.id === selectedId);
  const fieldRows = useMemo(
    () =>
      venueCatalog.map((place) => {
        const update = latestVenueUpdate(venueUpdates, place.id);
        const fromEvent = schedule.find(
          (event) => event.venueId === place.id && event.fieldStatus && event.fieldStatus !== 'open' && event.status !== 'completed',
        )?.fieldStatus;
        return {
          id: place.id,
          title: venueTitle(place),
          status: update?.status ?? fromEvent ?? 'open',
          reason: update?.reason,
        };
      }),
    [schedule, venueUpdates],
  );
  const exceptions = fieldRows.filter((row) => row.status !== 'open');
  const statusLine =
    exceptions.length === 0
      ? 'All ROYALS fields currently open'
      : exceptions.length === 1
        ? `${exceptions[0].title} is ${fieldStatusLabel(exceptions[0].status).toLowerCase()}`
        : `${exceptions.length} ROYALS fields need attention`;

  useEffect(() => {
    if (fullscreen || !expandedId || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = document.getElementById(`pitch-${expandedId}`);
    node?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }, [expandedId, flyNonce, fullscreen, reduced]);

  useEffect(() => {
    if (!fullscreen || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const updatedIso = day.data?.fromCache ? day.data.cachedAt ?? day.data.lastUpdated : day.data?.lastUpdated ?? coverage.data?.lastUpdated;
  const updated = formatUpdatedAgo(updatedIso, day.data?.fromCache, now);
  const stale = isUpdatedStale(updatedIso, now);
  const emptyDay = Boolean(day.data && day.data.pitches.every((item) => item.events.length === 0));

  function changeDate(value: string) {
    setPickedDate(value);
    setExpandedId(undefined);
    setShowAllPitches(false);
  }

  function changeTime(value: (typeof PITCH_TIMES)[number]) {
    setTime(value);
    setExpandedId(undefined);
    setShowAllPitches(false);
  }

  function changeTurf() {
    setTurfOnly((value) => !value);
    setExpandedId(undefined);
    setShowAllPitches(false);
  }

  function selectPitch(id: string) {
    haptic('light');
    setPickedPitch(id);
    setExpandedId(id);
    setFlyNonce((value) => value + 1);
    if (fullscreen) {
      setPanelOpen(true);
      setPanelDocked(false);
    }
  }

  function toggleRow(id: string) {
    if (expandedId === id) {
      setExpandedId(undefined);
      return;
    }
    selectPitch(id);
  }

  function enterFullscreen() {
    haptic('light');
    setFullscreen(true);
    setPanelOpen(false);
    setPanelDocked(false);
  }

  function exitFullscreen() {
    setFullscreen(false);
    setPanelOpen(false);
    setPanelDocked(false);
  }

  function onMapBackground() {
    if (!fullscreen) return;
    if (panelOpen) {
      setPanelOpen(false);
      setPanelDocked(true);
    }
  }

  const mapCard = (
    <View style={[styles.mapCard, { height: mapHeight }, fullscreen && styles.mapFull, fullscreen && webFull, Platform.OS === 'web' && ({ touchAction: 'none' } as ViewStyle)]}>
      {fullscreen ? (
        <View style={styles.fullBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Exit fullscreen map" onPress={exitFullscreen} style={styles.mapBtn}>
            <Ionicons name="contract-outline" size={20} color={colors.ink} />
          </Pressable>
          <View style={styles.fullFilters}>
            <FieldToolbar
              compact
              date={date}
              dates={dates}
              today={today}
              time={time}
              turfOnly={turfOnly}
              onDate={changeDate}
              onTime={changeTime}
              onTurf={changeTurf}
            />
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Expand map" onPress={enterFullscreen} style={[styles.mapBtn, styles.expandBtn]}>
          <Ionicons name="expand-outline" size={20} color={colors.ink} />
        </Pressable>
      )}

      <PitchMap
        pitches={pitches}
        selectedId={selected?.id}
        topPickId={suggestionId}
        reducedMotion={reduced}
        frameKey={`${date}|${pickupMinutes}|${turfOnly}`}
        flyNonce={flyNonce}
        sizeKey={fullscreen ? 'full' : 'inline'}
        wheelZoom={fullscreen}
        onSelect={selectPitch}
        onBackground={onMapBackground}
      />

      {suggestionId ? (
        <Pressable
          accessibilityLabel="Top pick"
          onPress={() => selectPitch(suggestionId)}
          style={[styles.topPick, fullscreen && styles.topPickFull]}
        >
          <Text style={styles.topPickText}>★ Top pick</Text>
        </Pressable>
      ) : null}
      {fullscreen && (panelOpen || panelDocked) && selected ? (
        panelOpen ? (
          <View style={[styles.panel, { width: panelWidth }]}>
            <Pressable accessibilityLabel="Collapse panel" onPress={() => { setPanelOpen(false); setPanelDocked(true); }} style={styles.panelEdge}>
              <Text style={styles.panelEdgeText}>‹</Text>
            </Pressable>
            <ScrollView style={styles.panelBody} contentContainerStyle={styles.panelContent}>
              <Text style={styles.panelKicker}>{selected.id === suggestionId ? '★ Best pick' : selected.location}</Text>
              <Text style={styles.panelName}>{selected.name}</Text>
              <Text style={styles.panelSub}>{selected.pitch} · {selected.surface}</Text>
              <PitchDetail pitch={selected} time={time} />
            </ScrollView>
          </View>
        ) : (
          <Pressable accessibilityLabel="Open panel" onPress={() => setPanelOpen(true)} style={styles.grab}>
            <Text style={styles.panelEdgeText}>›</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );

  return (
    <Screen tabScene>
        <AppHeader
          compactTitle
          eyebrow="Open pitches"
          title="Find your next pickup location and avoid busy fields"
          meta={updated}
          metaTone={stale ? 'stale' : 'default'}
          style={styles.headerTight}
        />

        {coverage.isError && !coverage.data ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Pitch dates didn’t load. We won’t guess the window.</Text>
            <Pressable onPress={() => coverage.refetch()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : null}

        {day.isError ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Couldn’t reach field schedules — showing data from {formatUpdatedAgo(updatedIso, true, now).replace(' · saved', '')}
            </Text>
            <Pressable onPress={() => day.refetch()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : null}

        <FieldToolbar
          date={date}
          dates={dates}
          today={today}
          time={time}
          turfOnly={turfOnly}
          onDate={changeDate}
          onTime={changeTime}
          onTurf={changeTurf}
        />
        <Text style={styles.hint}>{PITCH_FILTER_HINT}</Text>

        <View style={styles.statusLine}>
          <Text style={styles.statusCopy}>{statusLine}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showFieldStatus }}
            onPress={() => setShowFieldStatus((value) => !value)}
            style={styles.statusAction}
          >
            <Text style={styles.statusActionText}>{showFieldStatus ? 'Hide status' : 'View status'}</Text>
          </Pressable>
        </View>
        {showFieldStatus ? (
          <View style={styles.statusList}>
            {[...exceptions, ...fieldRows.filter((row) => row.status === 'open')].map((row) => (
              <Text key={row.id} style={styles.statusItem}>
                {row.title} · {fieldStatusLabel(row.status)}
                {row.reason ? ` · ${row.reason}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {fullscreen ? <View style={[styles.mapSpacer, { height: mapHeight }]} /> : null}
        {mapCard}

        {suggestion ? (
          <BestPickBanner pitch={suggestion} time={time} onPress={() => selectPitch(suggestion.id)} />
        ) : null}

        {emptyDay ? <Text style={styles.empty}>No public-schedule events this day.</Text> : null}

        <Text style={styles.section}>{showAllPitches ? `PITCHES · ${pitches.length}` : 'Suggested pitches'}</Text>
        <View style={[styles.list, twoCol && styles.listGrid]} accessibilityLabel="Tap a glowing pin to preview the pitch — green is clear at your time, orange has something on.">
          {day.isPending && !day.data
            ? [0, 1, 2, 3].map((item) => <View key={item} style={[styles.skeleton, twoCol && styles.half]} />)
            : listed.map((pitch) => (
                <PitchRow
                  key={pitch.id}
                  pitch={pitch}
                  time={time}
                  expanded={expandedId === pitch.id}
                  isTopPick={pitch.id === suggestionId}
                  twoCol={twoCol}
                  onToggle={() => toggleRow(pitch.id)}
                />
              ))}
        </View>
        {pitches.length > PREVIEW_COUNT ? (
          <Pressable accessibilityRole="button" onPress={() => setShowAllPitches((value) => !value)} style={styles.more}>
            <Text style={styles.moreText}>{showAllPitches ? 'Show suggested pitches' : `View all ${pitches.length} pitches`}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.footer}>Data: Fieldchecker API · source health</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerTight: { paddingTop: 4, paddingBottom: 8 },
  hint: { color: colors.stone, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: spacing.sm, ...typography.body },
  mapCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F3F5F3',
    marginBottom: spacing.sm,
  },
  mapSpacer: { marginBottom: spacing.sm },
  mapFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    borderRadius: 0,
    marginBottom: 0,
    zIndex: 80,
    overflow: 'visible',
  },
  mapBtn: {
    position: 'absolute',
    zIndex: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBtn: { top: 12, left: 12 },
  fullBar: {
    position: 'absolute',
    zIndex: 8,
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullFilters: { flex: 1 },
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
    zIndex: 6,
  },
  topPickFull: { top: 64 },
  topPickText: { color: colors.white, fontSize: 12, ...typography.label },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  statusCopy: { flex: 1, color: colors.ink, fontSize: 14, ...typography.bodyMedium },
  statusAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  statusActionText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  statusList: { gap: 4, marginBottom: spacing.sm },
  statusItem: { color: colors.charcoal, fontSize: 13, lineHeight: 18, ...typography.body },
  more: { minHeight: 44, justifyContent: 'center', marginTop: spacing.sm },
  moreText: { color: colors.orangeDark, fontSize: 14, ...typography.label },
  panel: {
    position: 'absolute',
    top: 72,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  panelEdge: {
    position: 'absolute',
    left: -22,
    top: '46%',
    width: 36,
    height: 46,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grab: {
    position: 'absolute',
    right: 0,
    top: '46%',
    width: 46,
    height: 46,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelEdgeText: { color: colors.ink, fontSize: 22, ...typography.heading },
  panelBody: { flex: 1 },
  panelContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  panelKicker: { color: colors.orange, fontSize: 11, ...typography.label, textTransform: 'uppercase' },
  panelName: { color: colors.ink, fontSize: 22, ...typography.heading, marginTop: 4 },
  panelSub: { color: colors.orangeDark, fontSize: 11, marginBottom: spacing.sm, ...typography.label, textTransform: 'uppercase' },
  empty: { color: colors.stone, fontSize: 14, marginBottom: spacing.md, ...typography.body },
  section: { color: colors.stone, fontSize: 10, marginBottom: spacing.sm, ...typography.label },
  list: { gap: spacing.sm },
  listGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  half: { width: '48%', flexGrow: 1 },
  skeleton: { height: 64, borderRadius: radius.lg, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
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
  footer: { color: colors.stone, fontSize: 11, marginTop: spacing.md, marginBottom: spacing.lg, ...typography.body },
});
