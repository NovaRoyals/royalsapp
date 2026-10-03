import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, UnreadBadge } from '@/components/messages/ChatPieces';
import { useThreads } from '@/components/messages/useThreads';
import { PressableScale } from '@/components/motion';
import { threadTime } from '@/lib/messaging';
import { colors, radius, tints, typography } from '@/theme/tokens';

/**
 * The chat bar at the top of Home. For a parent it is the coach's thread, with the latest
 * message previewed, so a new message is the first thing seen on opening the app. For a coach
 * it summarizes the families waiting on a reply. It is hidden for everyone who has no chat.
 */
export function MessagesBar() {
  const { viewer, coach, families, unread } = useThreads();
  if (!viewer) return null;

  if (viewer.role === 'coach') {
    const newest = families.find((thread) => thread.unread > 0) ?? families[0];
    return (
      <Bar
        title="Family messages"
        preview={newest?.last ? `${newest.title}: ${newest.last.body}` : 'No messages yet'}
        time={newest?.last ? threadTime(newest.last.createdAt) : undefined}
        unread={unread}
        avatar="FM"
        onPress={() => router.push('/messages' as never)}
      />
    );
  }

  if (!coach) return null;
  return (
    <Bar
      title={coach.last ? coach.title : `Message ${coach.title.split(' ').slice(0, 2).join(' ')}`}
      preview={coach.last ? coach.last.body : 'Ask a question, report an absence, or say hello.'}
      time={coach.last ? threadTime(coach.last.createdAt) : undefined}
      unread={coach.unread}
      avatar={coach.avatar}
      onPress={() => router.push(`/message/${coach.id}` as never)}
    />
  );
}

function Bar({ title, preview, time, unread, avatar, onPress }: { title: string; preview: string; time?: string; unread: number; avatar: string; onPress: () => void }) {
  const fresh = unread > 0;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}${fresh ? `, ${unread} unread` : ''}. ${preview}`}
      onPress={onPress}
      style={[styles.bar, fresh && { backgroundColor: tints.gold.bg }]}
    >
      <Avatar label={avatar} tint="gold" size={44} filled={fresh} />
      <View style={styles.copy}>
        <View style={styles.top}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          {time ? <Text style={styles.time}>{time}</Text> : null}
        </View>
        <Text numberOfLines={1} style={[styles.preview, fresh && styles.previewFresh]}>{preview}</Text>
      </View>
      {fresh ? <UnreadBadge count={unread} /> : <Ionicons accessible={false} name="chatbubble-ellipses-outline" size={20} color={colors.stone} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.panel, backgroundColor: colors.paper, marginBottom: 12 },
  copy: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, color: colors.ink, fontSize: 15, ...typography.heading },
  time: { color: colors.stone, fontSize: 11, ...typography.body },
  preview: { color: colors.stone, fontSize: 13, marginTop: 2, ...typography.body },
  previewFresh: { color: colors.charcoal, ...typography.bodyMedium },
});
