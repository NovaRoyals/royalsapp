import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Href, Link, router } from 'expo-router';
import { useEffect, useMemo, useRef, useSyncExternalStore, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ClubDirectory } from '@/components/home/ClubDirectory';
import { MessagesBar } from '@/components/messages/MessagesBar';
import { UnreadBadge } from '@/components/messages/ChatPieces';
import { useThreads } from '@/components/messages/useThreads';
import { HeroStoryCard } from '@/components/home/HeroStoryCard';
import { royPoseSource, type RoyPose } from '@/components/mascot/poses';
import { SeasonDots } from '@/components/interactions/SeasonDots';
import { PressableScale } from '@/components/motion';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui';
import { demoPrograms, kidsProgramId } from '@/data/demo';
import { mayaAttendanceHistory } from '@/lib/attendance';
import { RECAP_EVENT_ID, recapForEvent, sessionIdentity } from '@/lib/coachRecap';
import { cricketEventHref } from '@/lib/cricket';
import { clubNowIso, formatEventParts, formatInstantTime, hoursAfterEnd, relativeDayLabel } from '@/lib/datetime';
import { aroundClubEvents, conciseSupport, youthRegistrationPrompt } from '@/lib/homeFeed';
import { getHomeView, setHomeView, subscribeHomeView } from '@/lib/homeView';
import { homeStories, householdConflictStub, nextUpcomingEvent, type HomeStory } from '@/lib/intelligence';
import { homeGreeting } from '@/lib/greeting';
import { contextualStory, storyViewerFor } from '@/lib/matchStory';
import { COACH_TEAM_ID, PLAYER_TEAM_ID, notificationsForRole } from '@/lib/membership';
import { joinOffer, offerHeadline } from '@/lib/pricing';
import { isInReview } from '@/lib/registrationFlow';
import { tintFor } from '@/lib/tint';
import { useReducedMotion } from '@/lib/reducedMotion';
import { useApp } from '@/state/AppProvider';
import { motion } from '@/theme/motion';
import { colors, radius, tints, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const { role, household, registrations, schedule, notifications, hydrated, persona, pendingStaffRole, recaps, setSupporter } = useApp();
  const reduced = useReducedMotion();
  const chat = useThreads();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const view = useSyncExternalStore(subscribeHomeView, getHomeView, () => 'you' as const);
  const [childId, setChildId] = useState(household.children[0]?.id);
  const choose = (next: 'you' | 'club') => {
    if (next === view) return;
    haptic('light');
    setHomeView(next);
    router.setParams({ view: next === 'club' ? 'club' : '' });
  };
  const paneFade = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      paneFade.value = 1;
      return;
    }
    paneFade.value = 0.12;
    paneFade.value = withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) });
  }, [view, paneFade, reduced]);
  const paneFadeStyle = useAnimatedStyle(() => ({ flex: 1, opacity: paneFade.value }));
  const rise = (index: number) => (reduced ? undefined : FadeInDown.delay(Math.min(index, 5) * 60).duration(260).easing(Easing.out(Easing.cubic)));
  const unread = notificationsForRole(role, notifications, household.children.map((child) => child.id)).filter((item) => !item.read);
  const urgent = unread.find((item) => item.urgency === 'urgent');
  const [nowIso, setNowIso] = useState('2026-09-25T12:00:00-04:00');
  useEffect(() => {
    const sync = () => setNowIso(clubNowIso());
    const first = setTimeout(sync, 0);
    const tick = setInterval(sync, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, []);
  const kidsEvent = nextUpcomingEvent(schedule.filter((event) => event.teamId === COACH_TEAM_ID), nowIso);
  const menEvent = nextUpcomingEvent(schedule.filter((event) => event.teamId === PLAYER_TEAM_ID), nowIso);
  const pendingRegs = registrations.filter((item) => isInReview(item.status));
  const closedField = schedule.find((event) => event.fieldStatus === 'closed');
  const parentReg = role === 'guardian' || role === 'admin' ? registrations[0] : undefined;
  const viewingChild = household.children.find((child) => child.id === childId) ?? household.children[0];
  const hasChildren = household.children.length > 0;
  const staffPending = Boolean(pendingStaffRole);
  const hello = homeGreeting(role, household.guardianName);
  const missingRsvps = Math.max(0, 17 - (kidsEvent?.goingCount ?? 0));
  const mayaCheckedIn = kidsEvent?.checkIns?.some((row) => row.personId === 'child-maya' && row.present);
  const stories = useMemo(
    () => homeStories(schedule, role, hasChildren, nowIso),
    [schedule, role, hasChildren, nowIso],
  );
  const conflict = householdConflictStub(role, household.children.map((child) => child.firstName));
  const registration = youthRegistrationPrompt(role, household.children, registrations, kidsProgramId);
  const primary = stories[0];
  const primaryEvent = schedule.find((item) => item.id === primary?.eventId);
  const clubEvents = useMemo(
    () => aroundClubEvents(schedule, nowIso, primaryEvent ? [primaryEvent.id] : []),
    [schedule, nowIso, primaryEvent],
  );
  const attention = attentionRows({
    urgent,
    closedField,
    staffPending,
    pendingStaffRole,
    conflict,
    parentReg: role === 'guardian' ? parentReg : undefined,
    role,
    kidsEvent,
    missingRsvps,
    menEvent,
    pendingCount: pendingRegs.length,
    hydrated,
    coachUpdate: unread.find((item) => item.type === 'coach_update'),
    recap: recapRow(role, schedule, recaps),
    primaryEventId: primaryEvent?.id,
  });

  return (
    <Screen scroll={false} tabScene contentStyle={styles.frame}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Image source={royPoseSource.smile} style={styles.avatarImage} contentFit="cover" contentPosition="top" alt="" accessibilityIgnoresInvertColors />
        </View>
        <View style={styles.flex}>
          <Text style={styles.mark}>NOVA ROYALS</Text>
          <Text style={styles.hello}>{hello}</Text>
        </View>
        {chat.viewer ? (
          <Link href={'/messages' as never} asChild>
            <Pressable accessibilityLabel={chat.unread ? `Open messages, ${chat.unread} unread` : 'Open messages'} style={styles.bell}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.ink} />
              {chat.unread ? <View style={styles.chatBadge}><UnreadBadge count={chat.unread} /></View> : null}
            </Pressable>
          </Link>
        ) : null}
        <Link href={'/notifications' as never} asChild>
          <Pressable accessibilityLabel="Open notifications" style={styles.bell}>
            <Ionicons name="notifications-outline" size={20} color={colors.ink} />
            {unread.length ? <View style={styles.bellDot} /> : null}
          </Pressable>
        </Link>
      </View>
      <HomeSwitch value={view} onChange={choose} />
      <Animated.View style={paneFadeStyle}>
      <View
        style={[styles.pane, view !== 'you' && styles.paneHidden]}
        accessibilityElementsHidden={view !== 'you'}
        importantForAccessibility={view === 'you' ? 'auto' : 'no-hide-descendants'}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={wide ? styles.columns : undefined}>
            <View style={wide ? styles.mainCol : undefined}>
              <Animated.View entering={rise(0)}>
                <MessagesBar />
              </Animated.View>
              {role === 'guardian' && hasChildren ? (
                <View style={styles.childSwitch}>
                  {household.children.map((child) => (
                    <PressableScale key={child.id} onPress={() => setChildId(child.id)} style={[styles.childChip, child.id === viewingChild?.id && styles.childChipOn]}>
                      <Text style={[styles.childChipText, child.id === viewingChild?.id && styles.childChipOnText]}>{child.firstName}</Text>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {primary ? (
                <Animated.View entering={rise(1)}>
                  <Text style={styles.section}>Next up</Text>
                  <StoryCard
                    story={primary}
                    event={primaryEvent}
                    role={role}
                    childId={viewingChild?.id}
                    childName={viewingChild?.firstName}
                    nowIso={nowIso}
                    onSupport={setSupporter}
                  />
                </Animated.View>
              ) : null}
              {registration ? (
                <Animated.View entering={rise(2)}>
                  <Brief
                    title={registration.childName ? `Register ${registration.childName}` : 'Register a child'}
                    detail={offerHeadline(joinOffer(nowIso))?.line ?? 'Fall Soccer Training is open · Sundays 9–10 AM · Arrowhead 3A.'}
                    href={`/registration/${registration.programId}`}
                    look={{ icon: 'person-add-outline', tint: 'gold' }}
                    badge={offerHeadline(joinOffer(nowIso))?.badge}
                  />
                </Animated.View>
              ) : null}
              {attention.length ? <Text style={styles.section}>Needs attention</Text> : null}
              {attention.map((row, index) => (
                <Animated.View key={row.id} entering={rise(3 + index)}>
                  <Brief title={row.title} detail={row.detail} href={row.href} look={briefLook[row.id]} />
                </Animated.View>
              ))}
              <Link href="/(tabs)/schedule" asChild>
                <Pressable accessibilityRole="link" style={styles.scheduleLink}>
                  <Text style={styles.scheduleLinkText}>See schedule</Text>
                </Pressable>
              </Link>
            </View>
            <View style={wide ? styles.sideCol : undefined}>
              <Text style={styles.section}>Around the club</Text>
              {clubEvents.length ? clubEvents.map((event, index) => (
                <Animated.View key={event.id} entering={rise(4 + index)}>
                  <CompactStory event={event} role={role} childId={viewingChild?.id} childName={viewingChild?.firstName} onSupport={setSupporter} showImage={wide} />
                </Animated.View>
              )) : (
                <PressableScale onPress={() => choose('club')} style={styles.brief}>
                  <View style={styles.flex}>
                    <Text style={styles.briefTitle}>See the club</Text>
                    <Text style={styles.briefDetail}>Soccer and cricket programs.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.stone} />
                </PressableScale>
              )}
              {role === 'guardian' && persona === 'demo' && hydrated ? (
                <Animated.View key={childId} entering={Platform.OS === 'web' || reduced ? undefined : FadeIn.duration(240)} style={styles.seasonCard}>
                  <SeasonDots history={mayaAttendanceHistory} childName={viewingChild?.firstName ?? 'Maya'} />
                  {mayaCheckedIn ? (
                    <Text style={styles.checkedIn}>
                      {viewingChild?.firstName} checked in · {kidsEvent ? relativeDayLabel(kidsEvent.startsAt) : 'session'}
                    </Text>
                  ) : null}
                </Animated.View>
              ) : null}
              {role === 'guest' ? (
                <Animated.View entering={rise(5)} style={styles.accountCard}>
                  <Image source={royPoseSource.wave} style={styles.accountRoy} contentFit="contain" alt="" accessibilityIgnoresInvertColors />
                  <Text style={styles.accountTitle}>Join the club</Text>
                  <Text style={styles.accountDetail}>RSVP for your family and keep the sessions you follow in one place.</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding')} style={styles.accountAction}>
                    <Text style={styles.accountActionText}>Create account or sign in</Text>
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </View>
      <View
        style={[styles.pane, view !== 'club' && styles.paneHidden]}
        accessibilityElementsHidden={view !== 'club'}
        importantForAccessibility={view === 'club' ? 'auto' : 'no-hide-descendants'}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ClubDirectory nowIso={nowIso} />
        </ScrollView>
      </View>
      </Animated.View>
    </Screen>
  );
}

function HomeSwitch({ value, onChange }: { value: 'you' | 'club'; onChange: (next: 'you' | 'club') => void }) {
  const options = [
    { id: 'you' as const, label: 'For you' },
    { id: 'club' as const, label: 'Club' },
  ];
  const reduced = useReducedMotion();
  const ref = useRef<View>(null);
  const [width, setWidth] = useState(0);
  const index = value === 'you' ? 0 : 1;
  const pill = useSharedValue(index);
  useEffect(() => {
    pill.value = reduced ? index : withTiming(index, { duration: motion.duration.base, easing: Easing.out(Easing.cubic) });
  }, [index, pill, reduced]);
  const pillStyle = useAnimatedStyle(() => {
    const segment = Math.max((width - 8) / 2, 0);
    return { width: segment, transform: [{ translateX: pill.value * segment }] };
  });
  useEffect(() => {
    const root = ref.current as unknown as { querySelectorAll?: (query: string) => Iterable<HTMLElement> } | null;
    if (!root?.querySelectorAll) return;
    for (const node of root.querySelectorAll('[role="tab"]')) {
      node.setAttribute('aria-selected', node.textContent?.trim() === (value === 'you' ? 'For you' : 'Club') ? 'true' : 'false');
    }
  }, [value]);
  return (
    <View ref={ref} accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.switchRow}>
      <Animated.View pointerEvents="none" style={[styles.switchPill, pillStyle]} />
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.id)}
            style={styles.switchOption}
          >
            <Text style={[styles.switchText, selected && styles.switchTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function heroPose(kind: HomeStory['kind'], role: ReturnType<typeof useApp>['role'], startsAt: string, nowIso: string): RoyPose {
  if (kind === 'live') return 'run';
  if (kind === 'result') return 'thumbsup';
  const hours = (new Date(startsAt).getTime() - new Date(nowIso).getTime()) / 3_600_000;
  if (hours <= 24) return 'excited';
  return role === 'guest' ? 'wave' : 'idle';
}

function StoryCard({
  story,
  event,
  role,
  childId,
  childName,
  nowIso,
  onSupport,
}: {
  story: HomeStory;
  event?: ReturnType<typeof useApp>['schedule'][number];
  role: ReturnType<typeof useApp>['role'];
  childId?: string;
  childName?: string;
  nowIso: string;
  onSupport: (eventId: string, going: boolean) => void;
}) {
  const parts = formatEventParts(story.startsAt);
  const card = event ? contextualStory(event, storyViewerFor({ role, event, childId, childName })) : null;
  const run = () => {
    if (!card?.action || !event) return;
    if (card.action.kind === 'signin') router.push('/onboarding');
    else if (card.action.kind === 'support') onSupport(event.id, !event.supporterGoing);
    else router.push(story.href as never);
  };
  return (
    <HeroStoryCard
      href={story.href as Href}
      kicker={card?.eyebrow ?? story.kicker}
      weekday={parts.weekday}
      day={parts.day}
      month={parts.month}
      headline={card?.headline ?? story.title}
      support={card ? conciseSupport(card.headline, card.supporting, event?.opponent) : undefined}
      facts={card?.facts ?? story.meta}
      signal={card?.signal}
      action={card?.action ? { label: card.action.label, onPress: run } : undefined}
      tone={story.kind}
      pose={heroPose(story.kind, role, story.startsAt, nowIso)}
    />
  );
}

function CompactStory({
  event,
  role,
  childId,
  childName,
  onSupport,
  showImage,
}: {
  event: ReturnType<typeof useApp>['schedule'][number];
  role: ReturnType<typeof useApp>['role'];
  childId?: string;
  childName?: string;
  onSupport: (eventId: string, going: boolean) => void;
  showImage: boolean;
}) {
  const parts = formatEventParts(event.startsAt);
  const card = contextualStory(event, storyViewerFor({ role, event, childId, childName }));
  const support = conciseSupport(card.headline, card.supporting, event.opponent);
  const program = demoPrograms.find((item) => item.id === event.programId) ?? demoPrograms.find((item) => item.teamId && item.teamId === event.teamId);
  const href = (event.sport === 'cricket' ? cricketEventHref(event) : `/event/${event.id}`) as Href;
  const tint = tints[tintFor(event)];
  // The hero and the join card already ask guests to sign in; repeating it on every row is noise.
  const rowAction = card.action?.kind === 'signin' ? undefined : card.action;
  const action = () => {
    if (card.action?.kind === 'signin') router.push('/onboarding');
    else if (card.action?.kind === 'support') onSupport(event.id, !event.supporterGoing);
    else router.push(href);
  };
  return (
    <View style={[styles.compact, { backgroundColor: tint.bg }]}>
      <View style={styles.storyRow}>
        {showImage && program?.heroImage ? (
          <Image source={{ uri: program.heroImage }} style={styles.compactImage} contentFit="cover" />
        ) : (
          <Link href={href} asChild>
            <Pressable style={styles.compactDate}>
              <Text style={styles.featuredDow}>{parts.weekday}</Text>
              <Text style={styles.compactDay}>{parts.day}</Text>
            </Pressable>
          </Link>
        )}
        <View style={styles.flex}>
          <Link href={href} asChild>
            <Pressable>
              <Text style={[styles.featuredKicker, { color: tint.accent }]}>{card.eyebrow.toUpperCase()}</Text>
              <Text style={styles.secondaryTitle}>{card.headline}</Text>
              {support ? <Text style={styles.featuredMeta}>{support}</Text> : null}
              <Text style={styles.featuredMeta}>{parts.time} · {event.venue}</Text>
              {card.signal ? <Text style={styles.featuredMeta}>{card.signal}</Text> : null}
            </Pressable>
          </Link>
          {rowAction ? (
            <Pressable accessibilityRole="button" accessibilityLabel={rowAction.label} onPress={action} style={styles.storyAction}>
              <Text style={styles.storyActionText}>{rowAction.label}</Text>
            </Pressable>
          ) : (
            <Link href={href} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel={`Open ${card.headline}`} style={styles.storyAction}>
                <Ionicons name="arrow-forward" size={16} color={tint.accent} />
              </Pressable>
            </Link>
          )}
        </View>
      </View>
    </View>
  );
}

function recapRow(
  role: ReturnType<typeof useApp>['role'],
  schedule: ReturnType<typeof useApp>['schedule'],
  recaps: ReturnType<typeof useApp>['recaps'],
) {
  if (role !== 'coach' && role !== 'admin') return null;
  const session = schedule.find((event) => event.id === RECAP_EVENT_ID);
  const recap = recapForEvent(recaps, RECAP_EVENT_ID);
  if (!session) return null;
  const identity = sessionIdentity(session);
  if (recap?.status === 'sent') {
    const scheduled = recap.delivery && recap.delivery !== 'now' && recap.scheduledFor;
    return {
      id: 'recap',
      title: scheduled ? `Scheduled for ${formatInstantTime(new Date(recap.scheduledFor!))}` : `Sent to ${recap.recipientCount} ${recap.recipientCount === 1 ? 'family' : 'families'}`,
      detail: `${identity.kicker} · ${identity.title}`,
      href: `/session/${RECAP_EVENT_ID}/recap`,
    };
  }
  if (!hoursAfterEnd(session, 2)) return null;
  return {
    id: 'recap',
    title: 'Send families a quick session recap',
    detail: `${identity.kicker} is complete. Nothing sends until you approve it.`,
    href: `/session/${RECAP_EVENT_ID}/recap`,
  };
}

function attentionRows(input: {
  urgent?: { title: string; body: string; route?: string };
  closedField?: { id: string; venue: string };
  staffPending: boolean;
  pendingStaffRole?: string | null;
  conflict: { title: string; detail: string } | null;
  parentReg?: { id: string; participantNames: string[]; amountDue: number; paymentStatus: string };
  role: ReturnType<typeof useApp>['role'];
  kidsEvent?: { id: string };
  missingRsvps: number;
  menEvent?: { id: string; attendance?: string };
  pendingCount: number;
  hydrated: boolean;
  coachUpdate?: { title: string; body: string; route?: string };
  recap: { id: string; title: string; detail: string; href: string } | null;
  primaryEventId?: string;
}) {
  const rows: { id: string; title: string; detail: string; href: string }[] = [];
  const push = (row: { id: string; title: string; detail: string; href: string }) => {
    if (rows.length >= 2 || rows.some((item) => item.id === row.id)) return;
    rows.push(row);
  };
  if (input.urgent) push({ id: 'urgent', title: input.urgent.title, detail: input.urgent.body, href: input.urgent.route ?? '/notifications' });
  if (input.closedField) push({ id: 'field', title: 'Field closed', detail: input.closedField.venue, href: `/event/${input.closedField.id}` });
  if (input.staffPending) {
    push({
      id: 'staff',
      title: `${input.pendingStaffRole === 'coach' ? 'Coach' : 'Manager'} access is pending`,
      detail: 'Request received. Staff tools stay locked until an admin assigns this account.',
      href: '/(tabs)/profile',
    });
  }
  if (input.conflict) push({ id: 'conflict', title: input.conflict.title, detail: input.conflict.detail, href: '/(tabs)/schedule' });
  if (input.parentReg && (input.parentReg.paymentStatus === 'awaiting_payment' || input.parentReg.paymentStatus === 'failed')) {
    push({
      id: 'payment',
      title: input.parentReg.paymentStatus === 'failed' ? 'Payment didn’t go through' : 'Payment due',
      detail: `${input.parentReg.participantNames.join(', ')} · $${input.parentReg.amountDue}`,
      href: `/season/${input.parentReg.id}`,
    });
  }
  if (input.coachUpdate) {
    push({
      id: 'coach-update',
      title: input.coachUpdate.title,
      detail: input.coachUpdate.body,
      href: input.coachUpdate.route ?? '/updates',
    });
  }
  if (input.role === 'coach' && input.kidsEvent && input.kidsEvent.id !== input.primaryEventId) {
    push({ id: 'attendance', title: 'Take attendance', detail: `${input.missingRsvps} families still need RSVP`, href: `/event/${input.kidsEvent.id}` });
  }
  if (input.recap) push(input.recap);
  if (input.role === 'adult_player' && input.menEvent && !input.menEvent.attendance && input.menEvent.id !== input.primaryEventId) {
    push({ id: 'player-rsvp', title: 'RSVP for the next match', detail: 'Going, maybe, or can’t go', href: `/event/${input.menEvent.id}` });
  }
  if (input.role === 'admin' && input.hydrated) {
    push({ id: 'regs', title: 'Pending registrations', detail: `${input.pendingCount} waiting on club review`, href: '/admin' });
  }
  return rows.slice(0, 2);
}

type BriefLook = { icon: keyof typeof Ionicons.glyphMap; tint: keyof typeof tints };

const briefLook: Record<string, BriefLook> = {
  urgent: { icon: 'alert-circle-outline', tint: 'blush' },
  field: { icon: 'warning-outline', tint: 'blush' },
  staff: { icon: 'time-outline', tint: 'sky' },
  conflict: { icon: 'git-compare-outline', tint: 'lilac' },
  payment: { icon: 'card-outline', tint: 'gold' },
  'coach-update': { icon: 'chatbubble-ellipses-outline', tint: 'mint' },
  attendance: { icon: 'checkbox-outline', tint: 'mint' },
  recap: { icon: 'mic-outline', tint: 'mint' },
  'player-rsvp': { icon: 'calendar-outline', tint: 'sky' },
  regs: { icon: 'people-outline', tint: 'lilac' },
};

function Brief({ title, detail, href, look, badge }: { title: string; detail: string; href: string; look?: BriefLook; badge?: string }) {
  const tint = tints[look?.tint ?? 'mint'];
  return (
    <Link href={href as never} asChild>
      <PressableScale style={StyleSheet.flatten([styles.brief, { backgroundColor: tint.bg }])}>
        <View style={styles.briefIcon}>
          <Ionicons accessible={false} name={look?.icon ?? 'sparkles-outline'} size={19} color={tint.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.briefTitle}>{title}</Text>
          <Text style={styles.briefDetail}>{detail}</Text>
        </View>
        {badge ? (
          <View style={styles.badge}><Text style={styles.badgeText}>{badge.toUpperCase()}</Text></View>
        ) : (
          <Ionicons accessible={false} name="arrow-forward" size={16} color={tint.accent} />
        )}
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: 900, paddingBottom: 0 },
  pane: { flex: 1 },
  paneHidden: { display: 'none' },
  scroll: { paddingBottom: 108 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  mainCol: { flex: 1.15, minWidth: 0 },
  sideCol: { flex: 0.85, minWidth: 280 },
  section: { ...typography.label, color: colors.stone, fontSize: 11, letterSpacing: 1.1, marginTop: 6, marginBottom: 8 },
  switchRow: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 16, padding: 4, marginBottom: 14, position: 'relative' },
  switchPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: colors.ink },
  switchOption: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  switchText: { color: colors.stone, fontSize: 14, ...typography.label },
  switchTextOn: { color: colors.white },
  compact: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.paper,
    marginBottom: 10,
  },
  compactDate: {
    width: 44,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactDay: { color: colors.white, fontSize: 16, lineHeight: 18, ...typography.display },
  compactImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.sand },
  secondaryTitle: { color: colors.ink, fontSize: 14, marginTop: 2, ...typography.heading },
  accountCard: {
    padding: 18,
    paddingRight: 112,
    borderRadius: 22,
    backgroundColor: colors.greenDeep,
    marginBottom: 10,
    gap: 6,
    overflow: 'hidden',
  },
  accountRoy: { position: 'absolute', right: -6, bottom: -14, width: 118, height: 118 },
  accountTitle: { color: colors.white, fontSize: 17, ...typography.heading },
  accountDetail: { color: 'rgba(255,255,255,0.78)', fontSize: 12, lineHeight: 17, ...typography.body },
  accountAction: { alignSelf: 'flex-start', minHeight: 44, marginTop: 8, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  accountActionText: { color: colors.ink, fontSize: 13, ...typography.label },
  scheduleLink: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginBottom: 8 },
  scheduleLinkText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.mint },
  avatarImage: { width: 48, height: 60 },
  mark: { color: colors.ink, fontSize: 11, ...typography.label, letterSpacing: 1.8 },
  hello: { color: colors.ink, fontSize: 22, lineHeight: 26, marginTop: 2, ...typography.pageTitle },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBadge: { position: 'absolute', top: -6, right: -6 },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  flex: { flex: 1 },
  photoHero: {
    minHeight: 240,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 20,
    gap: 8,
    marginBottom: 16,
  },
  heroKicker: { color: colors.mint, fontSize: 11, ...typography.label, letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 28, lineHeight: 30, ...typography.display },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, ...typography.body },
  introCopy: { color: colors.stone, fontSize: 14, lineHeight: 20, marginBottom: 16, ...typography.body },
  featured: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  storyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featuredLive: { borderColor: colors.orange },
  featuredResult: { backgroundColor: colors.paper },
  featuredDate: {
    width: 52,
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredDow: { color: colors.mint, fontSize: 9, ...typography.label, letterSpacing: 0.8 },
  featuredDay: { color: colors.white, fontSize: 22, lineHeight: 24, ...typography.display },
  featuredKicker: { color: colors.stone, fontSize: 9, ...typography.label, letterSpacing: 1.2 },
  featuredTitle: { color: colors.ink, fontSize: 15, marginTop: 2, ...typography.heading },
  featuredMeta: { color: colors.stone, fontSize: 12, marginTop: 2, ...typography.body },
  storyAction: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginTop: 6 },
  storyActionText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 108,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  tileIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileLabel: { color: colors.ink, fontSize: 15, ...typography.heading },
  tileDetail: { color: colors.stone, fontSize: 12, marginTop: 2, ...typography.body },
  brief: {
    minHeight: 68,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    backgroundColor: colors.paper,
    marginBottom: 10,
  },
  briefIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.orange },
  badgeText: { color: colors.white, fontSize: 11, ...typography.label, letterSpacing: 0.8 },
  briefTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  briefDetail: { color: colors.stone, fontSize: 12, marginTop: 2, ...typography.body },
  urgent: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.danger, marginBottom: 10 },
  urgentTitle: { color: colors.white, ...typography.heading },
  urgentBody: { color: colors.white, opacity: 0.9, fontSize: 12, marginTop: 2, ...typography.body },
  seasonCard: { padding: 14, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  checkedIn: { color: colors.ink, fontSize: 13, marginTop: 8, ...typography.heading },
  childSwitch: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  childChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  childChipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  childChipText: { color: colors.charcoal, fontSize: 12, ...typography.label },
  childChipOnText: { color: colors.white },
});
