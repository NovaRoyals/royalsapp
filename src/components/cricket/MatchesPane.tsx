import { Href, Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { StatusPill } from "@/components/ui";
import { ccplScorecardUrl } from "@/data/ccpl";
import { getMatches, isTrustedLive, seasonRecord, subscribeLive, type CricketMatch } from "@/lib/cricket";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export function CricketMatchesPane() {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [ready, setReady] = useState(false);

  const load = () => {
    getMatches()
      .then(setMatches)
      .finally(() => setReady(true));
  };

  useEffect(() => {
    load();
  }, []);

  const live = ready ? matches.find((item) => isTrustedLive(item)) : undefined;
  useEffect(() => {
    if (!live) return undefined;
    return subscribeLive(live.rowId ?? live.id, load);
  }, [live?.rowId, live?.id]);

  const record = useMemo(() => seasonRecord(matches), [matches]);
  const completed = matches.filter((item) => item.status === "completed" && item.resultType && item.resultType !== "no_result");
  const upcoming = matches.filter((item) => item.status === "scheduled" || (item.status === "live" && !isTrustedLive(item)));

  if (!ready) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.hint}>Loading CCPL results…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {live ? (
        <View style={styles.liveCard}>
          <View style={styles.liveTop}>
            <StatusPill label="Live" tone="orange" />
          </View>
          <Text style={styles.liveTitle}>{live.opponentName}</Text>
          <Text style={styles.liveScore}>{live.live?.scoreText}</Text>
          {live.live?.currentBowler ? <Text style={styles.attr}>{live.live.currentBowler}</Text> : null}
          <Pressable onPress={() => Linking.openURL(ccplScorecardUrl(live.ccplMatchId))}>
            <Text style={styles.link}>Scores via CCPL (CricClubs)</Text>
          </Pressable>
          <Link href={`/cricket/match/${live.id}` as Href} asChild>
            <Pressable><Text style={styles.link}>Open match</Text></Pressable>
          </Link>
        </View>
      ) : null}

      <Text style={styles.record}>
        {record.won}W – {record.lost}L – {record.tied}T
        {record.form.length ? ` · ${record.form.join(" ")}` : ""}
      </Text>
      <Text style={styles.hint}>Record from CCPL results. No invented table or NRR.</Text>

      <Text style={styles.heading}>Results</Text>
      {completed.map((item) => (
        <Link key={item.id} href={`/cricket/match/${item.id}` as Href} asChild>
          <Pressable style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.when}>{item.playedAt}</Text>
              <Text style={styles.opp}>{item.opponentName}</Text>
              <Text style={styles.result}>{item.resultText}</Text>
            </View>
            <StatusPill label={item.resultType === "win" ? "W" : item.resultType === "tie" ? "T" : "L"} tone={item.resultType === "win" ? "success" : "neutral"} />
          </Pressable>
        </Link>
      ))}

      <Text style={styles.heading}>Upcoming</Text>
      {upcoming.map((item) => (
        <Link key={item.id} href={`/cricket/match/${item.id}` as Href} asChild>
          <Pressable style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.when}>{item.playedAt}{item.homeAway ? ` · ${item.homeAway}` : ""}</Text>
              <Text style={styles.opp}>{item.opponentName}</Text>
              {item.venue ? <Text style={styles.result}>{item.venue}</Text> : null}
            </View>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, marginTop: spacing.lg, gap: spacing.md },
  liveCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.ink, gap: 8 },
  liveTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveTitle: { color: colors.sand, fontSize: 13, ...typography.label },
  liveScore: { color: colors.white, fontSize: 20, ...typography.heading },
  attr: { color: colors.stone, fontSize: 11, ...typography.body },
  link: { color: colors.orange, fontSize: 13, ...typography.label },
  record: { color: colors.ink, fontSize: 22, ...typography.heading },
  hint: { color: colors.stone, fontSize: 12, marginTop: -8, ...typography.body },
  heading: { color: colors.ink, fontSize: 18, marginTop: spacing.md, ...typography.heading },
  row: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  when: { color: colors.stone, fontSize: 11, ...typography.label },
  opp: { color: colors.ink, fontSize: 16, marginTop: 2, ...typography.heading },
  result: { color: colors.charcoal, fontSize: 13, marginTop: 4, ...typography.body },
});
