import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TapAway } from '@/components/overlays/TapAway';
import { formatDateMenu, formatTimeChip, PITCH_TIMES } from '@/lib/fields';
import { colors, radius, shadow, spacing, typography } from '@/theme/tokens';

type Menu = 'date' | 'time' | null;

export function FieldToolbar({
  date,
  dates,
  today,
  time,
  turfOnly,
  onDate,
  onTime,
  onTurf,
  compact = false,
}: {
  date: string;
  dates: string[];
  today: string;
  time: string;
  turfOnly: boolean;
  onDate: (value: string) => void;
  onTime: (value: (typeof PITCH_TIMES)[number]) => void;
  onTurf: () => void;
  compact?: boolean;
}) {
  const barRef = useRef<View>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [anchor, setAnchor] = useState({ x: 16, y: 120, w: 280, h: 44 });

  function toggle(next: Menu) {
    if (menu === next) {
      setMenu(null);
      return;
    }
    barRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setMenu(next);
    });
  }

  return (
    <View ref={barRef} collapsable={false} style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Date"
        onPress={() => toggle('date')}
        style={[styles.drop, compact && styles.dropCompact, menu === 'date' && styles.dropOpen]}
      >
        <Text numberOfLines={1} style={styles.value}>
          {formatDateMenu(date, today)}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.ink} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Time"
        onPress={() => toggle('time')}
        style={[styles.drop, compact && styles.dropCompact, menu === 'time' && styles.dropOpen]}
      >
        <Text style={styles.value}>{formatTimeChip(time)}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.ink} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: turfOnly }}
        accessibilityLabel="Turf only"
        onPress={() => {
          setMenu(null);
          onTurf();
        }}
        style={[styles.turf, compact && styles.turfCompact, turfOnly && styles.turfOn]}
      >
        <Text style={[styles.turfText, turfOnly && styles.turfTextOn]}>{compact ? 'Turf' : 'Turf only'}</Text>
      </Pressable>

      <TapAway
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        menuStyle={{
          top: anchor.y + anchor.h + 6,
          left: 16,
          right: compact ? 88 : 16,
          maxHeight: 280,
        }}
      >
        <View style={styles.popover}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {menu === 'date'
              ? dates.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => {
                      onDate(item);
                      setMenu(null);
                    }}
                    style={[styles.option, item === date && styles.optionOn]}
                  >
                    <Text style={[styles.optionText, item === date && styles.optionTextOn]}>{formatDateMenu(item, today)}</Text>
                  </Pressable>
                ))
              : PITCH_TIMES.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => {
                      onTime(item);
                      setMenu(null);
                    }}
                    style={[styles.option, item === time && styles.optionOn]}
                  >
                    <Text style={[styles.optionText, item === time && styles.optionTextOn]}>{formatTimeChip(item)}</Text>
                  </Pressable>
                ))}
          </ScrollView>
        </View>
      </TapAway>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  drop: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  dropCompact: { minHeight: 40, paddingHorizontal: 10 },
  dropOpen: { borderColor: colors.ink },
  value: { flex: 1, color: colors.ink, fontSize: 13, ...typography.label },
  turf: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turfCompact: { minHeight: 40, paddingHorizontal: 12 },
  turfOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  turfText: { color: colors.ink, fontSize: 12, ...typography.label },
  turfTextOn: { color: colors.white },
  popover: {
    maxHeight: 280,
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow,
  },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  optionOn: { backgroundColor: colors.mint },
  optionText: { color: colors.ink, fontSize: 15, ...typography.body },
  optionTextOn: { ...typography.heading },
});
