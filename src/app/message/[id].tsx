import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Field, Screen, StatusPill } from '@/components/ui';
import { demoAnnouncements } from '@/data/demo';
import { can } from '@/lib/capabilities';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return [...demoAnnouncements.map((item) => ({ id: item.id })), { id: 'coach-priya' }];
}

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { announcements, messages, replyToAnnouncement, sendDirectMessage, role } = useApp();
  const announcement = announcements.find((item) => item.id === id);
  const [draft, setDraft] = useState('');
  const canReply = can(role, 'reply_coach');

  if (id === 'coach-priya' || !announcement) {
    const thread = messages.filter((item) => item.threadId === 'coach-priya');
    return (
      <Screen>
        <Header title="Message coach" />
        <StatusPill label="Parent ↔ coach · not group chat" tone="orange" />
        <Text style={styles.lead}>Youth-safe foundation: no child-to-child chat, no public youth identities.</Text>
        {thread.map((item) => (
          <View key={item.id} style={styles.bubble}>
            <Text style={styles.meta}>{item.fromName}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        ))}
        {canReply ? (
          <>
            <Field label="Reply" value={draft} onChangeText={setDraft} multiline />
            <Button label="Send to coach" disabled={!draft.trim()} onPress={() => { sendDirectMessage('coach-priya', draft.trim()); setDraft(''); }} />
          </>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Announcement" />
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

function Header({ title }: { title: string }) {
  return (
    <View style={styles.topbar}>
      <Pressable accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)')} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.back} />
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  lead: { color: colors.stone, fontSize: 13, lineHeight: 19, marginVertical: spacing.md, ...typography.body },
  title: { color: colors.ink, fontSize: 26, marginTop: spacing.lg, ...typography.heading },
  scope: { color: colors.orangeDark, fontSize: 11, marginTop: 6, marginBottom: spacing.md, ...typography.label },
  body: { color: colors.charcoal, fontSize: 14, lineHeight: 21, ...typography.body },
  section: { color: colors.stone, fontSize: 10, marginTop: spacing.xxl, marginBottom: spacing.sm, ...typography.label },
  bubble: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, marginBottom: spacing.sm },
  meta: { color: colors.orangeDark, fontSize: 10, marginBottom: 4, ...typography.label },
});
