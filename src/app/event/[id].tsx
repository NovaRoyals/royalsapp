import { Ionicons } from '@expo/vector-icons';
import { Href, Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CloudBackdrop } from '@/components/brand/CloudBackdrop';
import { AttendanceRoster } from '@/components/interactions/AttendanceRoster';
import { RsvpChoices } from '@/components/interactions/RsvpChoices';
import { SupporterButton } from '@/components/interactions/SupporterButton';
import { CalendarPrep } from '@/components/operations/CalendarPrep';
import { WeatherCard } from '@/components/weather/WeatherCard';
import { PressableScale } from '@/components/motion';
import { useToast } from '@/components/Toast';
import { Button, Screen, StatusPill } from '@/components/ui';
import { demoPrograms, demoSchedule, demoTeams } from '@/data/demo';
import { ARROWHEAD_2B_ID, venueById } from '@/data/venues';
import { can, canCreateSessionRecap, canSendSessionRecap } from '@/lib/capabilities';
import { attendanceCounts, recapForEvent } from '@/lib/coachRecap';
import { eventPhase, formatEventParts, formatEventWhen, relativeDayLabel } from '@/lib/datetime';
import { tintFor } from '@/lib/tint';
import { canPlayerRsvp, canSeeFullRoster, COACH_TEAM_ID } from '@/lib/membership';
import { safeBack } from '@/lib/nav';
import {
  canEditEventInstructions,
  canPublishOperations,
  canRemindNonResponders,
  canRequestOperationalChange,
  canViewPrivateRoster,
  deadlineCopy,
  eventChildren,
  eventTypeLabel,
  needsAttentionCopy,
  nonResponders,
  peopleInBucket,
  fieldStatusTone,
  placeLabel,
  rsvpFor,
  rsvpSummary,
  summaryLine,
  type RsvpBucket,
} from '@/lib/operations';
import { shareContent } from '@/lib/share';
import { directionsUrl } from '@/services/maps';
import { fieldStatusLabel, weatherForEvent } from '@/services/weather';
import { useApp } from '@/state/AppProvider';
import { colors, gradients, layout, radius, spacing, tints, typography } from '@/theme/tokens';
import type { AttendanceMark, ScheduleEvent } from '@/types/domain';
import { manualStory } from '@/lib/matchStory';

export function generateStaticParams() {
  return demoSchedule.map((item) => ({ id: item.id }));
}

const filters: { id: RsvpBucket | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'going', label: 'Going' },
  { id: 'not_going', label: 'Can’t make it' },
  { id: 'maybe', label: 'Not sure' },
  { id: 'waiting', label: 'No response' },
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    schedule,
    setAttendance,
    setParticipantRsvp,
    setSupporter,
    setMatchStory,
    setFieldStatus,
    relocateEvent,
    cancelEvent,
    requestOperationalChange,
    setEventInstructions,
    remindNonResponders,
    recordCheckIn,
    recordAllPresent,
    role,
    registrations,
    recaps,
    managerCanSendRecap,
    household,
    venueUpdates,
  } = useApp();
  const toast = useToast();
  const event = schedule.find((item) => item.id === id) ?? schedule[0];
  const [bucket, setBucket] = useState<RsvpBucket | 'all'>('all');
  const [sheet, setSheet] = useState<'calendar' | null>(null);
  const weather = weatherForEvent(event);
  const place = venueById(event.venueId);
  const team = demoTeams.find((item) => item.id === event.teamId);
  const program = demoPrograms.find((item) => item.id === event.programId)
    ?? demoPrograms.find((item) => Boolean(item.teamId) && item.teamId === event.teamId);
  const roster = event.teamId === COACH_TEAM_ID ? team?.roster ?? [] : [];
  const staffRoster = canViewPrivateRoster(role, event.teamId) && roster.length > 0;
  const summary = rsvpSummary(event, roster);
  const waiting = nonResponders(event, roster);
  const kids = eventChildren(event, household.children);
  const showPlayerRsvp = canPlayerRsvp(role, event, registrations);
  const showChildRsvp = role === 'guardian' && kids.length > 0;
  const showSupporter = !showPlayerRsvp && !showChildRsvp && !staffRoster && role !== 'guest' && event.status !== 'cancelled';
  const showGuestSupport = role === 'guest' && event.status !== 'cancelled';
  const deadlines = deadlineCopy(event, staffRoster ? waiting.length : 0);
  const recorded = event.checkIns ?? [];
  const attendance = attendanceCounts(roster, recorded);
  const attendanceOpen =
    event.status === 'completed' || recorded.length > 0 || eventPhase(event) !== 'upcoming' || relativeDayLabel(event.startsAt) === 'today';
  const [pendingPublish, setPendingPublish] = useState<PublishAction | null>(null);
  const [requestKind, setRequestKind] = useState<'relocation' | 'cancellation' | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const canEditStory = role === 'admin' || role === 'competition_manager';
  const [storyEventId, setStoryEventId] = useState(event.id);
  const [storyHeadline, setStoryHeadline] = useState(event.storyOverride?.headline ?? '');
  const [storySupport, setStorySupport] = useState(event.storyOverride?.supporting ?? '');
  const [storyFeatured, setStoryFeatured] = useState(Boolean(event.storyOverride?.featured));
  const [storyCta, setStoryCta] = useState(event.storyOverride?.showSupporterCta !== false);
  if (storyEventId !== event.id) {
    setStoryEventId(event.id);
    setStoryHeadline(event.storyOverride?.headline ?? '');
    setStorySupport(event.storyOverride?.supporting ?? '');
    setStoryFeatured(Boolean(event.storyOverride?.featured));
    setStoryCta(event.storyOverride?.showSupporterCta !== false);
  }
  const recap = recapForEvent(recaps, event.id);
  const showRecap =
    (event.status === 'completed' || Boolean(recorded.length)) &&
    (canCreateSessionRecap(role, event.teamId) || can(role, 'view_recap_status'));
  const season = schedule.filter(
    (item) => item.status !== 'cancelled' && item.programId && item.programId === event.programId && item.startsAt >= event.startsAt,
  );
  const venueUpdate = venueUpdates.find((item) => item.venueId === event.venueId);
  const filteredRoster = peopleInBucket(event, roster, bucket);
  const latestChange = event.changes?.[0];

  return (
    <Screen scroll={false} contentStyle={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/schedule')} style={styles.back}>
            <Ionicons name="arrow-back" size={21} color={colors.ink} />
          </Pressable>
          <Text style={styles.topTitle}>{eventTypeLabel(event)}</Text>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Share event"
            onPress={async () => {
              const result = await shareContent({
                title: event.title,
                message: `${event.title} · ${formatEventWhen(event.startsAt)} · ${event.venue}`,
                url: typeof window !== 'undefined' ? window.location.href : undefined,
              });
              if (result === 'copied') toast('Link copied');
              if (result === 'shared') toast('Shared');
            }}
            style={styles.back}
          >
            <Ionicons name="share-outline" size={20} color={colors.ink} />
          </PressableScale>
        </View>

        {program ? (
          <Link href={aboutHref(program.id)} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={`About ${sideName(event)}`} style={styles.contextLink}>
              <Text style={styles.contextText}>{program.title} › {sideName(event)}</Text>
            </Pressable>
          </Link>
        ) : null}
        <EventHero event={event} />

        <View style={styles.quickRow}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Get directions to ${place?.name ?? event.venue}`}
            onPress={() => Linking.openURL(directionsUrl({ name: place?.name ?? event.venue, address: event.address ?? place?.address }, Platform.OS)).catch(() => toast('Couldn’t open Maps. The address is under Plan your visit.'))}
            style={[styles.quick, styles.quickPrimary]}
          >
            <Ionicons accessible={false} name="navigate" size={18} color={colors.white} />
            <Text style={styles.quickPrimaryText}>Directions</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Add to calendar"
            accessibilityState={{ expanded: sheet === 'calendar' }}
            onPress={() => setSheet(sheet === 'calendar' ? null : 'calendar')}
            style={styles.quick}
          >
            <Ionicons accessible={false} name="calendar-outline" size={18} color={colors.ink} />
            <Text style={styles.quickText}>Calendar</Text>
          </PressableScale>
        </View>
        {sheet === 'calendar' ? (
          <View style={styles.sheet}>
            <CalendarPrep event={event} season={season.length ? season : [event]} />
          </View>
        ) : null}
        <View style={styles.weather}>
          <WeatherCard event={event} />
        </View>

        {event.fieldStatus === 'closed' || event.status === 'cancelled' || event.previousVenue || event.pendingChange ? (
          <View style={[styles.banner, event.fieldStatus === 'closed' || event.status === 'cancelled' ? styles.bannerDanger : styles.bannerAttention]}>
            <Text style={styles.bannerTitle}>{needsAttentionCopy(event)}</Text>
            {event.previousVenue ? (
              <Text style={styles.bannerBody}>
                <Text style={styles.struck}>Previous · {event.previousVenue}</Text>
                {`\nNow · ${event.venue}`}
              </Text>
            ) : null}
            {event.cancellationReason ? <Text style={styles.bannerBody}>{event.cancellationReason}</Text> : null}
            {event.reschedulePending ? <Text style={styles.bannerBody}>Rescheduling information is pending.</Text> : null}
            {latestChange ? (
              <Text style={styles.bannerMeta}>
                {latestChange.actorName} · {formatEventWhen(latestChange.createdAt)} · Notifications {latestChange.notificationStatus} in demo
              </Text>
            ) : null}
          </View>
        ) : null}

        {showChildRsvp || showPlayerRsvp ? (
          <View style={styles.block}>
            {showChildRsvp
              ? kids.map((child) => (
                  <View key={child.id} style={styles.childRsvp}>
                    <Text style={styles.childName}>Respond for {child.firstName}</Text>
                    <RsvpChoices
                      value={rsvpFor(event, child.id)}
                      goingCount={0}
                      showCount={false}
                      confirmation={childConfirmation(child.firstName, rsvpFor(event, child.id))}
                      onChange={(status) => setParticipantRsvp(event.id, child.id, status)}
                    />
                  </View>
                ))
              : (
                  <RsvpChoices value={event.attendance} goingCount={0} showCount={false} onChange={(status) => setAttendance(event.id, status)} />
                )}
          </View>
        ) : null}

        {showSupporter ? (
          <View style={styles.block}>
            <Text style={styles.section}>Coming to support?</Text>
            <Text style={styles.hint}>Supporting does not add you to the roster.</Text>
            <SupporterButton going={Boolean(event.supporterGoing)} count={event.supporterCount ?? 0} onToggle={(next) => setSupporter(event.id, next)} />
          </View>
        ) : null}

        {showGuestSupport ? (
          <View style={styles.block}>
            <Text style={styles.section}>Coming to support?</Text>
            <Text style={styles.hint}>Supporting does not add you to the roster. Sign in to respond.</Text>
            <Button label="Sign in to RSVP" onPress={() => router.push('/onboarding?mode=signin' as Href)} />
          </View>
        ) : null}

        {role === 'guest' ? (
          <Text style={styles.privacy}>Public details only. Player responses and household schedules stay signed in.</Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <DetailRows rows={glanceRows(event, deadlines)} />
        </View>

        {program ? (
          <Link href={aboutHref(program.id)} asChild>
            <PressableScale accessibilityLabel={`About ${sideName(event)}`} style={StyleSheet.flatten([styles.aboutCard, { backgroundColor: tints[tintFor(event)].bg }])}>
              <View style={styles.aboutIcon}>
                <Ionicons accessible={false} name="information-circle-outline" size={22} color={tints[tintFor(event)].accent} />
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.aboutTitle}>About {sideName(event)}</Text>
                <Text style={styles.aboutBody}>Squad, schedule and team information</Text>
              </View>
              <Ionicons accessible={false} name="arrow-forward" size={18} color={tints[tintFor(event)].accent} />
            </PressableScale>
          </Link>
        ) : null}

        {canEditStory ? (
          <View style={styles.block}>
            <Text style={styles.section}>Home headline</Text>
            <Text style={styles.hint}>Manual copy is used as written. Leave the headline blank to use the factual fallback.</Text>
            <TextInput accessibilityLabel="Home headline" value={storyHeadline} onChangeText={setStoryHeadline} placeholder="Headline" placeholderTextColor={colors.stone} style={styles.noteInput} />
            <TextInput accessibilityLabel="Home supporting line" value={storySupport} onChangeText={setStorySupport} placeholder="Supporting line" placeholderTextColor={colors.stone} style={styles.noteInput} />
            <Pressable accessibilityRole="switch" accessibilityLabel="Feature on Home" accessibilityState={{ checked: storyFeatured }} onPress={() => setStoryFeatured((value) => !value)}>
              <Text style={styles.factValue}>Feature on Home {storyFeatured ? 'on' : 'off'}</Text>
            </Pressable>
            <Pressable accessibilityRole="switch" accessibilityLabel="Show supporter action" accessibilityState={{ checked: storyCta }} onPress={() => setStoryCta((value) => !value)}>
              <Text style={styles.factValue}>Supporter action {storyCta ? 'on' : 'off'}</Text>
            </Pressable>
            <Button
              label="Save Home headline"
              variant="secondary"
              onPress={() => {
                if (!storyHeadline.trim()) {
                  setMatchStory(event.id, null);
                  toast('Home will use the factual fallback.');
                  return;
                }
                setMatchStory(event.id, manualStory({
                  headline: storyHeadline.trim(),
                  supporting: storySupport.trim(),
                  featured: storyFeatured,
                  showSupporterCta: storyCta,
                }));
                toast('Home headline saved.');
              }}
            />
          </View>
        ) : null}

        {staffRoster ? (
          <View style={styles.block}>
            <Text style={styles.section}>Responses</Text>
            <Text style={styles.summaryCount}>{summary.total} players</Text>
            <Text style={styles.summaryLine}>{summaryLine(summary)}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {filters.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: bucket === item.id }}
                  onPress={() => setBucket(item.id)}
                  style={[styles.filter, bucket === item.id && styles.filterOn]}
                >
                  <Text style={[styles.filterText, bucket === item.id && styles.filterTextOn]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {filteredRoster.map((person) => (
              <Text key={person.id} style={styles.person}>
                {person.displayName} · {rsvpFor(event, person.id) ? (rsvpFor(event, person.id) === 'going' ? 'Going' : rsvpFor(event, person.id) === 'maybe' ? 'Not sure' : 'Can’t make it') : 'No response'}
              </Text>
            ))}
            {canRemindNonResponders(role, event.teamId) ? (
              <Button
                label="Remind families who haven’t responded"
                variant="secondary"
                onPress={() => {
                  const count = remindNonResponders(event.id);
                  toast(count ? `Reminder queued for ${count}` : 'Everyone has responded');
                }}
                style={styles.action}
              />
            ) : null}
          </View>
        ) : null}

        {showRecap || (can(role, 'record_attendance') && roster.length && (role === 'admin' || event.teamId === COACH_TEAM_ID)) ? (
          <View style={styles.block}>
            <Text style={styles.section}>Attendance</Text>
            <Text style={styles.hint}>Attendance is what happened at the session. It stays separate from RSVP.</Text>
            {recorded.length ? (
              <Text style={styles.summaryLine}>
                {attendance.presentCount} present · {attendance.absentCount} absent
                {attendance.unrecordedCount ? ` · ${attendance.unrecordedCount} not recorded` : ''}
              </Text>
            ) : null}
            {can(role, 'record_attendance') && roster.length && !attendanceOpen ? (
              <Text style={styles.hint}>Attendance opens on session day.</Text>
            ) : null}
            {can(role, 'record_attendance') && roster.length && attendanceOpen ? (
              <AttendanceRoster
                roster={roster}
                recorded={recorded}
                authorizedNames={canSeeFullRoster(role, event.teamId)}
                missingRsvpIds={waiting.map((person) => person.id)}
                onMark={(person, status) =>
                  recordCheckIn(event.id, {
                    personId: person.id,
                    personName: person.displayName,
                    status,
                    present: status !== 'absent',
                  } satisfies AttendanceMark)
                }
                onMarkAllPresent={() => recordAllPresent(event.id, roster)}
              />
            ) : null}
            {showRecap && recap?.status !== 'sent' ? (
              <Button
                label={recap?.originalText ? 'Continue session recap' : 'Record session recap'}
                icon="mic-outline"
                onPress={() => router.push(`/session/${event.id}/recap` as never)}
                style={styles.action}
              />
            ) : null}
            {recap?.status === 'sent' ? (
              <Button label="View send receipt" variant="secondary" onPress={() => router.push(`/session/${event.id}/recap` as never)} style={styles.action} />
            ) : null}
            {can(role, 'view_recap_status') && recap?.status === 'sent' && !canSendSessionRecap(role, managerCanSendRecap) ? (
              <Text style={styles.hint}>Recap sent to {recap.recipientCount} families.</Text>
            ) : null}
          </View>
        ) : null}

        {canEditEventInstructions(role, event.teamId) ? (
          <View style={styles.block}>
            <Text style={styles.section}>Session note</Text>
            <NoteEditor key={event.id} initial={event.instructions ?? ''} onSave={(value) => setEventInstructions(event.id, value)} />
          </View>
        ) : null}

        {event.instructions ? <Text style={styles.noteLine}>{event.instructions}</Text> : null}

        {canRequestOperationalChange(role, event.teamId) ? (
          <View style={styles.block}>
            <Text style={styles.section}>Ask the club</Text>
            {requestKind ? (
              <View style={styles.confirm}>
                <Text style={styles.bannerTitle}>{requestKind === 'relocation' ? 'Request a relocation' : 'Request a cancellation'}</Text>
                <Text style={styles.hint}>
                  This goes to a club administrator. It does not move the field, cancel the session, or message families.
                </Text>
                <TextInput
                  accessibilityLabel="Reason for the request"
                  value={requestReason}
                  onChangeText={setRequestReason}
                  placeholder="Short reason"
                  placeholderTextColor={colors.stone}
                  style={styles.noteInput}
                  multiline
                />
                <Button
                  label="Submit request"
                  disabled={!requestReason.trim()}
                  onPress={() => {
                    requestOperationalChange(event.id, requestKind, requestReason.trim());
                    setRequestKind(null);
                    setRequestReason('');
                  }}
                />
                <Button label="Keep as is" variant="ghost" onPress={() => setRequestKind(null)} />
              </View>
            ) : (
              <>
                <Button
                  label="Request relocation"
                  variant="secondary"
                  onPress={() => {
                    setRequestKind('relocation');
                    setRequestReason('Request a move off the current field.');
                  }}
                />
                <Button
                  label="Request cancellation"
                  variant="ghost"
                  onPress={() => {
                    setRequestKind('cancellation');
                    setRequestReason('Request cancellation. Rescheduling is still pending.');
                  }}
                  style={styles.action}
                />
              </>
            )}
          </View>
        ) : null}

        {canPublishOperations(role) ? (
          <View style={styles.block}>
            <Text style={styles.section}>Publish</Text>
            {pendingPublish ? (
              <View style={styles.confirm}>
                <Text style={styles.bannerTitle}>{publishCopy[pendingPublish].title}</Text>
                <Text style={styles.hint}>
                  {pendingPublish === 'reopen'
                    ? 'Families see the field as open again.'
                    : 'Affected families get an urgent in-app alert. This is recorded in the audit log.'}
                </Text>
                <Button
                  label={publishCopy[pendingPublish].confirm}
                  onPress={() => {
                    if (pendingPublish === 'close') {
                      setFieldStatus(event.id, 'closed', `${placeLabel(event)} is closed due to unsafe conditions.`);
                    } else if (pendingPublish === 'reopen') {
                      setFieldStatus(event.id, 'open');
                    } else if (pendingPublish === 'relocate') {
                      relocateEvent(event.id, ARROWHEAD_2B_ID, 'Field 3A is unavailable. The session moves to Field 2B.');
                    } else {
                      cancelEvent(event.id, 'Session cancelled. Rescheduling information is pending.');
                    }
                    setPendingPublish(null);
                  }}
                  style={styles.action}
                />
                <Button label="Keep as is" variant="ghost" onPress={() => setPendingPublish(null)} />
              </View>
            ) : (
              <>
                <Button
                  label={event.fieldStatus === 'closed' ? 'Reopen field' : 'Close this field'}
                  variant="secondary"
                  onPress={() => setPendingPublish(event.fieldStatus === 'closed' ? 'reopen' : 'close')}
                />
                <Button label="Relocate to Field 2B" variant="secondary" onPress={() => setPendingPublish('relocate')} style={styles.action} />
                <Button label="Cancel session" variant="ghost" onPress={() => setPendingPublish('cancel')} style={styles.action} />
              </>
            )}
            {event.pendingChange?.approval === 'requested' && event.pendingChange.kind === 'relocation' ? (
              <Button label="Approve relocation" onPress={() => relocateEvent(event.id, ARROWHEAD_2B_ID)} style={styles.action} />
            ) : null}
            {event.pendingChange?.approval === 'requested' && event.pendingChange.kind === 'cancellation' ? (
              <Button label="Approve cancellation" onPress={() => cancelEvent(event.id, event.pendingChange?.reason || 'Cancelled')} style={styles.action} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.section}>Plan your visit</Text>
          {event.previousVenue ? <Text style={styles.struck}>Previous · {event.previousVenue}</Text> : null}
          {event.address ? <Text selectable style={styles.factValue}>{event.address}</Text> : null}
          <DetailRows
            rows={[
              ...logisticsRows(event, place, venueUpdate?.updatedBy, venueUpdate ? formatEventWhen(venueUpdate.updatedAt) : undefined, venueUpdate?.reason),
              // No placeholder row: until live weather is connected there is nothing true to say.
              ...(weather.source === 'unconfigured' ? [] : [{ icon: 'cloud-outline' as const, label: weather.summary, value: weather.detail }]),
            ]}
          />
          <Pressable accessibilityRole="link" onPress={() => event.venueId && router.push(`/venue/${event.venueId}` as Href)} style={styles.linkHit}>
            <Text style={styles.link}>Venue details →</Text>
          </Pressable>
        </View>

        {event.coachName && event.type === 'training' && (role === 'guardian' || role === 'adult_player') ? (
          <Button label="Contact coach" variant="ghost" onPress={() => router.push('/message/coach-priya' as never)} style={styles.action} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

type PublishAction = 'close' | 'reopen' | 'relocate' | 'cancel';

const publishCopy: Record<PublishAction, { title: string; confirm: string }> = {
  close: { title: 'Close this field?', confirm: 'Close and notify' },
  reopen: { title: 'Reopen this field?', confirm: 'Reopen' },
  relocate: { title: 'Move this session to Field 2B?', confirm: 'Relocate and notify' },
  cancel: { title: 'Cancel this session?', confirm: 'Cancel and notify' },
};

function childConfirmation(firstName: string, status: string | undefined) {
  if (status === 'going') return `${firstName} is going.`;
  if (status === 'not_going') return `${firstName} can’t make it.`;
  if (status === 'maybe') return `${firstName} is marked not sure.`;
  return null;
}

function NoteEditor({ initial, onSave }: { initial: string; onSave: (value: string) => void }) {
  const [note, setNote] = useState(initial);
  return (
    <>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Arrival or kit note for this session"
        placeholderTextColor={colors.stone}
        style={styles.input}
        multiline
      />
      <Button label="Save note" variant="secondary" onPress={() => onSave(note)} />
    </>
  );
}

function sideName(event: ScheduleEvent) {
  if (event.teamId === 'nova-royals-men') return 'ROYALS Open';
  if (event.teamId === 'nova-royals-35plus') return 'ROYALS 35+';
  if (event.teamId === 'nova-royals-women') return 'ROYALS Women';
  if (event.sport === 'cricket' || event.teamId === 'nova-royals-cricket') return 'ROYALS Cricket';
  if (event.teamId === 'nova-royals-kids-u8' || event.teamId === 'nova-royals-kids-u6') return 'ROYALS Kids';
  const team = demoTeams.find((item) => item.id === event.teamId);
  if (team?.shortName && team.shortName !== 'ROYALS') return team.shortName;
  return 'ROYALS';
}

/** Always lands on the About tab, even if the program screen is already open on another one. */
function aboutHref(programId: string) {
  return `/program/${programId}?pane=about` as Href;
}

/**
 * The top of the page, in one dark card: who is playing, when, where, and anything that
 * changed. Everything below is secondary to this, so it carries the hierarchy.
 */
function EventHero({ event }: { event: ScheduleEvent }) {
  const parts = formatEventParts(event.startsAt);
  const opponent = event.opponent?.trim();
  const competitive = Boolean(opponent) && event.type !== 'training' && event.type !== 'club_event';
  const kicker = [sideName(event), event.competitionLabel ?? eventTypeLabel(event)].filter(Boolean).join(' · ');
  const field = event.fieldStatus && event.fieldStatus !== 'open' ? fieldStatusLabel(event.fieldStatus) : null;
  const done = event.status === 'completed' && Boolean(event.result);
  return (
    <View style={styles.hero}>
      <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <CloudBackdrop />
      <View style={styles.heroBody}>
        <Text style={styles.heroKicker}>{kicker.toUpperCase()}</Text>
        {competitive && opponent ? (
          <View accessibilityRole="header" style={styles.heroTeams}>
            <Text style={styles.heroTeam}>{sideName(event)}</Text>
            <View style={styles.vsRow}>
              <View style={styles.vsLine} />
              <Text style={styles.vsText}>VS</Text>
              <View style={styles.vsLine} />
            </View>
            <Text style={styles.heroTeam}>{opponent}</Text>
          </View>
        ) : (
          <Text accessibilityRole="header" style={styles.heroTitle}>{event.type === 'club_event' ? event.purpose ?? event.title : event.title}</Text>
        )}
        {done ? (
          <Text style={styles.heroResult}>{event.result}</Text>
        ) : (
          <View style={styles.heroWhen}>
            <View style={styles.heroDate}>
              <Text style={styles.heroDow}>{parts.weekday}</Text>
              <Text style={styles.heroDay}>{parts.day}</Text>
              <Text style={styles.heroMonth}>{parts.month}</Text>
            </View>
            <View style={styles.flexOne}>
              <Text style={styles.heroTime}>{parts.time}</Text>
              <View style={styles.heroPlace}>
                <Ionicons accessible={false} name="location-outline" size={15} color={colors.mint} />
                <Text numberOfLines={2} style={styles.heroPlaceText}>{placeLabel(event)}</Text>
              </View>
            </View>
          </View>
        )}
        {field || event.status === 'cancelled' || done ? (
          <View style={styles.heroChips}>
            {field ? <StatusPill label={field} tone={fieldStatusTone(event.fieldStatus)} /> : null}
            {event.status === 'cancelled' ? <StatusPill label="Cancelled" tone="danger" /> : null}
            {done ? <StatusPill label="Final" tone="neutral" /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DetailRows({ rows }: { rows: { icon: GlanceIcon; label: string; value: string }[] }) {
  return (
    <View>
      {rows.map((row, index) => (
        <View key={`${row.label}-${row.value}`} style={[styles.detailRow, index > 0 && styles.detailDivider]}>
          <View style={styles.detailIcon}>
            <Ionicons accessible={false} name={row.icon} size={17} color={colors.ink} />
          </View>
          <View style={styles.flexOne}>
            <Text style={styles.factLabel}>{row.label.toUpperCase()}</Text>
            <Text selectable style={styles.factValue}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

type GlanceIcon = keyof typeof Ionicons.glyphMap;

function glanceRows(event: ScheduleEvent, deadlines: string[]) {
  const rows: { icon: GlanceIcon; label: string; value: string; span?: boolean }[] = [];
  const push = (icon: GlanceIcon, label: string, value?: string, span = false) => {
    if (value) rows.push({ icon, label, value, span });
  };
  const when = formatEventWhen(event.startsAt);
  const place = placeLabel(event);
  const timeLabel = event.sport === 'cricket' ? 'Start' : event.type === 'training' || event.type === 'club_event' ? 'When' : 'Kickoff';
  const placeName = event.sport === 'cricket' ? 'Ground' : event.type === 'club_event' ? 'Location' : 'Venue';

  if (event.type === 'training') {
    push('time-outline', timeLabel, when);
    push('location-outline', placeName, place);
  } else if (event.type === 'tournament_match') {
    push('trophy-outline', 'Tournament', event.tournamentName);
    push('calendar-outline', 'Dates', event.tournamentRange);
    push('time-outline', 'Kickoff', when);
    push('git-network-outline', 'Division', event.division);
    push('location-outline', 'Venue', place);
    push('log-in-outline', 'Check-in', event.checkInAt);
    push('people-outline', 'Roster', event.rosterStatus);
  } else if (event.type === 'club_event') {
    push('time-outline', 'When', when);
    push('location-outline', 'Location', place);
    push('hand-left-outline', 'Volunteers', event.volunteerNeeds);
  } else {
    push('trophy-outline', 'Competition', event.competitionLabel);
    push('time-outline', timeLabel, when);
    push('location-outline', placeName, place);
    push('people-outline', event.sport === 'cricket' ? 'Squad' : 'Roster', event.rosterStatus);
  }
  deadlines.forEach((line) => push('alarm-outline', 'Respond by', line, true));
  return rows;
}

function logisticsRows(
  event: ScheduleEvent,
  place: ReturnType<typeof venueById>,
  updatedBy?: string,
  updatedAt?: string,
  reason?: string,
) {
  const rows: { icon: GlanceIcon; label: string; value: string }[] = [];
  const push = (icon: GlanceIcon, label: string, value?: string) => {
    if (value) rows.push({ icon, label, value });
  };
  if (event.type === 'training') {
    push('people-outline', 'Age group', event.ageGroup);
    if (event.sessionNumber) push('list-outline', 'Session', `${event.sessionNumber}${event.sessionTotal ? ` of ${event.sessionTotal}` : ''}`);
    push('person-outline', 'Coach', event.coachName);
    push('alarm-outline', 'Arrive', event.arrivalAt);
    push('shirt-outline', 'Kit', event.whatToBring);
  }
  push('walk-outline', 'Arrival', place?.arrival);
  push('car-outline', 'Parking', place?.parkingNotes ?? event.parkingNotes);
  push('flag-outline', 'Entrance', place?.entrance);
  push('layers-outline', 'Surface', place?.surface);
  push('water-outline', 'Restrooms', place?.restrooms);
  if (updatedBy && updatedAt) push('refresh-outline', 'Field update', `${updatedBy} · ${updatedAt}${reason ? ` · ${reason}` : ''}`);
  return rows;
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: 0 },
  scroll: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingBottom: 120 },
  topbar: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.stone, fontSize: 13, ...typography.label },
  title: { color: colors.ink, fontSize: 28, lineHeight: 32, marginTop: spacing.xs, ...typography.heading },
  matchup: { gap: 2, marginTop: spacing.xs },
  side: { color: colors.ink, fontSize: 22, lineHeight: 28, ...typography.heading },
  contextLink: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginBottom: spacing.xs },
  contextText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  programLink: { marginTop: spacing.lg, gap: 2 },
  vs: { color: colors.orangeDark, fontSize: 14, ...typography.label },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  banner: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, gap: 4 },
  bannerDanger: { backgroundColor: colors.dangerSoft },
  bannerAttention: { backgroundColor: colors.orangeSoft },
  bannerTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  bannerBody: { color: colors.charcoal, fontSize: 14, lineHeight: 20, ...typography.body },
  bannerMeta: { color: colors.stone, fontSize: 12, marginTop: 4, ...typography.body },
  struck: { color: colors.stone, textDecorationLine: 'line-through', ...typography.body },
  glanceLabel: { color: colors.stone, fontSize: 12, marginTop: spacing.lg, ...typography.label },
  glance: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, rowGap: 14, columnGap: spacing.lg },
  glanceItem: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  glanceItemWide: { width: '47%', flexGrow: 1 },
  glanceSpan: { width: '100%', flexGrow: 1 },
  privacy: { color: colors.stone, fontSize: 13, lineHeight: 18, marginTop: 10, paddingHorizontal: 4, ...typography.body },
  glanceCopy: { flex: 1, minWidth: 0, gap: 1 },
  factLabel: { color: colors.stone, fontSize: 11, ...typography.label },
  factValue: { color: colors.ink, fontSize: 15, lineHeight: 20, ...typography.bodyMedium },
  responseLine: { marginTop: spacing.lg, gap: 2 },
  result: { color: colors.ink, fontSize: 20, marginTop: spacing.sm, ...typography.heading },
  block: { marginTop: 10, gap: spacing.sm, padding: 14, borderRadius: 22, backgroundColor: colors.paper },
  card: { marginTop: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4, borderRadius: 22, backgroundColor: colors.paper },
  cardTitle: { color: colors.ink, fontSize: 16, marginBottom: 2, ...typography.heading },
  flexOne: { flex: 1, minWidth: 0 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 9 },
  detailDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  detailIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  aboutCard: { marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64 },
  aboutIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  aboutTitle: { color: colors.ink, fontSize: 16, ...typography.heading },
  aboutBody: { color: colors.charcoal, fontSize: 13, marginTop: 2, ...typography.body },
  hero: { marginTop: 4, borderRadius: 26, overflow: 'hidden', backgroundColor: colors.greenDeep },
  weather: { marginTop: 10 },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quick: { flex: 1, minHeight: 48, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  quickPrimary: { backgroundColor: colors.ink, borderColor: colors.ink },
  quickText: { color: colors.ink, fontSize: 14, ...typography.label },
  quickPrimaryText: { color: colors.white, fontSize: 14, ...typography.label },
  sheet: { marginTop: 10, padding: 14, borderRadius: 22, backgroundColor: colors.paper, gap: spacing.sm },
  sheetNote: { color: colors.charcoal, fontSize: 13, lineHeight: 18, ...typography.body },
  heroBody: { padding: 18, gap: 10 },
  heroKicker: { color: colors.mint, fontSize: 11, ...typography.label, letterSpacing: 1.6 },
  heroTeams: { gap: 6 },
  heroTeam: { color: colors.white, fontSize: 28, lineHeight: 32, ...typography.heading },
  heroTitle: { color: colors.white, fontSize: 30, lineHeight: 34, ...typography.heading },
  vsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vsLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  vsText: { color: colors.gold, fontSize: 13, ...typography.label, letterSpacing: 2 },
  heroWhen: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xs },
  heroDate: { minWidth: 84, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  heroDow: { color: colors.gold, fontSize: 11, ...typography.label, letterSpacing: 1.4 },
  heroDay: { color: colors.white, fontSize: 40, lineHeight: 42, ...typography.display },
  heroMonth: { color: colors.mint, fontSize: 11, ...typography.label, letterSpacing: 1.2 },
  heroTime: { color: colors.white, fontSize: 24, ...typography.heading },
  heroPlace: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  heroPlaceText: { flex: 1, color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 19, ...typography.body },
  heroResult: { color: colors.white, fontSize: 24, ...typography.heading },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  confirm: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.orangeSoft, gap: spacing.xs },
  noteInput: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    padding: spacing.md,
    color: colors.ink,
    fontSize: 15,
    ...typography.body,
  },
  section: { color: colors.ink, fontSize: 18, ...typography.heading },
  hint: { color: colors.stone, fontSize: 14, lineHeight: 20, ...typography.body },
  summaryCount: { color: colors.ink, fontSize: 28, fontVariant: ['tabular-nums'], ...typography.heading },
  summaryLine: { color: colors.charcoal, fontSize: 14, ...typography.body },
  filters: { gap: spacing.sm, paddingVertical: spacing.sm },
  filter: { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  filterOn: { backgroundColor: colors.ink },
  filterText: { color: colors.charcoal, fontSize: 12, ...typography.label },
  filterTextOn: { color: colors.white },
  person: { color: colors.ink, fontSize: 15, paddingVertical: 6, ...typography.body },
  action: { marginTop: spacing.sm },
  input: {
    minHeight: 72,
    borderRadius: radius.input,
    backgroundColor: colors.paper,
    padding: spacing.md,
    color: colors.ink,
    fontSize: 15,
    ...typography.body,
  },
  noteLine: { marginTop: spacing.md, color: colors.charcoal, fontSize: 15, lineHeight: 21, ...typography.body },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.orangeDark, fontSize: 14, ...typography.label },
  dockWrap: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  dock: {
    width: '100%',
    maxWidth: layout.maxWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  childRsvp: { gap: 4 },
  childName: { color: colors.ink, fontSize: 14, ...typography.heading },
});
