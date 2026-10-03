import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, radius, tints, typography, type TintName } from '@/theme/tokens';

export function Avatar({ label, tint = 'mint', size = 44, filled = false }: { label: string; tint?: TintName; size?: number; filled?: boolean }) {
  const scheme = tints[tint];
  return (
    <View
      accessible={false}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: filled ? scheme.accent : scheme.bg }]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.34, color: filled ? colors.white : scheme.accent }]}>{label}</Text>
    </View>
  );
}

/** Pops once when it appears or the number goes up, so a new message is noticed. Never loops. */
export function UnreadBadge({ count }: { count: number }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (count > 0 && !reduced) scale.value = withSequence(withTiming(1.3, { duration: 140 }), withTiming(1, { duration: 200 }));
  }, [count, reduced, scale]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  if (count <= 0) return null;
  return (
    <Animated.View accessibilityLabel={`${count} unread`} style={[styles.badge, popStyle]}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </Animated.View>
  );
}

/** One conversation in the inbox. Unread rows are bolder and tinted so they find you first. */
export function ThreadRow({
  title,
  subtitle,
  preview,
  time,
  unread,
  avatar,
  tint,
  onPress,
}: {
  title: string;
  subtitle?: string;
  preview?: string;
  time?: string;
  unread: number;
  avatar: string;
  tint: TintName;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}${unread ? `, ${unread} unread` : ''}. ${preview ?? ''}`}
      onPress={onPress}
      style={[styles.row, unread > 0 && { backgroundColor: tints[tint].bg }]}
    >
      <Avatar label={avatar} tint={tint} filled={unread > 0} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text numberOfLines={1} style={[styles.rowTitle, unread > 0 && styles.rowTitleUnread]}>{title}</Text>
          {time ? <Text style={styles.rowTime}>{time}</Text> : null}
        </View>
        {subtitle ? <Text numberOfLines={1} style={styles.rowSub}>{subtitle}</Text> : null}
        {preview ? (
          <Text numberOfLines={2} style={[styles.rowPreview, unread > 0 && styles.rowPreviewUnread]}>{preview}</Text>
        ) : null}
      </View>
      <UnreadBadge count={unread} />
    </PressableScale>
  );
}

export function Bubble({ body, time, mine, sender }: { body: string; time: string; mine: boolean; sender?: string }) {
  return (
    <View style={[styles.bubbleWrap, mine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
      {!mine && sender ? <Text style={styles.sender}>{sender}</Text> : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text selectable style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{body}</Text>
      </View>
      <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}</Text>
    </View>
  );
}

/**
 * Message box that stays at the bottom of the screen. Enter sends on the web (Shift+Enter
 * makes a new line). An error from the server rules shows right above the box, in words.
 */
export function Composer({
  placeholder,
  error,
  onSend,
  onType,
}: {
  placeholder: string;
  error?: string;
  /** Returns an error message, or undefined when the message went through. */
  onSend: (text: string) => string | undefined;
  onType?: () => void;
}) {
  const reduced = useReducedMotion();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const input = useRef<TextInput>(null);
  const canSend = text.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    const result = onSend(text);
    if (result) {
      setProblem(result);
      return;
    }
    setProblem(undefined);
    setText('');
    input.current?.focus();
  };

  return (
    <View style={styles.composerWrap}>
      {problem || error ? (
        <View accessibilityLiveRegion="polite" style={styles.problem}>
          <Ionicons accessible={false} name="alert-circle-outline" size={16} color={colors.danger} />
          <Text style={styles.problemText}>{problem ?? error}</Text>
        </View>
      ) : null}
      <View style={styles.composer}>
        <TextInput
          ref={input}
          accessibilityLabel="Message"
          multiline
          value={text}
          onChangeText={(value) => {
            setText(value);
            if (problem) setProblem(undefined);
            onType?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.stone}
          style={styles.input}
          // Enter sends on web; the keyboard's own return key makes a new line on phones.
          onKeyPress={(event) => {
            const key = event.nativeEvent as unknown as { key?: string; shiftKey?: boolean };
            if (Platform.OS === 'web' && key.key === 'Enter' && !key.shiftKey) {
              event.preventDefault?.();
              send();
            }
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!canSend}
          onPress={send}
          style={({ pressed }) => [styles.send, !canSend && styles.sendOff, pressed && !reduced && styles.sendPressed]}
        >
          <Ionicons accessible={false} name="arrow-up" size={20} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.label, letterSpacing: 0.4 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.white, fontSize: 12, ...typography.label },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: colors.paper, marginBottom: 8 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, color: colors.ink, fontSize: 15, ...typography.heading },
  rowTitleUnread: { color: colors.ink },
  rowTime: { color: colors.stone, fontSize: 11, ...typography.body },
  rowSub: { color: colors.stone, fontSize: 12, marginTop: 1, ...typography.body },
  rowPreview: { color: colors.stone, fontSize: 13, lineHeight: 18, marginTop: 3, ...typography.body },
  rowPreviewUnread: { color: colors.charcoal, ...typography.bodyMedium },
  bubbleWrap: { maxWidth: '82%', marginBottom: 8 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { color: colors.stone, fontSize: 11, marginBottom: 3, marginLeft: 4, ...typography.label },
  bubble: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20 },
  bubbleMine: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: colors.paper, borderBottomLeftRadius: 6 },
  bubbleText: { color: colors.ink, fontSize: 15, lineHeight: 21, ...typography.body },
  bubbleTextMine: { color: colors.white },
  bubbleTime: { color: colors.stone, fontSize: 10, marginTop: 3, marginLeft: 6, ...typography.body },
  bubbleTimeMine: { marginLeft: 0, marginRight: 6 },
  composerWrap: { paddingTop: 8, paddingBottom: Platform.OS === 'web' ? 14 : 8, gap: 6 },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  problemText: { flex: 1, color: colors.danger, fontSize: 12, ...typography.body },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 6, paddingLeft: 16, borderRadius: radius.pill, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 36, paddingVertical: 8, color: colors.ink, fontSize: 15, ...typography.body },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: colors.mintDeep },
  sendPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
});

