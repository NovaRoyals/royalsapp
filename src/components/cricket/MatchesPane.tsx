import { Href, Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { CricketMark } from "@/components/icons/CricketMark";
import { StatusPill } from "@/components/ui";
import { ccplScorecardUrl } from "@/data/ccpl";
import { getMatches, seasonRecord, subscribeLive, type CricketMatch } from "@/lib/cricket";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export function CricketMatchesPane() {
  const [matches, setMatches] = useState<CricketMatch[]>([]);

  const load = () => {
    getMatches().then(setMatches);
  };

  useEffect(() => {
    load();
  }, []);

  const live = matches.find((item) => item.status === "live");
  useEffect(() => {
    if (!live) return undefined;
    return subscribeLive(live.id, load);
  }, [live?.id]);

  const record = useMemo(() => seasonRecord(matches), [matches]);
  const completed = matches.filter((item) => item.status === "completed");
  const upcoming = matches.filter((item) => item.status === "scheduled");

  return (
    <View style={styles.wrap}>
      {live ? (
        <View style={styles.liveCard}>
          <View style={styles.liveTop}>
            <CricketMark size={18} color={colors.orange} />
            <StatusPill label="Live" tone="orange" />
          </View>
          <Text style={styles.liveTitle}>vs {live.opponentName}</Text>
          <Text style={styles.liveScore}>{live.live?.scoreText ?? live.resultText}</Text>
          {live.ccplMatchId ? (
            <Pressable onPress={() => Linking.openURL(ccplScorecardUrl(live.ccplMatchId))}>
              <Text style={styles.link}>Scores via CCPL (CricClubs)</Text>
            </Pressable>
          ) : (
            <Text style={styles.attr}>Scores via CCPL (CricClubs)</Text>
          )}
          <Link href={`/cricket/match/${live.id}` as Href} asChild>
            <Pressable><Text style={styles.link}>Open match</Text></Pressable>
          </Link>
        </View>
      ) : null}

      <Text style={styles.record}>
        {record.won}W – {record.lost}L – {record.tied}T
        {record.form.length ? ` · ${record.form.join("")}` : ""}
      </Text>
      <Text style={styles.hint}>Record from CCPL results. No invented table or NRR.</Text>

      <Text style={styles.heading}>Results</Text>
      {completed.map((item) => (
        <Link key={item.id} href={`/cricket/match/${item.id}` as Href} asChild>
          <Pressable style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.when}>{item.playedAt}</Text>
              <Text style={styles.opp}>vs {item.opponentName}</Text>
              <Text style={styles.result}>{item.resultText}</Text>
            </View>
            <StatusPill label={item.resultType === "win" ? "W" : item.resultType === "tie" ? "T" : item.resultType === "no_result" ? "NR" : "L"} tone={item.resultType === "win" ? "success" : "neutral"} />
          </Pressable>
        </Link>
      ))}

      <Text style={styles.heading}>Upcoming</Text>
      {upcoming.map((item) => (
        <Link key={item.id} href={`/cricket/match/${item.id}` as Href} asChild>
          <Pressable style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.when}>{item.playedAt}{item.homeAway ? ` · ${item.homeAway}` : ""}</Text>
              <Text style={styles.opp}>vs {item.opponentName}</Text>
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
