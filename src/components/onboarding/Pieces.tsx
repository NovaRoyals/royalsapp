import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Image } from 'expo-image';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';

import { CricketMark } from '@/components/icons/CricketMark';
import { PressableScale } from '@/components/motion';
import { royPoseSource, type RoyPose } from '@/components/mascot/poses';
import { useReducedMotion } from '@/lib/reducedMotion';
import { colors, radius, typography } from '@/theme/tokens';

export type Tint = 'green' | 'blue' | 'teal' | 'amber' | 'rose';

const tints: Record<Tint, { bg: string; fg: string }> = {
  green: { bg: colors.mint, fg: colors.ink },
  blue: { bg: colors.blueSoft, fg: colors.blue },
  teal: { bg: colors.tealSoft, fg: colors.teal },
  amber: { bg: colors.amberSoft, fg: colors.amber },
  rose: { bg: colors.roseSoft, fg: colors.rose },
};

function IconTile({
  icon,
  tint,
  size = 40,
  cricket = false,
  filled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: Tint;
  size?: number;
  cricket?: boolean;
  filled?: boolean;
}) {
  const scheme = tints[tint];
  const fg = filled ? colors.white : scheme.fg;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 2, backgroundColor: filled ? scheme.fg : scheme.bg }]}>
      {cricket ? <CricketMark size={size * 0.5} color={fg} /> : <Ionicons accessible={false} name={icon} size={size * 0.46} color={fg} />}
    </View>
  );
}

/**
 * Roy's face in a round tile, in a different pose for each choice. Still until you pick one: then
 * he cheers and hops once. No looping movement.
 */
function RoyTile({ pose, tint, selected, size = 58 }: { pose: RoyPose; tint: Tint; selected?: boolean; size?: number }) {
  const reduced = useReducedMotion();
  const hop = useSharedValue(0);
  useEffect(() => {
    if (selected && !reduced) {
      hop.value = withSequence(withTiming(-10, { duration: 130, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 260, easing: Easing.bounce }));
    }
  }, [hop, reduced, selected]);
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));
  const scheme = tints[tint];
  const image = size * 1.75;
  return (
    <View style={[styles.royTile, { width: size, height: size, borderRadius: size / 2, backgroundColor: selected ? scheme.fg : scheme.bg }]}>
      <Animated.View style={hopStyle}>
        <Image
          source={royPoseSource[selected ? 'celebrate' : pose]}
          alt=""
          contentFit="contain"
          contentPosition="top center"
          style={{ width: image, height: image, marginLeft: (size - image) / 2, marginTop: -size * 0.04 }}
        />
      </Animated.View>
    </View>
  );
}

export function ChoiceCard({
  icon,
  tint = 'green',
  title,
  detail,
  selected,
  trailing = 'chevron',
  cricket,
  roy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: Tint;
  roy?: RoyPose;
  title: string;
  detail?: string;
  selected?: boolean;
  trailing?: 'chevron' | 'checkbox' | 'none';
  cricket?: boolean;
  onPress?: () => void;
}) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (selected && !reduced) pop.value = withSequence(withTiming(1.04, { duration: 110 }), withTiming(1, { duration: 170 }));
  }, [pop, reduced, selected]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const scheme = tints[tint];
  // Picking one tints the whole card in its own color; the rest stay quiet.
  return (
    <Animated.View style={popStyle}>
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.card, selected && { backgroundColor: scheme.bg, borderColor: scheme.fg }]}
    >
      {roy ? (
        <RoyTile pose={roy} tint={tint} selected={selected} />
      ) : (
        <IconTile icon={selected ? 'checkmark' : icon} tint={tint} cricket={selected ? false : cricket} filled={selected} />
      )}
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
      </View>
      {trailing === 'chevron' ? (
        <Ionicons accessible={false} name="chevron-forward" size={18} color={selected ? scheme.fg : colors.stone} />
      ) : null}
      {trailing === 'checkbox' ? (
        <View style={[styles.box, selected && styles.boxOn]}>
          {selected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
        </View>
      ) : null}
    </PressableScale>
    </Animated.View>
  );
}

export function ProviderButton({
  icon,
  label,
  color,
  onPress,
  onCancel,
  status = 'idle',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress?: () => void;
  onCancel?: () => void;
  status?: 'idle' | 'loading' | 'error';
}) {
  const loading = status === 'loading';
  return (
    <View style={styles.providerWrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={onPress}
        style={[styles.provider, status === 'error' && styles.providerError]}
      >
        {loading ? <ActivityIndicator color={colors.ink} /> : <Ionicons name={icon} size={20} color={color} />}
        <Text style={styles.providerLabel}>{loading ? 'Connecting…' : label}</Text>
      </PressableScale>
      {loading && onCancel ? (
        <PressableScale accessibilityRole="button" accessibilityLabel="Cancel sign-in" onPress={onCancel} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function OrRule({ label = 'or' }: { label?: string }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleLine} />
      <Text style={styles.ruleText}>{label}</Text>
      <View style={styles.ruleLine} />
    </View>
  );
}

export function FlowField({
  label,
  valid,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; valid?: boolean; hint?: string; error?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, valid && !error && styles.fieldBoxOn, Boolean(error) && styles.fieldBoxError]}>
        <TextInput placeholderTextColor={colors.stone} style={styles.field} {...props} />
        {valid && !error ? <Ionicons name="checkmark-circle" size={20} color={colors.greenBright} /> : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function ToggleRow({
  icon,
  tint = 'green',
  label,
  detail,
  value,
  onValueChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: Tint;
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <IconTile icon={icon} tint={tint} size={36} />
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{label}</Text>
        {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.ink, false: colors.mintDeep }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  royTile: { overflow: 'hidden', alignItems: 'center' },
  flex: { flex: 1 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  card: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardSelected: { borderColor: colors.ink, backgroundColor: colors.mint },
  cardTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  cardDetail: { color: colors.stone, fontSize: 12, lineHeight: 16, marginTop: 2, ...typography.body },
  box: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.mintDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  providerWrap: { marginBottom: 8 },
  provider: {
    minHeight: 52,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  providerError: { borderColor: colors.danger },
  providerLabel: { color: colors.ink, fontSize: 15, ...typography.heading },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.stone, fontSize: 13, ...typography.label },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  ruleLine: { flex: 1, height: 1, backgroundColor: colors.border },
  ruleText: { color: colors.stone, fontSize: 12, ...typography.body },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: colors.stone, fontSize: 12, marginBottom: 6, ...typography.label },
  fieldBox: {
    minHeight: 52,
    borderRadius: radius.input,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  fieldBoxOn: { borderColor: colors.ink },
  fieldBoxError: { borderColor: colors.danger },
  field: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: 12, ...typography.body },
  fieldHint: { color: colors.stone, fontSize: 12, marginTop: 6, ...typography.body },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 6, ...typography.body },
});
