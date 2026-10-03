import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Chip, Screen } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { demoSchedule, demoTeams } from '@/data/demo';
import { getCoachPolishProvider, type RecapPolishMode } from '@/lib/ai/coachPolish';
import { PolishError } from '@/lib/ai/edgePolish';
import { can, canCreateSessionRecap, canSendSessionRecap } from '@/lib/capabilities';
import {
  ACTIVE_COACH,
  KIND_LABEL,
  MOCK_VOICE_TRANSCRIPT,
  NOTE_TAGS,
  canonicalRecapText,
  noteDraftFromTags,
  noteKind,
  recapAudience,
  recapForEvent,
  recapTranscript,
  sessionIdentity,
} from '@/lib/coachRecap';
import { formatInstantWhen } from '@/lib/datetime';
import {
  applyPolish,
  applyTranscript,
  attendanceApprovalError,
  deliveryApprovalError,
  deliveryCta,
  deliveryOption,
  deliveryOptions,
  deliveryPreviewWhen,
} from '@/lib/deliveryTiming';
import { COACH_TEAM_ID } from '@/lib/membership';
import { noteTargets } from '@/lib/recapPrivacy';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { CoachNoteTag, IndividualCoachNote, RecapDelivery, SessionRecap } from '@/types/domain';

type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'ready' | 'failed';

type RadioNode = {
  focus?: () => void;
  setAttribute?: (name: string, value: string) => void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
  style?: {
    setProperty: (name: string, value: string, priority?: string) => void;
    removeProperty: (name: string) => void;
  };
};

export function generateStaticParams() {
  return demoSchedule.filter((item) => item.teamId === COACH_TEAM_ID).map((item) => ({ eventId: item.id }));
}

type Phase = 'compose' | 'preview' | 'receipt';

const POLISH_MODES: { id: RecapPolishMode; label: string; hint: string }[] = [
  { id: 'cleanup', label: 'Clean up only', hint: 'Grammar and punctuation' },
  { id: 'warm', label: 'Warm and concise', hint: 'Friendly, still your words' },
  { id: 'verbatim', label: 'Keep exactly as spoken', hint: 'No rewrite' },
];

export default function SessionRecapScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { schedule, recaps, role, saveRecapDraft, sendSessionRecap, managerCanSendRecap, hydrated } = useApp();
  const toast = useToast();
  const event = schedule.find((item) => item.id === eventId) ?? schedule[0];
  const team = demoTeams.find((item) => item.id === event.teamId);
  const roster = team?.roster ?? [];
  const stored = recapForEvent(recaps, event.id);
  const audience = recapAudience(roster, event.checkIns ?? []);
  const identity = sessionIdentity(event);
  const canDraft = canCreateSessionRecap(role, event.teamId);
  const canSend = canSendSessionRecap(role, managerCanSendRecap);
  const canView = canDraft || can(role, 'view_recap_status');

  const [draft, setDraft] = useState<SessionRecap>(() => normalizeRecap(stored ?? blankRecap(event.id)));
  const [eventKey, setEventKey] = useState(event.id);
  const [phase, setPhase] = useState<Phase>(stored?.status === 'sent' ? 'receipt' : 'compose');
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const radioRefs = useRef<Partial<Record<RecapDelivery, RadioNode | null>>>({});
  const deliveryChoice = draft.delivery ?? 'now';
  useEffect(() => {
    for (const option of deliveryOptions(event)) {
      const node = radioRefs.current[option.choice];
      if (!node?.setAttribute) continue;
      node.setAttribute('aria-checked', option.choice === deliveryChoice ? 'true' : 'false');
      node.setAttribute('aria-disabled', option.available ? 'false' : 'true');
    }
    if (typeof document === 'undefined') return;
    const hosts = [...document.querySelectorAll('[role="radio"]')] as HTMLElement[];
    const paintFocus = () => {
      for (const host of hosts) {
        if (document.activeElement === host) {
          host.style.setProperty('outline', '2px solid #C85A24', 'important');
          host.style.setProperty('outline-offset', '2px', 'important');
        } else {
          host.style.removeProperty('outline');
          host.style.removeProperty('outline-offset');
        }
      }
    };
    for (const host of hosts) {
      host.addEventListener('focus', paintFocus);
      host.addEventListener('blur', paintFocus);
    }
    paintFocus();
    return () => {
      for (const host of hosts) {
        host.removeEventListener('focus', paintFocus);
        host.removeEventListener('blur', paintFocus);
      }
    };
  }, [deliveryChoice, event, phase]);
  const [polishOpen, setPolishOpen] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteChildId, setNoteChildId] = useState<string | null>(stored?.notes[0]?.childId ?? null);
  const [previewChild, setPreviewChild] = useState(audience.recipients[0]?.id ?? audience.present[0]?.id ?? '');
  const [showTranscript, setShowTranscript] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteQuery, setNoteQuery] = useState('');
  const [offline, setOffline] = useState(false);
  const [savedAt, setSavedAt] = useState(stored?.updatedAt ?? '');
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    if (typeof window === 'undefined') return;
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (eventKey !== event.id) {
    setEventKey(event.id);
    setDraft(normalizeRecap(stored ?? blankRecap(event.id)));
    setPhase(stored?.status === 'sent' ? 'receipt' : 'compose');
  }
  const view: Phase = draft.status === 'sent' ? 'receipt' : phase;

  if (!hydrated) {
    return (
      <Screen>
        <Text style={styles.kicker}>SESSION RECAP</Text>
        <Text style={styles.title}>Loading…</Text>
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen>
        <Topbar />
        <Text style={styles.title}>Not available</Text>
        <Text style={styles.hint}>Session recaps are for assigned coaches and club staff.</Text>
      </Screen>
    );
  }

  const persist = (next: SessionRecap) => {
    setDraft(next);
    if (!canDraft || next.status === 'sent') return;
    saveRecapDraft(next);
    setSavedAt(new Date().toISOString());
  };

  const recordVoice = () => {
    if (!canDraft || draft.status === 'sent') return;
    if (offline) {
      persist(applyTranscript(draft, 'failed', MOCK_VOICE_TRANSCRIPT));
      setVoicePhase('failed');
      return;
    }
    setVoicePhase('recording');
    const snapshot = draft;
    setTimeout(() => setVoicePhase('transcribing'), 600);
    setTimeout(() => {
      persist(applyTranscript(snapshot, 'ready', MOCK_VOICE_TRANSCRIPT));
      setVoicePhase('ready');
      toast('Ready for review. Edit anything that should change.');
    }, 1200);
  };

  const polish = async (mode: RecapPolishMode) => {
    const source = canonicalRecapText(draft);
    const transcript = recapTranscript(draft);
    setPolishing(true);
    setPolishError('');
    try {
      if (offline) throw new Error('offline');
      const result = await getCoachPolishProvider().polish({
        original: source,
        mode,
        sessionLabel: identity.kicker || event.title,
        teamId: event.teamId,
        recapId: draft.id,
      });
      if (!result.text.trim()) throw new Error('empty');
      persist(applyPolish({ ...draft, transcript, originalText: transcript }, { ok: true, text: result.text, mode }));
      toast(mode === 'verbatim' ? 'Kept as written' : 'Polished text is now in the editor');
    } catch (error) {
      persist(applyPolish(draft, { ok: false }));
      setPolishError(error instanceof PolishError ? error.message : 'Could not polish right now. The text in the editor is unchanged.');
    } finally {
      setPolishing(false);
    }
  };

  const upsertNote = (childId: string, patch: Partial<IndividualCoachNote>) => {
    const person = roster.find((item) => item.id === childId);
    if (!person) return;
    const existing = draft.notes.find((note) => note.childId === childId);
    const nextNote: IndividualCoachNote = {
      childId,
      childFirstName: person.firstName,
      tags: patch.tags ?? existing?.tags ?? [],
      originalText: patch.originalText ?? existing?.originalText ?? '',
      approvedText: '',
    };
    nextNote.approvedText = noteDraftFromTags(nextNote.tags, nextNote.originalText);
    const notes = nextNote.tags.length || nextNote.originalText.trim()
      ? [...draft.notes.filter((note) => note.childId !== childId), nextNote]
      : draft.notes.filter((note) => note.childId !== childId);
    persist({ ...draft, notes });
  };

  const toggleTag = (childId: string, tag: CoachNoteTag) => {
    const existing = draft.notes.find((note) => note.childId === childId);
    const tags = existing?.tags.includes(tag) ? existing.tags.filter((item) => item !== tag) : [...(existing?.tags ?? []), tag];
    upsertNote(childId, { tags });
  };

  const onSend = () => {
    if (!canSend) {
      setSendError('Sending is limited to assigned coaches. Managers need an explicit grant.');
      return;
    }
    if (offline) {
      setSendError('You’re offline. The draft is saved — send when you’re back.');
      return;
    }
    const approvedAt = new Date();
    const delivery = draft.delivery ?? 'now';
    const option = deliveryOption(event, delivery, approvedAt);
    const blocked =
      attendanceApprovalError({ unrecordedCount: audience.unrecordedCount, recipientCount: audience.recipients.length }) ??
      deliveryApprovalError(option);
    if (blocked) {
      setSendError(blocked);
      return;
    }
    if (!canonicalRecapText(draft)) {
      setSendError('Write the shared recap before sending.');
      return;
    }
    const scheduledFor = option.choice === 'now' ? undefined : option.at?.toISOString();
    const approved: SessionRecap = {
      ...draft,
      message: canonicalRecapText(draft),
      coachName: ACTIVE_COACH.displayName,
      delivery,
      scheduledFor,
      recipientCount: audience.recipients.length,
      notes: draft.notes.map((note) => ({ ...note, approvedText: noteDraftFromTags(note.tags, note.originalText) })),
    };
    const result = sendSessionRecap(approved);
    if (!result.ok) {
      setSendError(result.error ?? 'Could not send.');
      return;
    }
    setDraft({
      ...approved,
      status: 'sent',
      sentAt: option.choice === 'now' ? approvedAt.toISOString() : undefined,
      scheduledFor,
      deliveryStatus: option.choice === 'now' ? 'delivered' : 'queued',
    });
    setPhase('receipt');
  };

  const display = canonicalRecapText(draft);
  const delivery = draft.delivery ?? 'now';
  const options = deliveryOptions(event);
  const selectedOption = options.find((item) => item.choice === delivery) ?? options[0];
  const sendLabel = deliveryCta(selectedOption, audience.recipients.length);
  const canApprove =
    canSend &&
    Boolean(display) &&
    !attendanceApprovalError({ unrecordedCount: audience.unrecordedCount, recipientCount: audience.recipients.length }) &&
    !deliveryApprovalError(selectedOption);
  const selectDelivery = (choice: RecapDelivery) => {
    const option = options.find((item) => item.choice === choice);
    if (!option?.available) return;
    persist({
      ...draft,
      delivery: choice,
      scheduledFor: choice === 'now' ? undefined : option.at?.toISOString(),
    });
  };
  const moveDelivery = (from: RecapDelivery, direction: 1 | -1) => {
    const enabled = options.filter((item) => item.available);
    const index = enabled.findIndex((item) => item.choice === from);
    const next = enabled[(index + direction + enabled.length) % enabled.length];
    if (!next) return;
    selectDelivery(next.choice);
    radioRefs.current[next.choice]?.focus?.();
  };
  const notePeople = noteTargets(audience.present, audience.absent.map((person) => person.id));
  const notedChildren = notePeople.filter((person) => {
    const note = draft.notes.find((item) => item.childId === person.id);
    return Boolean(note && (note.tags.length || note.originalText.trim()));
  });
  const unnamedChildren = notePeople.filter((person) => !notedChildren.some((item) => item.id === person.id));
  const contactStatus = (childId: string) =>
    audience.missingContact.some((person) => person.id === childId)
      ? 'No linked parent contact. This family is not included when the recap sends.'
      : 'This family receives the shared recap.';

  return (
    <KeyboardAvoidingView style={styles.screenWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={styles.screen}>
        <Topbar />
        <View style={styles.headRow}>
          <Text style={[styles.kicker, styles.grow]}>{identity.kicker}</Text>
          {savedAt && draft.status !== 'sent' ? (
            <View style={styles.savedPill}>
              <Ionicons accessible={false} importantForAccessibility="no" name="checkmark-circle" size={14} color={colors.greenBright} />
              <Text style={styles.saved}>Draft saved</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.when}>{identity.when}</Text>

        <View style={styles.audience}>
          <View style={styles.audienceTop}>
            <View style={styles.audienceIcon}>
              <Ionicons accessible={false} importantForAccessibility="no" name="people-outline" size={19} color={colors.greenBright} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.counts}>
                Sending to families of {audience.recipients.length} attending {audience.recipients.length === 1 ? 'player' : 'players'}
              </Text>
              <Text style={styles.audienceSub}>
                {audience.presentCount} present · {audience.absentCount} absent
                {audience.unrecordedCount ? ` · ${audience.unrecordedCount} not recorded` : ''}
              </Text>
            </View>
            <Pressable accessibilityRole="link" accessibilityLabel="Review attendance" onPress={() => router.push(`/event/${event.id}` as never)} hitSlop={8}>
              <Text style={styles.link}>Review attendance</Text>
            </Pressable>
          </View>
          {audience.unrecordedCount ? (
            <Text style={styles.error}>Attendance is still open for {audience.unrecordedCount} {audience.unrecordedCount === 1 ? 'player' : 'players'}. Sending stays off until everyone is marked. Not recorded is not the same as absent.</Text>
          ) : null}
          {audience.missingContact.length ? (
            <Text style={styles.error}>
              No linked parent contact: {audience.missingContact.map((person) => person.firstName).join(', ')}. {audience.missingContact.length === 1 ? 'That family is' : 'Those families are'} not included in the {audience.recipients.length}.
            </Text>
          ) : null}
        </View>

        {offline ? <Text style={styles.banner}>Offline — drafts save on this device.</Text> : null}

        {view === 'receipt' && draft.status === 'sent' ? (
          <Receipt recap={draft} identity={identity.kicker} />
        ) : view === 'preview' ? (
          <View style={styles.phase}>
            <Text style={styles.phaseTitle}>Parent view</Text>
            <Text style={styles.hint}>This is exactly what families will receive, plus a private note only if you wrote one for their child.</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Delivery" style={styles.gap}>
              {options.some((item) => !item.available) ? (
                <Text style={styles.hint}>The original delivery time has passed.</Text>
              ) : null}
              {options.map((option) => {
                const selected = delivery === option.choice;
                return (
                  <Pressable
                    key={option.choice}
                    ref={(node) => {
                      radioRefs.current[option.choice] = node as (typeof radioRefs.current)[RecapDelivery];
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: !option.available }}
                    accessibilityLabel={`${option.label}, ${option.detail}`}
                    disabled={!option.available}
                    onPress={() => selectDelivery(option.choice)}
                    {...(Platform.OS === 'web'
                      ? {
                          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
                            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                              event.preventDefault();
                              moveDelivery(option.choice, 1);
                            } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                              event.preventDefault();
                              moveDelivery(option.choice, -1);
                            } else if (event.key === ' ' || event.key === 'Enter') {
                              event.preventDefault();
                              selectDelivery(option.choice);
                            }
                          },
                        }
                      : null)}
                    style={({ pressed }) => [
                      styles.mode,
                      selected && styles.modeOn,
                      !option.available && styles.modeOff,
                      pressed && option.available && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      accessible={false}
                      importantForAccessibility="no"
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? colors.ink : colors.stone}
                    />
                    <View style={styles.modeCopy}>
                      <Text style={styles.modeLabel}>{option.label}</Text>
                      <Text style={styles.modeHint}>{option.detail}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.wrap}>
              {audience.recipients.map((person) => (
                <Chip key={person.id} label={person.firstName} active={previewChild === person.id} onPress={() => setPreviewChild(person.id)} />
              ))}
            </View>
            <ParentPreview
              recap={draft}
              childId={previewChild}
              identity={identity.kicker}
              sessionTitle={event.title}
              when={identity.when}
              recipients={audience.recipients.length}
              deliveryWhen={deliveryPreviewWhen(selectedOption)}
            />
            {audience.unrecordedCount || !audience.recipients.length ? (
              <Text style={styles.error}>Record attendance first. Recaps go only to families of children marked present.</Text>
            ) : null}
            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
            <Button label={sendLabel} onPress={onSend} disabled={!canApprove} />
            <Button label="Keep editing" variant="ghost" onPress={() => setPhase('compose')} />
          </View>
        ) : (
          <View style={styles.phase}>
            <View style={styles.sectionHead}>
              <Text style={styles.phaseTitle}>Shared recap</Text>
              {display || recapTranscript(draft) ? <Text style={styles.sectionNote}>Exactly what families receive</Text> : null}
            </View>
            <Text style={styles.hintSmall}>Demo only. No microphone audio is captured. {voiceLabel(voicePhase)}</Text>
            {!display ? (
              <Button
                label={voicePhase === 'recording' || voicePhase === 'transcribing' ? voiceLabel(voicePhase) : 'Record session recap'}
                icon="mic-outline"
                loading={voicePhase === 'recording' || voicePhase === 'transcribing'}
                onPress={recordVoice}
                disabled={!canDraft || voicePhase === 'recording' || voicePhase === 'transcribing'}
              />
            ) : null}
            {voicePhase === 'failed' ? (
              <Button label="Try transcription again" variant="secondary" onPress={recordVoice} disabled={!canDraft} />
            ) : null}
            {display || recapTranscript(draft) ? (
              <View style={styles.editor}>
                <TextInput
                  accessibilityLabel="Session recap"
                  multiline
                  value={display}
                  editable={canDraft && draft.status !== 'sent'}
                  onChangeText={(message) => persist({ ...draft, message })}
                  style={styles.composer}
                  textAlignVertical="top"
                />
                <View style={styles.actions}>
                  <Pill
                    icon="mic-outline"
                    label={voicePhase === 'recording' || voicePhase === 'transcribing' ? voiceLabel(voicePhase) : 'Record again'}
                    onPress={recordVoice}
                    disabled={!canDraft || voicePhase === 'recording' || voicePhase === 'transcribing'}
                  />
                  <Pill
                    icon="sparkles-outline"
                    label="Polish with AI"
                    active={polishOpen}
                    expanded={polishOpen}
                    onPress={() => setPolishOpen((open) => !open)}
                  />
                  {recapTranscript(draft) && recapTranscript(draft) !== display ? (
                    <Pill
                      icon="document-text-outline"
                      label={showTranscript ? 'Hide original transcript' : 'View original transcript'}
                      onPress={() => setShowTranscript((open) => !open)}
                    />
                  ) : null}
                  {recapTranscript(draft) && recapTranscript(draft) !== display ? (
                    <Pill
                      icon="refresh-outline"
                      label="Restore original"
                      onPress={() => persist({ ...draft, message: recapTranscript(draft), polishedText: '', polishMode: null })}
                    />
                  ) : null}
                </View>
                {polishOpen ? (
                  <View style={styles.polishBox}>
                    <View accessibilityRole="radiogroup" accessibilityLabel="AI transformation" style={styles.actions}>
                      {POLISH_MODES.map((mode) => {
                        const selected = draft.polishMode === mode.id && Boolean(draft.polishedText);
                        return (
                          <Pill
                            key={mode.id}
                            role="radio"
                            label={mode.label}
                            hint={mode.hint}
                            active={selected}
                            disabled={!canDraft || polishing}
                            onPress={() => polish(mode.id)}
                          />
                        );
                      })}
                    </View>
                    <Text style={styles.hintSmall}>
                      Rewrites your words. It will not add drills, scores, or named children.
                      {(() => {
                        const chosen = POLISH_MODES.find((mode) => draft.polishMode === mode.id && Boolean(draft.polishedText));
                        return chosen ? ` ${chosen.hint}.` : '';
                      })()}
                    </Text>
                    {polishing ? <Text style={styles.hintSmall}>Polishing…</Text> : null}
                    {polishError ? <Text style={styles.error}>{polishError}</Text> : null}
                  </View>
                ) : null}
                {showTranscript && recapTranscript(draft) && recapTranscript(draft) !== display ? (
                  <View style={styles.polishBox}>
                    <Text style={styles.sectionNote}>ORIGINAL TRANSCRIPT</Text>
                    <Text selectable style={styles.polished}>{recapTranscript(draft)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: notesOpen }}
              accessibilityLabel="Personalize for a child, optional"
              onPress={() => setNotesOpen((open) => !open)}
              style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
            >
              <View style={styles.audienceIcon}>
                <Ionicons accessible={false} importantForAccessibility="no" name="person-outline" size={18} color={colors.greenBright} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.advancedLabel}>Personalize for a child</Text>
                <Text style={styles.audienceSub}>
                  {notedChildren.length
                    ? `${notedChildren.length} private ${notedChildren.length === 1 ? 'note' : 'notes'} · optional`
                    : 'Optional · everyone gets the shared recap'}
                </Text>
              </View>
              <Ionicons accessible={false} importantForAccessibility="no" name={notesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.stone} />
            </Pressable>
            {notesOpen ? (
              <View style={styles.gap}>
                <Text style={styles.hint}>The shared recap goes to every attending family. Add something personal only when there is a specific observation worth sharing.</Text>
                <Text style={styles.sourceLabel}>
                  {notePeople.length} attending · {notedChildren.length} with a private note
                </Text>
                {notedChildren.map((person) => (
                  <NoteEditorRow
                    key={person.id}
                    person={person}
                    note={draft.notes.find((item) => item.childId === person.id)}
                    shared={display}
                    contact={contactStatus(person.id)}
                    identity={identity.kicker}
                    sessionTitle={event.title}
                    when={identity.when}
                    deliveryWhen={delivery === 'now' ? 'Immediately after approval' : 'Chosen on the parent preview'}
                    open={noteChildId === person.id}
                    onToggle={() => setNoteChildId(noteChildId === person.id ? null : person.id)}
                    onToggleTag={(tag) => toggleTag(person.id, tag)}
                    onText={(originalText) => upsertNote(person.id, { originalText })}
                    onRemove={() => persist({ ...draft, notes: draft.notes.filter((item) => item.childId !== person.id) })}
                  />
                ))}
                <Text style={styles.modeLabel}>Add note for another attendee</Text>
                <TextInput
                  accessibilityLabel="Search attending children"
                  placeholder="Search attending children"
                  placeholderTextColor={colors.stone}
                  value={noteQuery}
                  onChangeText={(value) => {
                    setNoteQuery(value);
                    setAddingNote(true);
                  }}
                  style={styles.search}
                />
                {addingNote || noteQuery.trim() ? (
                  <View style={styles.wrap}>
                    {unnamedChildren
                      .filter((person) => {
                        const query = noteQuery.trim().toLowerCase();
                        if (!query) return true;
                        return `${person.firstName} ${person.lastName}`.toLowerCase().includes(query);
                      })
                      .map((person) => (
                        <Chip
                          key={person.id}
                          label={person.firstName}
                          onPress={() => {
                            setNoteChildId(person.id);
                            setAddingNote(false);
                            setNoteQuery('');
                            setNotesOpen(true);
                          }}
                        />
                      ))}
                  </View>
                ) : null}
                {noteChildId && !notedChildren.some((person) => person.id === noteChildId) ? (
                  <NoteEditorRow
                    person={notePeople.find((person) => person.id === noteChildId)!}
                    note={draft.notes.find((item) => item.childId === noteChildId)}
                    shared={display}
                    contact={contactStatus(noteChildId)}
                    identity={identity.kicker}
                    sessionTitle={event.title}
                    when={identity.when}
                    deliveryWhen={delivery === 'now' ? 'Immediately after approval' : 'Chosen on the parent preview'}
                    open
                    onToggle={() => setNoteChildId(null)}
                    onToggleTag={(tag) => toggleTag(noteChildId, tag)}
                    onText={(originalText) => upsertNote(noteChildId, { originalText })}
                    onRemove={() => {
                      persist({ ...draft, notes: draft.notes.filter((item) => item.childId !== noteChildId) });
                      setNoteChildId(null);
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            <Button
              label="Preview parent view"
              onPress={() => {
                if (!display) {
                  setSendError('Record or type a shared recap first.');
                  return;
                }
                setSendError('');
                persist({ ...draft, message: display, recipientCount: audience.recipients.length, delivery });
                setPhase('preview');
              }}
              disabled={!canDraft && !can(role, 'view_recap_status')}
            />
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Topbar() {
  return (
    <View style={styles.topbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)/schedule')} style={styles.back}>
        <Ionicons name="arrow-back" size={21} />
      </Pressable>
      <Text style={styles.topTitle}>Session recap</Text>
      <View style={{ width: 44, height: 44 }} />
    </View>
  );
}

function ParentPreview({
  recap,
  childId,
  identity,
  sessionTitle,
  when,
  recipients,
  deliveryWhen,
}: {
  recap: SessionRecap;
  childId: string;
  identity: string;
  sessionTitle: string;
  when: string;
  recipients: number;
  deliveryWhen: string;
}) {
  const note = recap.notes.find((item) => item.childId === childId);
  const noteText = note ? noteDraftFromTags(note.tags, note.originalText) : '';
  const kind = note ? noteKind(note.tags) : null;
  return (
    <View style={styles.preview}>
      <Text style={styles.subkicker}>{KIND_LABEL.session_recap.toUpperCase()}</Text>
      <Text style={styles.previewBody}>{canonicalRecapText(recap)}</Text>
      {noteText ? (
        <>
          <Text style={styles.subkicker}>{KIND_LABEL[kind ?? 'private_note'].toUpperCase()} · {note?.childFirstName}</Text>
          <Text style={styles.previewBody}>{noteText}</Text>
        </>
      ) : (
        <Text style={styles.hint}>No private note for this child.</Text>
      )}
      <Text style={styles.meta}>{ACTIVE_COACH.displayName}</Text>
      <Text style={styles.meta}>{identity} · {sessionTitle} · {when}</Text>
      <Text style={styles.meta}>{recipients} {recipients === 1 ? 'family' : 'families'} · {deliveryWhen}</Text>
    </View>
  );
}

function Receipt({ recap, identity }: { recap: SessionRecap; identity: string }) {
  const scheduled = recap.delivery && recap.delivery !== 'now' && recap.scheduledFor;
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>{scheduled ? 'Scheduled' : 'Sent'}</Text>
      <Text style={styles.counts}>
        {scheduled
          ? `Scheduled for ${formatInstantWhen(new Date(recap.scheduledFor!))}`
          : `Sent to ${recap.recipientCount} ${recap.recipientCount === 1 ? 'family' : 'families'}`}
      </Text>
      <Text style={styles.hint}>
        {identity}
        {recap.notes.length ? ` · ${recap.notes.length} individual note${recap.notes.length === 1 ? '' : 's'}` : ''}
      </Text>
      <Text selectable style={styles.polished}>{canonicalRecapText(recap)}</Text>
      <Button label="Done" onPress={() => router.replace(`/event/${recap.eventId}`)} />
    </View>
  );
}

function NoteEditorRow({
  person,
  note,
  shared,
  contact,
  identity,
  sessionTitle,
  when,
  deliveryWhen,
  open,
  onToggle,
  onToggleTag,
  onText,
  onRemove,
}: {
  person: { id: string; firstName: string; displayName: string };
  note?: IndividualCoachNote;
  shared: string;
  contact: string;
  identity: string;
  sessionTitle: string;
  when: string;
  deliveryWhen: string;
  open: boolean;
  onToggle: () => void;
  onToggleTag: (tag: CoachNoteTag) => void;
  onText: (value: string) => void;
  onRemove: () => void;
}) {
  const privateNote = note ? noteDraftFromTags(note.tags, note.originalText) : '';
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${person.displayName}. ${note ? 'Edit note' : 'Add note'}`}
        onPress={onToggle}
        style={({ pressed }) => [styles.childRow, pressed && styles.pressed]}
      >
        <Text style={styles.childName}>{person.displayName}</Text>
        <Text style={styles.childMeta}>{privateNote || 'Add'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.notePad}>
          <Text style={styles.hintSmall}>{contact}</Text>
          <Text style={styles.modeLabel}>Add something specifically for {person.firstName}</Text>
          <View style={styles.wrap}>
            {NOTE_TAGS.map((tag) => (
              <Chip key={tag.id} label={tag.label} active={note?.tags.includes(tag.id)} onPress={() => onToggleTag(tag.id)} />
            ))}
          </View>
          <TextInput
            accessibilityLabel={`Add something specifically for ${person.firstName}`}
            placeholder="A specific observation, if there is one"
            placeholderTextColor={colors.stone}
            value={note?.originalText ?? ''}
            onChangeText={onText}
            style={styles.noteInput}
            multiline
          />
          {note ? <Button label={`Remove ${person.firstName}’s note`} variant="ghost" onPress={onRemove} /> : null}
          <View style={styles.preview}>
            <Text style={styles.subkicker}>SHARED SESSION RECAP</Text>
            <Text style={styles.previewBody}>{shared || 'The shared recap is still empty.'}</Text>
            <Text style={styles.subkicker}>FOR {person.firstName.toUpperCase()}</Text>
            <Text style={styles.previewBody}>{privateNote || 'No private note yet.'}</Text>
            <Text style={styles.meta}>{ACTIVE_COACH.displayName}</Text>
            <Text style={styles.meta}>{identity} · {sessionTitle} · {when}</Text>
            <Text style={styles.meta}>{deliveryWhen}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** A small rounded action: the editor's Record again / Polish with AI row, and the polish modes. */
function Pill({
  label,
  icon,
  onPress,
  disabled,
  active,
  expanded,
  role = 'button',
  hint,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  expanded?: boolean;
  role?: 'button' | 'radio';
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      accessibilityState={
        role === 'radio'
          ? { checked: Boolean(active), selected: Boolean(active), disabled: Boolean(disabled) }
          : { expanded, selected: expanded ? active : undefined, disabled: Boolean(disabled) }
      }
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active && styles.pillOn, disabled && styles.pillOff, pressed && !disabled && styles.pressed]}
    >
      {icon ? <Ionicons accessible={false} importantForAccessibility="no" name={icon} size={15} color={active ? colors.white : colors.ink} /> : null}
      <Text style={[styles.pillText, active && styles.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

function voiceLabel(phase: VoicePhase) {
  if (phase === 'recording') return 'Recording…';
  if (phase === 'transcribing') return 'Transcribing…';
  if (phase === 'ready') return 'Ready for review.';
  if (phase === 'failed') return 'Transcription didn’t complete.';
  return '';
}

function normalizeRecap(recap: SessionRecap): SessionRecap {
  const transcript = recapTranscript(recap);
  return {
    ...recap,
    transcript,
    originalText: transcript,
    message: canonicalRecapText(recap),
    delivery: recap.delivery ?? 'now',
  };
}

function blankRecap(eventId: string): SessionRecap {
  return {
    id: `recap-${eventId}`,
    eventId,
    teamId: COACH_TEAM_ID,
    coachName: ACTIVE_COACH.displayName,
    originalText: '',
    transcript: '',
    message: '',
    polishedText: '',
    delivery: 'now',
    polishMode: null,
    notes: [],
    status: 'draft',
    recipientCount: 0,
    updatedAt: '2026-09-20T12:05:00-04:00',
  };
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: colors.cream },
  grow: { flex: 1, minWidth: 0 },
  screen: { paddingBottom: 48 },
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  kicker: { color: colors.inkSoft, fontSize: 11, ...typography.label, letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 32, marginTop: 4, ...typography.display },
  when: { color: colors.stone, fontSize: 14, marginTop: 4, ...typography.body },
  audience: { marginTop: 14, padding: 14, borderRadius: 22, backgroundColor: colors.paper, gap: 10 },
  audienceTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  audienceIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  audienceSub: { color: colors.stone, fontSize: 12, lineHeight: 17, marginTop: 1, ...typography.body },
  counts: { color: colors.ink, fontSize: 15, lineHeight: 20, ...typography.heading },
  banner: { marginTop: spacing.md, color: colors.warning, ...typography.body },
  savedPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saved: { color: colors.stone, fontSize: 12, ...typography.body },
  phase: { marginTop: spacing.lg, gap: 12 },
  phaseTitle: { color: colors.ink, fontSize: 20, ...typography.heading },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  sectionNote: { color: colors.stone, fontSize: 12, ...typography.label },
  hint: { color: colors.stone, fontSize: 14, lineHeight: 20, ...typography.body },
  hintSmall: { color: colors.stone, fontSize: 12, lineHeight: 17, ...typography.body },
  editor: { borderRadius: 22, backgroundColor: colors.paper, overflow: 'hidden' },
  composer: {
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    ...typography.body,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  polishBox: { gap: 8, paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  pill: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.mint },
  pillOn: { backgroundColor: colors.ink },
  pillOff: { opacity: 0.45 },
  pillText: { color: colors.ink, fontSize: 13, ...typography.label },
  pillTextOn: { color: colors.white },
  rowCard: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: colors.paper },
  advanced: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advancedLabel: { color: colors.ink, fontSize: 15, flex: 1, paddingRight: spacing.md, ...typography.heading },
  gap: { gap: spacing.sm },
  mode: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  modeOn: { borderColor: colors.ink, backgroundColor: colors.mint },
  modeOff: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  modeCopy: { flex: 1 },
  modeLabel: { color: colors.ink, fontSize: 16, ...typography.heading },
  modeHint: { color: colors.stone, fontSize: 13, marginTop: 2, ...typography.body },
  polished: { color: colors.charcoal, fontSize: 16, lineHeight: 24, ...typography.body },
  sourceLabel: { color: colors.stone, fontSize: 13, ...typography.body },
  subkicker: { color: colors.inkSoft, fontSize: 10, marginTop: spacing.md, ...typography.label, letterSpacing: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  childRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  childName: { color: colors.ink, fontSize: 16, ...typography.heading },
  childMeta: { color: colors.stone, fontSize: 12, maxWidth: '48%', textAlign: 'right', ...typography.body },
  notePad: { paddingVertical: spacing.md, gap: spacing.md },
  noteInput: {
    minHeight: 72,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    padding: spacing.md,
    color: colors.ink,
    fontSize: 15,
    ...typography.body,
  },
  search: {
    minHeight: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    ...typography.body,
  },
  preview: { gap: spacing.sm, paddingVertical: spacing.md },
  previewBody: { color: colors.ink, fontSize: 16, lineHeight: 24, ...typography.body },
  meta: { color: colors.stone, fontSize: 13, ...typography.body },
  error: { color: colors.danger, fontSize: 14, ...typography.body },
  link: { color: colors.orangeDark, fontSize: 13, ...typography.label },
});
