import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { CloudBackdrop } from "@/components/brand/CloudBackdrop";
import { CricketMark } from "@/components/icons/CricketMark";
import { Button, Chip, Screen, StatusPill } from "@/components/ui";
import { cricketSquad } from "@/data/ccpl";
import { ccplScorecardUrl, cricketProgramHref, displayCricketName, getMatchDetail, isTrustedLive, subscribeLive, type CricketBall, type CricketMatch } from "@/lib/cricket";
import { formatEventParts } from "@/lib/datetime";
import { safeBack } from "@/lib/nav";
import { useApp } from "@/state/AppProvider";
import { colors, gradients, spacing, typography } from "@/theme/tokens";

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
  const [loaded, setLoaded] = useState<{ id: string; match?: CricketMatch } | null>(null);
  const [tab, setTab] = useState<"scorecard" | "balls" | "overs" | "info">("scorecard");
  const ready = !id || loaded?.id === id;
  const match = loaded?.id === id ? loaded.match : undefined;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getMatchDetail(id).then((next) => {
      if (!cancelled) setLoaded({ id, match: next });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const trustedLive = match ? isTrustedLive(match) : false;
  const liveKey = match?.rowId ?? match?.id;
  useEffect(() => {
    if (!trustedLive || !id || !liveKey) return undefined;
    let cancelled = false;
    return subscribeLive(liveKey, () => {
      getMatchDetail(id).then((next) => {
        if (!cancelled) setLoaded({ id, match: next });
      });
    });
  }, [trustedLive, liveKey, id]);

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
  const dateParts = formatEventParts(`${match.playedAt}T12:00:00-04:00`);
  // A fixture whose date has passed but whose score has not synced yet is not "upcoming".
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const statusLabel = trustedLive
    ? "Live"
    : match.status === "completed"
      ? "Final"
      : match.status === "scheduled" && match.playedAt < today
        ? "Awaiting score"
        : "Upcoming";

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack("/program/ccpl-cricket")} style={styles.backButton}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <Text style={styles.topTitle}>Match</Text>
        <View style={styles.topSpacer} />
      </View>

      <Link href={cricketProgramHref("about") as Href} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="About ROYALS Cricket" style={styles.contextLink}>
          <Text style={styles.contextText}>CCPL Cricket › ROYALS Cricket</Text>
        </Pressable>
      </Link>

      <View style={styles.hero}>
        <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <CloudBackdrop />
        <View style={styles.heroBody}>
          <View style={styles.heroKickerRow}>
            <CricketMark size={16} color={colors.mint} />
            <Text style={styles.heroKicker}>CCPL T20 · MANASSAS1</Text>
            <StatusPill label={statusLabel} tone={trustedLive ? "orange" : "neutral"} />
          </View>
          <View accessibilityRole="header" style={styles.heroTeams}>
            <View style={styles.teamRow}>
              <Text style={styles.heroTeam}>NOVA Royals</Text>
              {match.royalsScore ? <Text style={styles.heroScore}>{match.royalsScore}</Text> : null}
            </View>
            <View style={styles.vsRow}>
              <View style={styles.vsLine} />
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.vsLine} />
            </View>
            <View style={styles.teamRow}>
              <Text style={styles.heroTeam}>{match.opponentName}</Text>
              {match.opponentScore ? <Text style={styles.heroScore}>{match.opponentScore}</Text> : null}
            </View>
          </View>
          <View style={styles.heroWhen}>
            <View style={styles.heroDate}>
              <Text style={styles.heroDow}>{dateParts.weekday}</Text>
              <Text style={styles.heroDay}>{dateParts.day}</Text>
              <Text style={styles.heroMonth}>{dateParts.month}</Text>
            </View>
            <View style={styles.flexOne}>
              {trustedLive && match.live?.scoreText ? <Text style={styles.heroResult}>{match.live.scoreText}</Text> : null}
              {!trustedLive && match.resultText ? <Text style={styles.heroResult}>{match.resultText}</Text> : null}
              {match.venue ? (
                <View style={styles.heroPlace}>
                  <Ionicons accessible={false} name="location-outline" size={15} color={colors.mint} />
                  <Text style={styles.heroPlaceText}>{match.venue}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {match.status === "live" && !trustedLive ? (
            <Text style={styles.heroNote}>Live score waits on a fresh CCPL poll. Until then, use the official scorecard.</Text>
          ) : null}
          {official ? (
            <Pressable accessibilityRole="link" accessibilityLabel="View official scorecard on CCPL" onPress={() => Linking.openURL(official)} style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Official scorecard on CCPL</Text>
              <Ionicons accessible={false} name="open-outline" size={16} color={colors.ink} />
            </Pressable>
          ) : null}
          <Text style={styles.heroAttr}>Scores via CCPL (CricClubs)</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <Chip label="About" onPress={() => router.push(cricketProgramHref("about") as Href)} />
        <Chip label="Squad" onPress={() => router.push(cricketProgramHref("squad") as Href)} />
        <Chip label="All matches" onPress={() => router.push(cricketProgramHref("matches") as Href)} />
      </View>

      <Text style={styles.sectionLabel}>MATCH CENTRE</Text>
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
  topbar: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  topSpacer: { width: 44, height: 44 },
  topTitle: { color: colors.stone, fontSize: 13, ...typography.label },
  contextLink: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center" },
  contextText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  flexOne: { flex: 1, minWidth: 0 },
  hero: { borderRadius: 26, overflow: "hidden", backgroundColor: colors.greenDeep, marginBottom: spacing.md },
  heroBody: { padding: spacing.xl, gap: spacing.md },
  heroKickerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  heroKicker: { color: colors.mint, fontSize: 11, ...typography.label, letterSpacing: 1.6 },
  heroTeams: { gap: 6 },
  teamRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  heroTeam: { flex: 1, color: colors.white, fontSize: 26, lineHeight: 30, ...typography.heading },
  heroScore: { color: colors.gold, fontSize: 22, ...typography.display },
  vsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  vsLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  vsText: { color: colors.gold, fontSize: 13, ...typography.label, letterSpacing: 2 },
  heroWhen: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  heroDate: { minWidth: 84, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center" },
  heroDow: { color: colors.gold, fontSize: 11, ...typography.label, letterSpacing: 1.4 },
  heroDay: { color: colors.white, fontSize: 40, lineHeight: 42, ...typography.display },
  heroMonth: { color: colors.mint, fontSize: 11, ...typography.label, letterSpacing: 1.2 },
  heroResult: { color: colors.white, fontSize: 18, lineHeight: 24, ...typography.heading },
  heroPlace: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  heroPlaceText: { flex: 1, color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 19, ...typography.body },
  heroNote: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 19, ...typography.body },
  heroButton: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.white },
  heroButtonText: { color: colors.ink, fontSize: 14, ...typography.label },
  heroAttr: { color: "rgba(255,255,255,0.55)", fontSize: 11, ...typography.body },
  sectionLabel: { color: colors.stone, fontSize: 11, marginBottom: spacing.sm, ...typography.label, letterSpacing: 1.4 },
  meta: { color: colors.stone, fontSize: 13, ...typography.body },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  body: { color: colors.stone, fontSize: 14, lineHeight: 21, marginBottom: spacing.sm, ...typography.body },
  card: { padding: spacing.lg, borderRadius: 22, backgroundColor: colors.paper, gap: 8, marginBottom: spacing.md },
  innTitle: { color: colors.ink, fontSize: 18, ...typography.heading },
  batRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { color: colors.ink, fontSize: 15, ...typography.heading },
  dismiss: { color: colors.stone, fontSize: 12, ...typography.body },
  nums: { color: colors.charcoal, fontSize: 13, ...typography.label },
  bowlHead: { marginTop: spacing.md, color: colors.ink, ...typography.heading },
  wicket: { color: colors.danger },
});
