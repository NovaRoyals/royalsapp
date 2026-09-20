import { Href, Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen, StatusPill } from "@/components/ui";
import { displayCricketName, getPlayerProfile } from "@/lib/cricket";
import { safeBack } from "@/lib/nav";
import { useApp } from "@/state/AppProvider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

import { cricketSquad } from "@/data/ccpl";

export function generateStaticParams() {
  return cricketSquad.map((player) => ({ id: player.id }));
}

export default function CricketPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useApp();
  const signedIn = role !== "guest";
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getPlayerProfile>>>();

  useEffect(() => {
    if (id) getPlayerProfile(id).then(setProfile);
  }, [id]);

  if (!profile) {
    return (
      <Screen>
        <Text style={styles.body}>Royals player profiles only. Opponent names stay on the match.</Text>
        <Pressable onPress={() => safeBack("/program/ccpl-cricket")}><Text style={styles.link}>Back</Text></Pressable>
      </Screen>
    );
  }

  const { player, log } = profile;
  return (
    <Screen>
      <Pressable accessibilityLabel="Go back" onPress={() => safeBack("/program/ccpl-cricket")} style={styles.back}>
        <Text style={styles.link}>Back</Text>
      </Pressable>
      <Text style={styles.name}>{displayCricketName(player.fullName, signedIn)}</Text>
      <View style={styles.flags}>
        <StatusPill label={player.role.replace("_", " ")} />
        {player.isCaptain ? <StatusPill label="Captain" tone="orange" /> : null}
        {player.isViceCaptain ? <StatusPill label="VC" /> : null}
        {player.isKeeper ? <StatusPill label="WK" /> : null}
      </View>
      {profile.matches > 0 && (profile.runs > 0 || profile.wickets > 0) ? (
        <View style={styles.stats}>
          <Stat label="Matches" value={String(profile.matches)} />
          <Stat label="Runs" value={String(profile.runs)} />
          <Stat label="Avg" value={profile.average == null ? "—" : String(profile.average)} />
          <Stat label="SR" value={profile.strikeRate == null ? "—" : String(profile.strikeRate)} />
          <Stat label="50/100" value={`${profile.fifties}/${profile.hundreds}`} />
          <Stat label="Wkts" value={String(profile.wickets)} />
        </View>
      ) : (
        <Text style={styles.hint}>Career figures appear after CCPL scorecards backfill. Empty is not a zero.</Text>
      )}
      {log.map((row) => (
        <Link key={`${row.matchId}-${row.date}`} href={`/cricket/match/${row.matchId}` as Href} asChild>
          <Pressable style={styles.log}>
            <Text style={styles.logDate}>{row.date} · {row.opponent}</Text>
            <Text style={styles.logLine}>{row.runs != null ? `${row.runs} runs` : ""}{row.wickets != null ? ` · ${row.wickets} wkts` : ""}</Text>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: "center" },
  link: { color: colors.ink, ...typography.label },
  name: { color: colors.ink, fontSize: 32, ...typography.display },
  flags: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: { width: "30%", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper },
  statValue: { color: colors.ink, fontSize: 20, ...typography.heading },
  statLabel: { color: colors.stone, fontSize: 11, ...typography.label },
  hint: { color: colors.stone, fontSize: 12, marginVertical: spacing.md, ...typography.body },
  log: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, marginBottom: spacing.sm },
  logDate: { color: colors.ink, ...typography.heading },
  logLine: { color: colors.stone, marginTop: 4, ...typography.body },
  body: { color: colors.stone, ...typography.body },
});
