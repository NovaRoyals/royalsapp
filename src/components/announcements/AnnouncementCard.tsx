import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { audienceLabel, kindOf, KINDS } from '@/lib/announcements';
import { threadTime } from '@/lib/messaging';
import { colors, tints, typography } from '@/theme/tokens';
import type { Announcement } from '@/types/domain';

/**
 * One announcement. A cancellation is drawn heavier than the rest, with a red edge and its own
 * label, because it is the one a family must not scroll past.
 */
export function AnnouncementCard({
  announcement,
  onPress,
  lines = 2,
  preview = false,
}: {
  announcement: Announcement;
  onPress?: () => void;
  lines?: number;
  /** Used inside the composer: not tappable. */
  preview?: boolean;
}) {
  const kind = kindOf(announcement);
  const meta = KINDS[kind];
  const tint = tints[meta.tint];
  const critical = kind === 'cancellation' || announcement.urgency === 'urgent';
  const body = (
    <>
      {critical ? <View style={styles.edge} /> : null}
      <View style={[styles.icon, { backgroundColor: critical ? colors.white : tint.bg }]}>
        <Ionicons accessible={false} name={meta.icon} size={20} color={tint.accent} />
      </View>
      <View style={styles.copy}>
        <View style={styles.top}>
          <Text style={[styles.kind, { color: tint.accent }]}>{meta.label.toUpperCase()}</Text>
          <Text style={styles.time}>{threadTime(announcement.publishedAt)}</Text>
        </View>
        <Text numberOfLines={2} style={styles.title}>{announcement.title}</Text>
        <Text numberOfLines={lines} style={styles.body}>{announcement.body}</Text>
        <View style={styles.foot}>
          <View style={styles.audience}>
            <Ionicons accessible={false} name="people-outline" size={13} color={colors.stone} />
            <Text style={styles.audienceText}>{audienceLabel(announcement)}</Text>
          </View>
          {announcement.authorName ? <Text style={styles.author}>{announcement.authorName}</Text> : null}
        </View>
      </View>
    </>
  );
  const style = [styles.card, critical && { backgroundColor: tints.blush.bg }];
  if (preview || !onPress) return <View style={style}>{body}</View>;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${meta.label}: ${announcement.title}. ${audienceLabel(announcement)}`} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.paper, marginBottom: 10, overflow: 'hidden' },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: colors.danger },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kind: { fontSize: 10, ...typography.label, letterSpacing: 1.2 },
  time: { color: colors.stone, fontSize: 11, ...typography.body },
  title: { color: colors.ink, fontSize: 16, lineHeight: 21, ...typography.heading },
  body: { color: colors.charcoal, fontSize: 13, lineHeight: 19, ...typography.body },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  audienceText: { color: colors.stone, fontSize: 12, ...typography.label },
  author: { color: colors.stone, fontSize: 12, ...typography.body },
});
