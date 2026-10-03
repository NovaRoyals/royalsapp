import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { CloudBackdrop } from '@/components/brand/CloudBackdrop';
import { Avatar, ThreadRow, UnreadBadge } from '@/components/messages/ChatPieces';
import { useThreads, type ThreadSummary } from '@/components/messages/useThreads';
import { PressableScale } from '@/components/motion';
import { Button, EmptyState, Screen } from '@/components/ui';
import { parentLabel, threadTime } from '@/lib/messaging';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, gradients, radius, spacing, typography } from '@/theme/tokens';

const open = (id: string) => router.push(`/message/${id}` as never);

export default function MessagesScreen() {
  const { role, parentChatOn, setParentChat } = useApp();
  const { viewer, coach, families, parentThreads, available, unread } = useThreads();

  if (!viewer) {
    return (
      <Screen>
        <Header title="Messages" />
        <EmptyState
          pose="wave"
          title={role === 'guest' ? 'Sign in to message your coach' : 'Messages are for families and coaches'}
          message={role === 'guest' ? 'Parents can message their coach and, if they choose, other parents on the team.' : 'Players and volunteers get club and team news in Notifications.'}
          action={role === 'guest' ? <Button label="Sign in" onPress={() => router.push('/onboarding?mode=signin' as never)} /> : undefined}
        />
      </Screen>
    );
  }

  // ---- the coach's side: one thread per family
  if (viewer.role === 'coach') {
    return (
      <Screen>
        <Header title="Family messages" badge={unread} />
        <Text style={styles.lead}>Families write to you here. Parents can’t see each other’s messages.</Text>
        {families.length === 0 ? (
          <EmptyState pose="thumbsup" title="No messages yet" message="When a family writes to you, it shows up here and in Notifications." />
        ) : (
          families.map((thread) => <Row key={thread.id} thread={thread} />)
        )}
        <Button label="Send an update to all families" icon="megaphone-outline" variant="secondary" onPress={() => router.push('/admin' as never)} style={styles.cta} />
      </Screen>
    );
  }

  // ---- a parent's side: the coach first, then optional parent chat
  return (
    <Screen>
      <Header title="Messages" badge={unread} />

      {coach ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={`Message ${coach.title}`} onPress={() => open(coach.id)} style={styles.coachCard}>
          <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <CloudBackdrop />
          <View style={styles.coachTop}>
            <Avatar label={coach.avatar} tint="gold" size={46} filled />
            <View style={styles.flex}>
              <Text style={styles.coachName}>{coach.title}</Text>
              <Text style={styles.coachSub}>{coach.subtitle} · your main line to the team</Text>
            </View>
            <UnreadBadge count={coach.unread} />
          </View>
          <Text numberOfLines={3} style={[styles.coachPreview, coach.unread > 0 && styles.coachPreviewUnread]}>
            {coach.last ? coach.last.body : 'Ask about a session, let them know about an absence, or share anything that helps.'}
          </Text>
          <View style={styles.coachFoot}>
            <Text style={styles.coachTime}>{coach.last ? threadTime(coach.last.createdAt) : ''}</Text>
            <View style={styles.replyPill}>
              <Text style={styles.replyText}>{coach.last ? 'Reply' : 'Say hello'}</Text>
              <Ionicons accessible={false} name="arrow-forward" size={15} color={colors.ink} />
            </View>
          </View>
        </PressableScale>
      ) : null}

      <Pressable accessibilityRole="link" onPress={() => router.push('/updates' as never)} style={styles.linkRow}>
        <View style={[styles.linkIcon, { backgroundColor: colors.sky }]}>
          <Ionicons accessible={false} name="megaphone-outline" size={18} color={colors.blue} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.linkTitle}>Team updates and recaps</Text>
          <Text style={styles.linkSub}>Announcements and session notes from your coach</Text>
        </View>
        <Ionicons accessible={false} name="chevron-forward" size={18} color={colors.stone} />
      </Pressable>

      <Text style={styles.section}>PARENTS ON U8</Text>
      <View style={styles.optIn}>
        <View style={styles.optInTop}>
          <View style={styles.flex}>
            <Text style={styles.optTitle}>Let team parents message me</Text>
            <Text style={styles.optBody}>Off by default. Turn it on to chat with other U8 parents who’ve done the same.</Text>
          </View>
          <Switch
            accessibilityLabel="Let team parents message me"
            value={parentChatOn}
            onValueChange={setParentChat}
            trackColor={{ true: colors.ink, false: colors.mintDeep }}
            thumbColor={colors.white}
          />
        </View>
        <View style={styles.rules}>
          <Rule icon="person-outline" text="Parents are shown as “Parent of” a child’s first name, never by phone or email." />
          <Rule icon="chatbubbles-outline" text="One-to-one only, with parents on your child’s team. Children never message." />
          <Rule icon="flag-outline" text="You can block or report any chat. Phone numbers, emails and links can’t be sent." />
        </View>
      </View>

      {parentChatOn ? (
        <>
          {parentThreads.map((thread) => <Row key={thread.id} thread={thread} />)}
          {available.length > 0 ? <Text style={styles.sub}>Start a chat</Text> : null}
          {available.map((child) => (
            <PressableScale key={child.id} accessibilityRole="button" accessibilityLabel={`Message ${parentLabel(child.firstName)}`} onPress={() => open(`parent-${child.id}`)} style={styles.person}>
              <Avatar label={child.firstName[0] + 'P'} tint="sky" size={38} />
              <Text style={styles.personName}>{parentLabel(child.firstName)}</Text>
              <Ionicons accessible={false} name="chatbubble-outline" size={18} color={colors.stone} />
            </PressableScale>
          ))}
          {parentThreads.length === 0 && available.length === 0 ? (
            <Text style={styles.empty}>No other parents have turned parent chat on yet.</Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Row({ thread }: { thread: ThreadSummary }) {
  return (
    <ThreadRow
      title={thread.title}
      subtitle={thread.subtitle}
      preview={thread.last?.body}
      time={thread.last ? threadTime(thread.last.createdAt) : undefined}
      unread={thread.unread}
      avatar={thread.avatar}
      tint={thread.tint}
      onPress={() => open(thread.id)}
    />
  );
}

function Rule({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.rule}>
      <Ionicons accessible={false} name={icon} size={16} color={colors.greenBright} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

function Header({ title, badge = 0 }: { title: string; badge?: number }) {
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)')} style={styles.back}>
        <Ionicons name="arrow-back" size={21} color={colors.ink} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <UnreadBadge count={badge} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.ink, fontSize: 24, ...typography.pageTitle },
  lead: { color: colors.stone, fontSize: 13, lineHeight: 19, marginBottom: 12, ...typography.body },
  cta: { marginTop: 8 },
  coachCard: { borderRadius: 26, overflow: 'hidden', padding: 16, gap: 12, backgroundColor: colors.greenDeep, marginBottom: 10 },
  coachTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coachName: { color: colors.white, fontSize: 18, ...typography.heading },
  coachSub: { color: colors.mint, fontSize: 12, marginTop: 1, ...typography.body },
  coachPreview: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 20, ...typography.body },
  coachPreviewUnread: { color: colors.white, ...typography.bodyMedium },
  coachFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coachTime: { color: 'rgba(255,255,255,0.6)', fontSize: 12, ...typography.body },
  replyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.white },
  replyText: { color: colors.ink, fontSize: 14, ...typography.label },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: colors.paper },
  linkIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  linkTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  linkSub: { color: colors.stone, fontSize: 12, marginTop: 1, ...typography.body },
  section: { color: colors.stone, fontSize: 11, marginTop: 18, marginBottom: 8, ...typography.label, letterSpacing: 1.1 },
  sub: { color: colors.stone, fontSize: 12, marginTop: 6, marginBottom: 8, ...typography.label },
  optIn: { padding: 14, borderRadius: 22, backgroundColor: colors.paper, gap: 12, marginBottom: 10 },
  optInTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  optBody: { color: colors.stone, fontSize: 12, lineHeight: 17, marginTop: 2, ...typography.body },
  rules: { gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ruleText: { flex: 1, color: colors.charcoal, fontSize: 12, lineHeight: 17, ...typography.body },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.paper, marginBottom: 8 },
  personName: { flex: 1, color: colors.ink, fontSize: 14, ...typography.label },
  empty: { color: colors.stone, fontSize: 13, textAlign: 'center', paddingVertical: spacing.lg, ...typography.body },
});
