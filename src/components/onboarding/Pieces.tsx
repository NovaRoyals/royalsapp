import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';

import { PressableScale } from '@/components/motion';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export type Tint = 'green' | 'blue' | 'teal' | 'amber' | 'rose';

const tints: Record<Tint, { bg: string; fg: string }> = {
  green: { bg: colors.mint, fg: colors.ink },
  blue: { bg: colors.blueSoft, fg: colors.blue },
  teal: { bg: colors.tealSoft, fg: colors.teal },
  amber: { bg: colors.amberSoft, fg: colors.amber },
  rose: { bg: colors.roseSoft, fg: colors.rose },
};

function IconTile({ icon, tint, size = 40 }: { icon: keyof typeof Ionicons.glyphMap; tint: Tint; size?: number }) {
  const scheme = tints[tint];
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size / 2, backgroundColor: scheme.bg }]}>
      <Ionicons name={icon} size={size * 0.46} color={scheme.fg} />
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
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint?: Tint;
  title: string;
  detail?: string;
  selected?: boolean;
  trailing?: 'chevron' | 'checkbox' | 'none';
  onPress?: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <IconTile icon={icon} tint={tint} />
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
      </View>
      {trailing === 'chevron' ? <Ionicons name="chevron-forward" size={16} color={colors.stone} /> : null}
      {trailing === 'checkbox' ? (
        <View style={[styles.box, selected && styles.boxOn]}>
          {selected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

export function ProviderButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.provider}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.providerLabel}>{label}</Text>
    </PressableScale>
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
  ...props
}: TextInputProps & { label: string; valid?: boolean; hint?: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, valid && styles.fieldBoxOn]}>
        <TextInput placeholderTextColor={colors.stone} style={styles.field} {...props} />
        {valid ? <Ionicons name="checkmark-circle" size={20} color={colors.greenBright} /> : null}
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
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

export function TickRow({ label }: { label: string }) {
  return (
    <View style={styles.tickRow}>
      <View style={styles.tick}>
        <Ionicons name="checkmark" size={12} color={colors.ink} />
      </View>
      <Text style={styles.tickLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  card: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardSelected: { borderColor: colors.ink, backgroundColor: colors.paper },
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
  provider: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  providerLabel: { color: colors.ink, fontSize: 15, ...typography.heading },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 10 },
  ruleLine: { flex: 1, height: 1, backgroundColor: colors.border },
  ruleText: { color: colors.stone, fontSize: 12, ...typography.body },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: colors.stone, fontSize: 12, marginBottom: 6, ...typography.label },
  fieldBox: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  fieldBoxOn: { borderColor: colors.ink },
  field: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: 12, ...typography.body },
  fieldHint: { color: colors.stone, fontSize: 12, marginTop: 6, ...typography.body },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.mintDeep, alignItems: 'center', justifyContent: 'center' },
  tickLabel: { color: colors.white, fontSize: 14, ...typography.bodyMedium },
});
