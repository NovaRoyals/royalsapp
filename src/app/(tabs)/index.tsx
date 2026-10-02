import { Ionicons } from '@expo/vector-icons';
import { Href, Link, router } from 'expo-router';
import { useEffect, useMemo, useRef, useSyncExternalStore, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ClubDirectory } from '@/components/home/ClubDirectory';
import { SeasonDots } from '@/components/interactions/SeasonDots';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/ui';
import { kidsProgramId } from '@/data/demo';
import { mayaAttendanceHistory } from '@/lib/attendance';
import { RECAP_EVENT_ID, recapForEvent, sessionIdentity } from '@/lib/coachRecap';
import { clubNowIso, formatEventParts, formatInstantTime, hoursAfterEnd, relativeDayLabel } from '@/lib/datetime';
import { conciseSupport, youthRegistrationPrompt } from '@/lib/homeFeed';
import { getHomeView, setHomeView, subscribeHomeView } from '@/lib/homeView';
import { homeStories, householdConflictStub, nextUpcomingEvent, type HomeStory } from '@/lib/intelligence';
import { homeGreeting } from '@/lib/greeting';
import { contextualStory, storyViewerFor } from '@/lib/matchStory';
import { COACH_TEAM_ID, PLAYER_TEAM_ID, notificationsForRole } from '@/lib/membership';
import { useReducedMotion } from '@/lib/reducedMotion';
import { useApp } from '@/state/AppProvider';
import { colors, layout, radius, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const { role, household, registrations, schedule, notifications, hydrated, persona, pendingStaffRole, recaps, setSupporter } = useApp();
  const reduced = useReducedMotion();
  const view = useSyncExternalStore(subscribeHomeView, getHomeView, () => 'you' as const);
  const [childId, setChildId] = useState(household.children[0]?.id);
  const choose = (next: 'you' | 'club') => {
    setHomeView(next);
    router.setParams({ view: next === 'club' ? 'club' : '' });
  };
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
  const pendingRegs = registrations.filter((item) => item.status === 'pending' || item.paymentStatus === 'pending');
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
  const secondary = stories.find((story) => story.eventId !== primary?.eventId);
  const primaryEvent = schedule.find((item) => item.id === primary?.eventId);
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
        <View style={styles.flex}>
          <Text style={styles.mark}>NOVA ROYALS</Text>
          <Text style={styles.hello}>{hello}</Text>
        </View>
        <Link href={'/notifications' as never} asChild>
          <Pressable accessibilityLabel="Open notifications" style={styles.bell}>
            <Ionicons name="notifications-outline" size={20} color={colors.ink} />
            {unread.length ? <View style={styles.bellDot} /> : null}
          </Pressable>
        </Link>
      </View>
      <HomeSwitch value={view} onChange={choose} />
      <View
        style={[styles.pane, view !== 'you' && styles.paneHidden]}
        accessibilityElementsHidden={view !== 'you'}
        importantForAccessibility={view === 'you' ? 'auto' : 'no-hide-descendants'}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {role === 'guardian' && hasChildren ? (
            <View style={styles.childSwitch}>
              {household.children.map((child) => (
                <PressableScale key={child.id} onPress={() => setChildId(child.id)} style={[styles.childChip, child.id === viewingChild?.id && styles.childChipOn]}>
                  <Text style={[styles.childChipText, child.id === viewingChild?.id && styles.childChipOnText]}>{child.firstName}</Text>
                </PressableScale>
              ))}
            </View>
          ) : null}
          {registration ? (
            <Brief
              title={registration.childName ? `Register ${registration.childName}` : 'Register a child'}
              detail="Fall Soccer Training is open · Sundays 9–10 AM · Arrowhead 3A."
              href={`/registration/${registration.programId}`}
            />
          ) : null}
          {attention.length ? <Text style={styles.section}>Needs attention</Text> : null}
          {attention.map((row) => (
            <Brief key={row.id} title={row.title} detail={row.detail} href={row.href} />
          ))}
          {primary ? (
            <>
              <Text style={styles.section}>Next up</Text>
              <StoryCard
                story={primary}
                event={primaryEvent}
                role={role}
                childId={viewingChild?.id}
                childName={viewingChild?.firstName}
                onSupport={setSupporter}
              />
            </>
          ) : null}
          {secondary ? (
            <SecondaryStory story={secondary} event={schedule.find((item) => item.id === secondary.eventId)} role={role} childId={viewingChild?.id} childName={viewingChild?.firstName} />
          ) : null}
          <Link href="/(tabs)/schedule" asChild>
            <Pressable accessibilityRole="link" style={styles.scheduleLink}>
              <Text style={styles.scheduleLinkText}>See schedule</Text>
            </Pressable>
          </Link>
          {role === 'guest' ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding')} style={styles.scheduleLink}>
              <Text style={styles.scheduleLinkText}>Create account or sign in</Text>
            </Pressable>
          ) : null}
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
    </Screen>
  );
}

function HomeSwitch({ value, onChange }: { value: 'you' | 'club'; onChange: (next: 'you' | 'club') => void }) {
  const options = [
    { id: 'you' as const, label: 'For you' },
    { id: 'club' as const, label: 'Club' },
  ];
  const ref = useRef<View>(null);
  useEffect(() => {
    const root = ref.current as unknown as { querySelectorAll?: (query: string) => Iterable<HTMLElement> } | null;
    if (!root?.querySelectorAll) return;
    for (const node of root.querySelectorAll('[role="tab"]')) {
      node.setAttribute('aria-selected', node.textContent?.trim() === (value === 'you' ? 'For you' : 'Club') ? 'true' : 'false');
    }
  }, [value]);
  return (
    <View ref={ref} accessibilityRole="tablist" style={styles.switchRow}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.id)}
            style={[styles.switchOption, selected && styles.switchOptionOn]}
          >
            <Text style={[styles.switchText, selected && styles.switchTextOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StoryCard({
  story,
  event,
  role,
  childId,
  childName,
  onSupport,
}: {
  story: HomeStory;
  event?: ReturnType<typeof useApp>['schedule'][number];
  role: ReturnType<typeof useApp>['role'];
  childId?: string;
  childName?: string;
  onSupport: (eventId: string, going: boolean) => void;
}) {
  const parts = formatEventParts(story.startsAt);
  const card = event ? contextualStory(event, storyViewerFor({ role, event, childId, childName })) : null;
  const action = () => {
    if (!card?.action || !event) return;
    if (card.action.kind === 'signin') router.push('/onboarding');
    else if (card.action.kind === 'support') onSupport(event.id, !event.supporterGoing);
    else router.push(story.href as never);
  };
  return (
    <View style={StyleSheet.flatten([styles.featured, story.kind === 'result' && styles.featuredResult, story.kind === 'live' && styles.featuredLive])}>
      <View style={styles.storyRow}>
        <Link href={story.href as Href} asChild>
          <Pressable style={styles.featuredDate}>
            <Text style={styles.featuredDow}>{parts.weekday}</Text>
            <Text style={styles.featuredDay}>{parts.day}</Text>
          </Pressable>
        </Link>
        <View style={styles.flex}>
          <Link href={story.href as Href} asChild>
            <Pressable>
              <Text style={styles.featuredKicker}>{(card?.eyebrow ?? story.kicker).toUpperCase()}</Text>
              <Text style={styles.featuredTitle}>{card?.headline ?? story.title}</Text>
              {card ? <SupportLine headline={card.headline} supporting={card.supporting} opponent={event?.opponent} /> : null}
              <Text style={styles.featuredMeta}>{card?.facts ?? story.meta}</Text>
              {card?.signal ? <Text style={styles.featuredMeta}>{card.signal}</Text> : null}
            </Pressable>
          </Link>
          {card?.action ? (
            <Pressable accessibilityRole="button" accessibilityLabel={card.action.label} onPress={action} style={styles.storyAction}>
              <Text style={styles.storyActionText}>{card.action.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function SupportLine({ headline, supporting, opponent }: { headline: string; supporting: string; opponent?: string }) {
  const line = conciseSupport(headline, supporting, opponent);
  if (!line) return null;
  return <Text style={styles.featuredMeta}>{line}</Text>;
}

function SecondaryStory({
  story,
  event,
  role,
  childId,
  childName,
}: {
  story: HomeStory;
  event?: ReturnType<typeof useApp>['schedule'][number];
  role: ReturnType<typeof useApp>['role'];
  childId?: string;
  childName?: string;
}) {
  const card = event ? contextualStory(event, storyViewerFor({ role, event, childId, childName })) : null;
  const support = card ? conciseSupport(card.headline, card.supporting, event?.opponent) : undefined;
  return (
    <Link href={story.href as Href} asChild>
      <Pressable style={styles.secondary}>
        <Text style={styles.featuredKicker}>{(card?.eyebrow ?? story.kicker).toUpperCase()}</Text>
        <Text style={styles.secondaryTitle}>{card?.headline ?? story.title}</Text>
        {support ? <Text style={styles.featuredMeta}>{support}</Text> : null}
      </Pressable>
    </Link>
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
  if (input.parentReg && input.parentReg.paymentStatus !== 'paid') {
    push({
      id: 'payment',
      title: 'Payment still pending',
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

function Brief({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Link href={href as never} asChild>
      <PressableScale style={styles.brief}>
        <View style={styles.flex}>
          <Text style={styles.briefTitle}>{title}</Text>
          <Text style={styles.briefDetail}>{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.stone} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, maxWidth: layout.flowWidth, paddingBottom: 0 },
  pane: { flex: 1 },
  paneHidden: { display: 'none' },
  scroll: { paddingBottom: 108 },
  section: { ...typography.label, color: colors.stone, fontSize: 11, letterSpacing: 1.1, marginTop: 6, marginBottom: 8 },
  switchRow: { flexDirection: 'row', backgroundColor: colors.sand, borderRadius: 14, padding: 4, marginBottom: 14 },
  switchOption: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  switchOptionOn: { backgroundColor: colors.ink },
  switchText: { color: colors.stone, fontSize: 14, ...typography.label },
  switchTextOn: { color: colors.white },
  secondary: { paddingVertical: 10, marginBottom: 8 },
  secondaryTitle: { color: colors.ink, fontSize: 14, marginTop: 2, ...typography.heading },
  scheduleLink: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginBottom: 8 },
  scheduleLinkText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 8, marginBottom: 18 },
  mark: { color: colors.ink, fontSize: 11, ...typography.label, letterSpacing: 1.8 },
  hello: { color: colors.ink, fontSize: 22, lineHeight: 28, marginTop: 4, marginBottom: 8, ...typography.pageTitle },
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
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.paper,
    marginBottom: 10,
  },
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
