import { Href, Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { CricketMark } from "@/components/icons/CricketMark";
import { Button, Chip, Screen, StatusPill } from "@/components/ui";
import { cricketSquad } from "@/data/ccpl";
import { ccplScorecardUrl, cricketProgramHref, displayCricketName, getMatchDetail, isTrustedLive, subscribeLive, type CricketBall, type CricketMatch } from "@/lib/cricket";
import { safeBack } from "@/lib/nav";
import { useApp } from "@/state/AppProvider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export function generateStaticParams() {
  return [{ id: "4806" }, { id: "4777" }, { id: "4762" }, { id: "4721" }, { id: "blitz" }, { id: "aces" }, { id: "shockers" }];
}

function oversFromBalls(balls: CricketBall[]) {
  const groups: { key: string; label: string; items: CricketBall[] }[] = [];
  const index = new Map<string, number>();
  for (const ball of balls) {
    const label = ball.overLabel || `Innings ${ball.inningsNo}`;
    const key = `${ball.inningsNo}:${label}`;
    const existing = index.get(key);
    if (existing == null) {
      index.set(key, groups.length);
      groups.push({ key, label: `Inn ${ball.inningsNo} · ${label}`, items: [ball] });
    } else {
      groups[existing].items.push(ball);
    }
  }
  return groups.reverse();
}

export default function CricketMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useApp();
  const signedIn = role !== "guest";
  const [match, setMatch] = useState<CricketMatch | undefined>();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"scorecard" | "balls" | "overs" | "info">("scorecard");

  const load = () => {
    if (!id) {
      setReady(true);
      return;
    }
    getMatchDetail(id).then(setMatch).finally(() => setReady(true));
  };

  useEffect(() => {
    load();
  }, [id]);

  const trustedLive = match ? isTrustedLive(match) : false;
  useEffect(() => {
    if (!trustedLive) return undefined;
    return subscribeLive(match?.rowId ?? match?.id ?? "", load);
  }, [trustedLive, match?.rowId, match?.id]);

  const overGroups = useMemo(() => oversFromBalls(match?.balls ?? []), [match?.balls]);

  if (!ready) {
    return (
      <Screen>
        <Text style={styles.body}>Loading match…</Text>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen>
        <Text style={styles.body}>Match not found. Scores via CCPL (CricClubs).</Text>
        <Button label="Back" onPress={() => safeBack("/program/ccpl-cricket")} />
      </Screen>
    );
  }

  const official = match.ccplMatchId ? ccplScorecardUrl(match.ccplMatchId) : undefined;

  return (
    <Screen>
      <Pressable accessibilityLabel="Go back" onPress={() => safeBack("/program/ccpl-cricket")} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.header}>
        <CricketMark size={22} color={colors.orange} />
        <StatusPill label={trustedLive ? "live" : match.status === "scheduled" ? "upcoming" : match.status} tone={trustedLive ? "orange" : "neutral"} />
        <Text style={styles.title}>{match.opponentName}</Text>
        <Text style={styles.meta}>{match.playedAt}{match.venue ? ` · ${match.venue}` : ""}</Text>
        {trustedLive && match.live?.scoreText ? <Text style={styles.result}>{match.live.scoreText}</Text> : null}
        {!trustedLive && match.resultText ? <Text style={styles.result}>{match.resultText}</Text> : null}
        {match.status === "live" && !trustedLive ? (
          <Text style={styles.body}>Live score waits on a fresh CCPL poll. Until then, use the official scorecard.</Text>
        ) : null}
        {official ? (
          <Pressable onPress={() => Linking.openURL(official)}>
            <Text style={styles.official}>View official scorecard on CCPL</Text>
          </Pressable>
        ) : null}
        {official ? (
          <Pressable onPress={() => Linking.openURL(official)}>
            <Text style={styles.attr}>Scores via CCPL (CricClubs)</Text>
          </Pressable>
        ) : (
          <Text style={styles.attr}>Scores via CCPL (CricClubs)</Text>
        )}
      </View>

      <View style={styles.tabs}>
        <Chip label="Squad" onPress={() => router.push(cricketProgramHref("squad") as Href)} />
        <Chip label="All matches" onPress={() => router.push(cricketProgramHref("matches") as Href)} />
      </View>

      <View style={styles.tabs}>
        {(["scorecard", "balls", "overs", "info"] as const).map((item) => (
          <Chip key={item} label={item[0].toUpperCase() + item.slice(1)} active={tab === item} onPress={() => setTab(item)} />
        ))}
      </View>

      {tab === "scorecard" ? (
        (match.innings ?? []).length === 0 ? (
          <Text style={styles.body}>
            {match.status === "completed"
              ? "Full batting and bowling land after CCPL backfill. Result above is from the official results page."
              : "Scorecard waits on a CCPL backfill. Use the official scorecard until then."}
          </Text>
        ) : (
          (match.innings ?? []).map((inn) => (
            <View key={inn.inningsNo} style={styles.card}>
              <Text style={styles.innTitle}>{inn.battingSide ?? `Innings ${inn.inningsNo}`}</Text>
              {inn.runs != null ? <Text style={styles.meta}>{inn.runs}/{inn.wickets} ({inn.overs} ov)</Text> : null}
              {inn.batting.map((row) => {
                const royal = cricketSquad.find((p) => p.fullName === row.playerName || p.id === row.playerId);
                const name = displayCricketName(row.playerName, signedIn);
                const inner = (
                  <View style={styles.batRow}>
                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.dismiss}>{row.dismissal}</Text>
                    <Text style={styles.nums}>{row.runs} ({row.balls}) · {row.fours}×4 · {row.sixes}×6</Text>
                  </View>
                );
                return royal ? (
                  <Link key={`${inn.inningsNo}-${row.battingOrder}`} href={`/cricket/player/${royal.id}` as Href} asChild>
                    <Pressable>{inner}</Pressable>
                  </Link>
                ) : (
                  <View key={`${inn.inningsNo}-${row.battingOrder}`}>{inner}</View>
                );
              })}
              {inn.extras?.text ? <Text style={styles.meta}>Extras · {inn.extras.text}</Text> : null}
              {inn.fow?.length ? (
                <Text style={styles.meta}>
                  FoW · {inn.fow.map((item) => item.text ?? `${item.playerName} ${item.wicket}-${item.runs} ov ${item.over}`).join(" · ")}
                </Text>
              ) : null}
              {inn.bowling.length ? <Text style={styles.bowlHead}>Bowling</Text> : null}
              {inn.bowling.map((row, index) => {
                const royal = cricketSquad.find((p) => p.fullName === row.playerName || p.id === row.playerId);
                const econ = row.overs ? (row.runs / row.overs).toFixed(2) : "—";
                const line = (
                  <Text style={styles.nums}>
                    {displayCricketName(row.playerName, signedIn)} · {row.overs}-{row.maidens}-{row.runs}-{row.wickets} · Econ {econ}
                  </Text>
                );
                return royal ? (
                  <Link key={`${inn.inningsNo}-b${index}`} href={`/cricket/player/${royal.id}` as Href} asChild>
                    <Pressable>{line}</Pressable>
                  </Link>
                ) : (
                  <View key={`${inn.inningsNo}-b${index}`}>{line}</View>
                );
              })}
            </View>
          ))
        )
      ) : null}

      {tab === "balls" ? (
        (match.balls ?? []).length === 0 ? (
          <Text style={styles.body}>Ball-by-ball waits on a saved CCPL fixture. Live polling writes here during a game.</Text>
        ) : (
          [...(match.balls ?? [])].reverse().map((ball) => (
            <Text key={`${ball.inningsNo}-${ball.seq}`} style={[styles.body, ball.isWicket && styles.wicket]}>
              {ball.commentary}
            </Text>
          ))
        )
      ) : null}

      {tab === "overs" ? (
        overGroups.length === 0 ? (
          <Text style={styles.body}>Overs group from cricket_balls after backfill. Tokens come from CCPL over-by-over, not invented run values.</Text>
        ) : (
          overGroups.map((group) => (
            <View key={group.key} style={styles.card}>
              <Text style={styles.innTitle}>{group.label}</Text>
              {group.items.map((ball) => (
                <Text key={`${ball.inningsNo}-${ball.seq}`} style={[styles.body, ball.isWicket && styles.wicket]}>
                  {ball.commentary}
                </Text>
              ))}
            </View>
          ))
        )
      ) : null}

      {tab === "info" ? (
        <View style={styles.card}>
          {match.toss ? <Text style={styles.body}>Toss · {match.toss}</Text> : null}
          {match.venue ? <Text style={styles.body}>Venue · {match.venue}</Text> : null}
          {match.umpires ? <Text style={styles.body}>Umpires · {match.umpires}</Text> : null}
          {match.playerOfMatch ? <Text style={styles.body}>Player of the match · {match.playerOfMatch}</Text> : null}
          <Text style={styles.body}>No points table or NRR is stored — CCPL owns the competition table.</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: "center" },
  backText: { color: colors.ink, ...typography.label },
  header: { gap: 8, marginBottom: spacing.lg },
  title: { color: colors.ink, fontSize: 28, ...typography.display },
  meta: { color: colors.stone, fontSize: 13, ...typography.body },
  result: { color: colors.ink, fontSize: 16, ...typography.heading },
  official: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  attr: { color: colors.stone, fontSize: 11, ...typography.body },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  body: { color: colors.stone, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm, ...typography.body },
  card: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, gap: 8, marginBottom: spacing.md },
  innTitle: { color: colors.ink, fontSize: 18, ...typography.heading },
  batRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { color: colors.ink, fontSize: 15, ...typography.heading },
  dismiss: { color: colors.stone, fontSize: 12, ...typography.body },
  nums: { color: colors.charcoal, fontSize: 13, ...typography.label },
  bowlHead: { marginTop: spacing.md, color: colors.ink, ...typography.heading },
  wicket: { color: colors.danger },
});
