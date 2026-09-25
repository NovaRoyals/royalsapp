import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { mapsProvider, type MapDestination } from '@/services/maps';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function DirectionsStub({ destination }: { destination: MapDestination }) {
  const [open, setOpen] = useState(false);
  const preview = mapsProvider.directions(destination);

  return (
    <View style={styles.wrap}>
      <Button label={preview.label} icon="navigate-outline" variant="secondary" onPress={() => setOpen(true)} />
      {open ? (
        <View style={styles.preview}>
          <Text selectable style={styles.place}>{preview.destination}</Text>
          <Text selectable style={styles.detail}>{preview.detail}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  preview: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.sand, gap: 4 },
  place: { color: colors.ink, fontSize: 15, ...typography.heading },
  detail: { color: colors.charcoal, fontSize: 13, lineHeight: 18, ...typography.body },
});
