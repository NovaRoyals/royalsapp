import { Ionicons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DirectionsStub } from '@/components/operations/DirectionsStub';
import { Screen, StatusPill } from '@/components/ui';
import { venueById, venueCatalog, venueTitle } from '@/data/venues';
import { formatEventWhen } from '@/lib/datetime';
import { latestVenueUpdate } from '@/lib/operations';
import { safeBack } from '@/lib/nav';
import { fieldStatusLabel } from '@/services/weather';
import { useApp } from '@/state/AppProvider';
import { colors, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return venueCatalog.map((item) => ({ id: item.id }));
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = venueById(id);
  const { schedule, venueUpdates } = useApp();
  const update = place ? latestVenueUpdate(venueUpdates, place.id) : undefined;
  const status = update?.status ?? 'open';
  const upcoming = schedule.filter((event) => event.venueId === id && event.status !== 'completed' && event.status !== 'cancelled').slice(0, 6);

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/fields')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <Text style={styles.kicker}>Venue</Text>
        <View style={{ width: 44, height: 44 }} />
      </View>
      {place ? (
        <>
          <Text style={styles.title}>{place.name}</Text>
          <Text style={styles.field}>{place.fieldNumber}</Text>
          <StatusPill label={fieldStatusLabel(status)} tone={status === 'closed' ? 'danger' : status === 'open' ? 'success' : 'orange'} />
          {update ? (
            <Text style={styles.meta}>
              Updated {formatEventWhen(update.updatedAt)} by {update.updatedBy}. {update.reason}
            </Text>
          ) : (
            <Text style={styles.meta}>No club status change posted. Treat the field as open unless an event says otherwise.</Text>
          )}
          <Text selectable style={styles.body}>{place.address}</Text>
          <Text style={styles.body}>{place.arrival}</Text>
          <Text style={styles.body}>{place.parkingNotes}</Text>
          <Text style={styles.body}>Entrance · {place.entrance}</Text>
          <Text style={styles.body}>Surface · {place.surface}</Text>
          {place.restrooms ? <Text style={styles.body}>{place.restrooms}</Text> : null}
          <View style={styles.directions}>
            <DirectionsStub destination={{ name: venueTitle(place), address: place.address, fieldNumber: place.fieldNumber }} />
          </View>
          <Text style={styles.section}>Upcoming ROYALS events</Text>
          {upcoming.length === 0 ? <Text style={styles.body}>No upcoming club events at this venue.</Text> : null}
          {upcoming.map((event) => (
            <Pressable key={event.id} accessibilityRole="button" onPress={() => router.push(`/event/${event.id}` as Href)} style={styles.event}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.meta}>{formatEventWhen(event.startsAt)}</Text>
            </Pressable>
          ))}
        </>
      ) : (
        <Text style={styles.body}>This venue is not in the club list.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.stone, ...typography.label },
  title: { color: colors.ink, fontSize: 28, ...typography.heading },
  field: { color: colors.charcoal, fontSize: 18, marginBottom: spacing.sm, ...typography.body },
  meta: { color: colors.stone, fontSize: 13, lineHeight: 18, marginTop: spacing.sm, ...typography.body },
  body: { color: colors.charcoal, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, ...typography.body },
  directions: { marginTop: spacing.lg },
  section: { color: colors.ink, fontSize: 18, marginTop: spacing.xl, ...typography.heading },
  event: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  eventTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
});
