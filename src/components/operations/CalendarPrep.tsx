import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { formatEventWhen } from '@/lib/datetime';
import { prepareCalendar } from '@/services/calendar';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { ScheduleEvent } from '@/types/domain';

export function CalendarPrep({ event, season }: { event: ScheduleEvent; season: ScheduleEvent[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  async function prepare(events: ScheduleEvent[]) {
    const result = await prepareCalendar(events);
    const lines = result.result.drafts
      .slice(0, 4)
      .map((draft) => `${draft.title} · ${formatEventWhen(draft.startsAt)}`)
      .join('\n');
    const more = result.result.drafts.length > 4 ? `\n+${result.result.drafts.length - 4} more` : '';
    setPreview(`${result.preview}\n${lines}${more}`.trim());
    setReason(result.result.reason);
  }

  return (
    <View style={styles.wrap}>
      <Button label="Add this event" variant="secondary" icon="calendar-outline" onPress={() => prepare([event])} />
      {season.length > 1 ? (
        <Button label="Add season schedule" variant="ghost" onPress={() => prepare(season)} style={styles.second} />
      ) : null}
      {preview ? (
        <View style={styles.preview}>
          <Text style={styles.kicker}>Calendar preview</Text>
          <Text selectable style={styles.body}>{preview}</Text>
          {reason ? <Text style={styles.reason}>{reason}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.sm },
  second: { marginTop: spacing.xs },
  preview: { marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.sand, gap: 6 },
  kicker: { color: colors.stone, fontSize: 11, ...typography.label },
  body: { color: colors.ink, fontSize: 14, lineHeight: 20, ...typography.body },
  reason: { color: colors.charcoal, fontSize: 13, lineHeight: 18, ...typography.bodyMedium },
});
