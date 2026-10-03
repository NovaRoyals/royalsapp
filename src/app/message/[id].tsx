import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Bubble, Composer } from '@/components/messages/ChatPieces';
import { useToast } from '@/components/Toast';
import { Button, EmptyState, Field, Screen, StatusPill } from '@/components/ui';
import { demoAnnouncements, familyThreadLabels, kidsU8Roster } from '@/data/demo';
import { can } from '@/lib/capabilities';
import { ACTIVE_COACH } from '@/lib/coachRecap';
import { formatInstantTime } from '@/lib/datetime';
import {
  COACH_THREAD,
  canSeeThread,
  initialsOf,
  isMine,
  messagesIn,
  parentLabel,
  threadChildId,
  threadKind,
  viewerFor,
  withDayBreaks,
} from '@/lib/messaging';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return [
    ...demoAnnouncements.map((item) => ({ id: item.id })),
    { id: COACH_THREAD },
    ...kidsU8Roster.flatMap((child) => [{ id: `parent-${child.id}` }, { id: `family-${child.id}` }]),
  ];
}

const REPORT_REASONS = ['Inappropriate message', 'Spam or selling', 'Made me uncomfortable', 'Something else'];

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { announcements } = useApp();
  const announcement = announcements.find((item) => item.id === id);
  if (announcement) return <AnnouncementThread announcementId={announcement.id} />;
  return <ChatThread threadId={id ?? COACH_THREAD} />;
}

function ChatThread({ threadId }: { threadId: string }) {
  const { role, household, messages, blockedThreads, parentChatOn, sendDirectMessage, markThreadRead, blockThread, reportThread } = useApp();
  const toast = useToast();
  const viewer = viewerFor(role, household.id);
  const kind = threadKind(threadId);
  const allowed = canSeeThread(viewer, threadId);
  const blocked = blockedThreads.includes(threadId);
  const list = useMemo(() => messagesIn(messages, threadId), [messages, threadId]);
  const rows = useMemo(() => withDayBreaks(list), [list]);
  const scroller = useRef<ScrollView>(null);
  const [menu, setMenu] = useState<'closed' | 'open' | 'report'>('closed');

  const head = useMemo(() => {
    if (kind === 'coach' && viewer?.role === 'guardian') return { title: ACTIVE_COACH.displayName, subtitle: 'U8 coach', tint: 'gold' as const };
    if (kind === 'coach' || kind === 'family') {
      const label = familyThreadLabels[threadId];
      return { title: label?.title ?? 'Family', subtitle: label?.subtitle, tint: 'gold' as const };
    }
    const child = kidsU8Roster.find((person) => person.id === threadChildId(threadId));
    return { title: parentLabel(child?.firstName ?? 'a teammate'), subtitle: 'U8 parent', tint: 'sky' as const };
  }, [kind, threadId, viewer?.role]);

  // Opening a thread, or a message landing while it is open, counts as reading it.
  const lastId = list[list.length - 1]?.id;
  useEffect(() => {
    if (allowed) markThreadRead(threadId);
  }, [allowed, lastId, markThreadRead, threadId]);

  if (!allowed) {
    return (
      <Screen>
        <TopBar title="Messages" />
        <EmptyState
          pose="lookLeft"
          title="This conversation isn’t available"
          message="Messages are private to the people in them."
          action={<Button label="Back to messages" onPress={() => router.replace('/messages' as never)} />}
        />
      </Screen>
    );
  }

  const send = (text: string) => {
    const result = sendDirectMessage(threadId, text);
    return result.ok ? undefined : result.error;
  };

  return (
    <Screen scroll={false} contentStyle={styles.chatFrame}>
      <TopBar
        title={head.title}
        subtitle={head.subtitle}
        avatar={<Avatar label={kind === 'coach' && viewer?.role === 'guardian' ? initialsOf(ACTIVE_COACH.fullName) : initialsOf(head.title)} tint={head.tint} size={38} filled />}
        onMenu={kind === 'parent' ? () => setMenu(menu === 'closed' ? 'open' : 'closed') : undefined}
      />

      {kind === 'parent' ? (
        <View style={styles.safety}>
          <Ionicons accessible={false} name="shield-checkmark-outline" size={16} color={colors.success} />
          <Text style={styles.safetyText}>Parent chat. Only U8 parents who turned this on. No phone numbers, emails or links, and children never message.</Text>
        </View>
      ) : null}

      {menu !== 'closed' ? (
        <View style={styles.menu}>
          {menu === 'open' ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => { blockThread(threadId, !blocked); setMenu('closed'); toast(blocked ? 'Unblocked' : 'Blocked. You won’t get messages from this parent.'); }} style={styles.menuRow}>
                <Ionicons accessible={false} name={blocked ? 'checkmark-circle-outline' : 'ban-outline'} size={18} color={colors.ink} />
                <Text style={styles.menuText}>{blocked ? 'Unblock this parent' : 'Block this parent'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setMenu('report')} style={styles.menuRow}>
                <Ionicons accessible={false} name="flag-outline" size={18} color={colors.danger} />
                <Text style={[styles.menuText, { color: colors.danger }]}>Report this conversation</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.menuHead}>What’s wrong?</Text>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  accessibilityRole="button"
                  onPress={() => {
                    reportThread(threadId, reason);
                    setMenu('closed');
                    toast('Reported. The club will review it.');
                    router.replace('/messages' as never);
                  }}
                  style={styles.menuRow}
                >
                  <Text style={styles.menuText}>{reason}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={() => setMenu('closed')} style={styles.menuRow}>
                <Text style={[styles.menuText, { color: colors.stone }]}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      <ScrollView
        ref={scroller}
        style={styles.flex}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
      >
        {rows.length === 0 ? (
          <EmptyState
            pose="wave"
            title={kind === 'parent' ? 'Start the conversation' : kind === 'family' ? 'No messages yet' : `Say hello to ${head.title}`}
            message={kind === 'coach' && viewer?.role === 'guardian' ? 'Ask about a session, let them know about an absence, or share anything that helps.' : kind === 'parent' ? `You’re chatting with ${head.title.toLowerCase()}. Keep it friendly and about the team.` : 'Messages from this family will show up here.'}
          />
        ) : (
          rows.map((row) =>
            row.type === 'day' ? (
              <Text key={row.key} style={styles.day}>{row.label}</Text>
            ) : (
              <Bubble
                key={row.key}
                body={row.message.body}
                mine={isMine(row.message, viewer)}
                sender={kind === 'parent' ? row.message.fromName : undefined}
                time={formatInstantTime(new Date(row.message.createdAt))}
              />
            ),
          )
        )}
      </ScrollView>

      {blocked ? (
        <View style={styles.blocked}>
          <Text style={styles.blockedText}>You blocked this conversation.</Text>
          <Button label="Unblock" variant="secondary" onPress={() => blockThread(threadId, false)} />
        </View>
      ) : kind === 'parent' && !parentChatOn ? (
        <View style={styles.blocked}>
          <Text style={styles.blockedText}>Parent chat is off. Turn it on from Messages to reply.</Text>
          <Button label="Open Messages" variant="secondary" onPress={() => router.replace('/messages' as never)} />
        </View>
      ) : (
        <Composer placeholder={kind === 'coach' && viewer?.role === 'guardian' ? 'Message Coach Priya' : 'Write a message'} onSend={send} />
      )}
    </Screen>
  );
}

function TopBar({
  title,
  subtitle,
  avatar,
  onMenu,
}: {
  title: string;
  subtitle?: string;
  avatar?: React.ReactNode;
  onMenu?: () => void;
}) {
  return (
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/messages' as never)} style={styles.back}>
        <Ionicons name="arrow-back" size={21} color={colors.ink} />
      </Pressable>
      {avatar}
      <View style={styles.topCopy}>
        <Text numberOfLines={1} style={styles.topTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.topSub}>{subtitle}</Text> : null}
      </View>
      {onMenu ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Conversation options" onPress={onMenu} style={styles.back}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

/** Club and team announcements, with replies from parents. Unchanged in behavior. */
function AnnouncementThread({ announcementId }: { announcementId: string }) {
  const { announcements, replyToAnnouncement, role } = useApp();
  const announcement = announcements.find((item) => item.id === announcementId)!;
  const [draft, setDraft] = useState('');
  const canReply = can(role, 'reply_coach');

  return (
    <Screen>
      <TopBar title="Announcement" />
      <StatusPill label={announcement.urgency ?? 'normal'} tone={announcement.urgency === 'urgent' ? 'warning' : 'orange'} />
      <Text style={styles.title}>{announcement.title}</Text>
      <Text style={styles.scope}>{announcement.scopeLabel}</Text>
      <Text style={styles.body}>{announcement.body}</Text>
      <Text style={styles.section}>REPLIES</Text>
      {(announcement.replies ?? []).map((reply) => (
        <View key={reply.id} style={styles.bubble}>
          <Text style={styles.meta}>{reply.authorName}</Text>
          <Text style={styles.body}>{reply.body}</Text>
        </View>
      ))}
      {canReply ? (
        <>
          <Field label="Reply to coach" value={draft} onChangeText={setDraft} multiline />
          <Button label="Post reply" disabled={!draft.trim()} onPress={() => { replyToAnnouncement(announcement.id, draft.trim()); setDraft(''); }} />
        </>
      ) : (
        <Text style={styles.lead}>Replies are limited to parents, players, and staff on this team.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chatFrame: { flex: 1, width: '100%', maxWidth: 720 },
  topbar: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 44, height: 44 },
  topCopy: { flex: 1, minWidth: 0 },
  topTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  topSub: { color: colors.stone, fontSize: 12, ...typography.body },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.mint, marginBottom: 6 },
  safetyText: { flex: 1, color: colors.charcoal, fontSize: 12, lineHeight: 17, ...typography.body },
  menu: { padding: 6, borderRadius: 20, backgroundColor: colors.paper, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  menuRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  menuText: { color: colors.ink, fontSize: 14, ...typography.label },
  menuHead: { color: colors.stone, fontSize: 12, paddingHorizontal: 12, paddingTop: 8, ...typography.label },
  list: { paddingVertical: 8, flexGrow: 1, justifyContent: 'flex-end' },
  day: { alignSelf: 'center', color: colors.stone, fontSize: 11, marginVertical: 10, ...typography.label, letterSpacing: 0.6 },
  blocked: { padding: 12, borderRadius: 20, backgroundColor: colors.paper, gap: 8, marginBottom: 8 },
  blockedText: { color: colors.stone, fontSize: 13, textAlign: 'center', ...typography.body },
  title: { color: colors.ink, fontSize: 24, marginTop: spacing.md, ...typography.heading },
  scope: { color: colors.orangeDark, fontSize: 12, marginTop: 4, ...typography.label },
  body: { color: colors.stone, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, ...typography.body },
  section: { color: colors.stone, fontSize: 11, marginTop: spacing.xl, marginBottom: spacing.sm, ...typography.label, letterSpacing: 1 },
  bubble: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, marginBottom: spacing.sm },
  meta: { color: colors.orangeDark, fontSize: 11, ...typography.label },
  lead: { color: colors.stone, fontSize: 13, lineHeight: 19, marginTop: spacing.lg, ...typography.body },
});
