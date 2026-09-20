import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CalendarConfirmButton } from '@/components/interactions/SupporterButton';
import { StatusPill } from '@/components/ui';
import { formatEventWhen } from '@/lib/datetime';
import {
  FXA,
  fxa35PlusHistory,
  getMatches,
  getStandings,
  soccerRecord,
  soccerResultText,
  type SoccerMatch,
  type SoccerSide,
} from '@/lib/soccer';
import { calendarGateway } from '@/services/calendar';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { ScheduleEvent } from '@/types/domain';

export function SoccerFixturesPane({ side }: { side: SoccerSide }) {
  const meta = FXA[side];
  const [matches, setMatches] = useState<SoccerMatch[]>([]);
  const [rank, setRank] = useState<string>('');
  const [ready, setReady] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([getMatches(side), getStandings(meta.leagueId)])
      .then(([nextMatches, table]) => {
        if (!live) return;
        setMatches(nextMatches);
        const ours = table.find((row) => row.teamId === meta.teamId);
        setRank(ours ? `${ours.rank} of ${table.length} · Competitive` : '');
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [meta.leagueId, meta.teamId, side]);

  const record = useMemo(() => soccerRecord(matches), [matches]);
  const upcoming = matches.filter((item) => item.status === 'scheduled').sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const results = matches.filter((item) => item.status === 'completed');

  if (!ready) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>Loading FXA fixtures…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.record}>
        {record.won}W – {record.lost}L – {record.drawn}T
        {rank ? ` · ${rank}` : ''}
      </Text>
      <Text style={styles.hint}>Record and place from the FXA Competitive table. No invented points.</Text>

      <Text style={styles.heading}>Upcoming</Text>
      {upcoming.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.when}>{formatEventWhen(item.playedAt)} · {item.homeAway === 'H' ? 'Home' : 'Visitor'}</Text>
          <Text style={styles.opp}>{item.opponentName}</Text>
          <Text style={styles.meta}>{[item.venue, item.field].filter(Boolean).join(' · ')}</Text>
          <CalendarConfirmButton
            added={addedId === item.id}
            labelIdle="Add to calendar"
            onAdd={() => {
              calendarGateway.add(toEvent(item, side));
              setAddedId(item.id);
            }}
          />
        </View>
      ))}

      <Text style={styles.heading}>Results</Text>
      {results.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.when}>{formatEventWhen(item.playedAt)}</Text>
              <Text style={styles.opp}>{item.opponentName}</Text>
              <Text style={styles.meta}>{soccerResultText(item)}</Text>
            </View>
            <StatusPill label={pillFor(item)} tone={pillFor(item) === 'W' ? 'success' : 'neutral'} />
          </View>
          {item.gamerecapUrl ? (
            <Pressable onPress={() => Linking.openURL(item.gamerecapUrl!)}>
              <Text style={styles.link}>View official game recap on FXA</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {side === '35plus' ? (
        <>
          <Text style={styles.heading}>History</Text>
          {fxa35PlusHistory.map((item) => (
            <Pressable key={item.href} onPress={() => Linking.openURL(item.href)} style={styles.card}>
              <Text style={styles.opp}>{item.label}</Text>
              <Text style={styles.meta}>{item.detail}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <Pressable onPress={() => Linking.openURL(meta.scheduleUrl)}>
        <Text style={styles.link}>Schedules via FXA Sports</Text>
      </Pressable>
    </View>
  );
}

function pillFor(match: SoccerMatch) {
  if (match.royalsScore == null || match.opponentScore == null) return '—';
  if (match.royalsScore === match.opponentScore) return 'T';
  return match.royalsScore > match.opponentScore ? 'W' : 'L';
}

function toEvent(match: SoccerMatch, side: SoccerSide): ScheduleEvent {
  return {
    id: match.id,
    type: 'league_match',
    sport: 'soccer',
    title: `Nova Royals AC (${side === '35plus' ? '35+' : 'Open'}) vs ${match.opponentName}`,
    subtitle: match.homeAway === 'H' ? 'Home' : 'Visitor',
    startsAt: match.playedAt,
    venue: [match.venue, match.field].filter(Boolean).join(' · '),
    teamId: side === '35plus' ? 'nova-royals-35plus' : 'nova-royals-men',
    status: match.status === 'completed' ? 'completed' : 'scheduled',
    fieldStatus: 'open',
  };
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  record: { color: colors.ink, fontSize: 22, ...typography.heading },
  hint: { color: colors.stone, fontSize: 12, marginTop: -8, ...typography.body },
  heading: { color: colors.ink, fontSize: 18, marginTop: spacing.md, ...typography.heading },
  card: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  when: { color: colors.stone, fontSize: 11, ...typography.label },
  opp: { color: colors.ink, fontSize: 16, ...typography.heading },
  meta: { color: colors.charcoal, fontSize: 13, ...typography.body },
  link: { color: colors.orangeDark, fontSize: 13, ...typography.label },
});
