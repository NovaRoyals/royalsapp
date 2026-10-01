import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { can, canCreateSessionRecap, canSendSessionRecap } from '@/lib/capabilities';
import {
  ACTIVE_COACH,
  KIND_LABEL,
  MOCK_VOICE_TRANSCRIPT,
  NOTE_TAGS,
  canonicalRecapText,
  deliveryChoiceLabel,
  deliveryClockLabel,
  deliveryMoment,
  noteDraftFromTags,
  noteKind,
  recapAudience,
  recapForEvent,
  recapTranscript,
  sessionIdentity,
} from '@/lib/coachRecap';
import { formatEventWhen } from '@/lib/datetime';
import { COACH_TEAM_ID } from '@/lib/membership';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { CoachNoteTag, IndividualCoachNote, RecapDelivery, SessionRecap } from '@/types/domain';

type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'ready' | 'failed';

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
  const [polishOpen, setPolishOpen] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteChildId, setNoteChildId] = useState<string | null>(stored?.notes[0]?.childId ?? null);
  const [previewChild, setPreviewChild] = useState(audience.recipients[0]?.id ?? audience.present[0]?.id ?? '');
  const [showTranscript, setShowTranscript] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
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
      setVoicePhase('failed');
      return;
    }
    setVoicePhase('recording');
    const snapshot = draft;
    setTimeout(() => setVoicePhase('transcribing'), 600);
    setTimeout(() => {
      const transcript = MOCK_VOICE_TRANSCRIPT;
      const editor = canonicalRecapText(snapshot);
      const previousTranscript = recapTranscript(snapshot);
      const keepEditor = editor && editor !== previousTranscript;
      persist({
        ...snapshot,
        transcript,
        originalText: transcript,
        message: keepEditor ? editor : transcript,
      });
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
      });
      if (!result.text.trim()) throw new Error('empty');
      persist({
        ...draft,
        transcript,
        originalText: transcript,
        message: result.text,
        polishedText: result.text,
        polishMode: mode,
      });
      toast(mode === 'verbatim' ? 'Kept as written' : 'Polished text is now in the editor');
    } catch {
      setPolishError('Could not polish right now. The text in the editor is unchanged.');
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
    if (audience.unrecordedCount) {
      setSendError('Attendance is still open. Not recorded is not the same as absent, and sending stays off until every player is marked.');
      return;
    }
    if (!audience.recipients.length) {
      setSendError('Record attendance first. Recaps go only to families of children marked present.');
      return;
    }
    if (!canonicalRecapText(draft)) {
      setSendError('Write the shared recap before sending.');
      return;
    }
    const delivery = draft.delivery ?? 'now';
    const scheduledFor = delivery === 'now' ? undefined : deliveryMoment(event, delivery);
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
    const now = new Date().toISOString();
    setDraft({
      ...approved,
      status: 'sent',
      sentAt: delivery === 'now' ? now : undefined,
      scheduledFor: delivery === 'now' ? undefined : scheduledFor,
      deliveryStatus: delivery === 'now' ? 'delivered' : 'queued',
    });
    setPhase('receipt');
  };

  const display = canonicalRecapText(draft);
  const delivery = draft.delivery ?? 'now';
  const deliveryWhen = deliveryMoment(event, delivery);
  const familyWord = audience.recipients.length === 1 ? 'family' : 'families';
  const sendLabel = delivery === 'now'
    ? `Send to ${audience.recipients.length} ${familyWord} now`
    : `Schedule for ${deliveryClockLabel(deliveryWhen)}`;
  const canApprove = canSend && Boolean(display) && !audience.unrecordedCount && audience.recipients.length > 0;
  const notedChildren = audience.present.filter((person) => {
    const note = draft.notes.find((item) => item.childId === person.id);
    return Boolean(note && (note.tags.length || note.originalText.trim()));
  });
  const unnamedChildren = audience.present.filter((person) => !notedChildren.some((item) => item.id === person.id));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={styles.screen}>
        <Topbar />
        <Text style={styles.kicker}>{identity.kicker}</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.when}>{identity.when}</Text>
        <Text style={styles.counts}>
          Sending to families of {audience.recipients.length} attending {audience.recipients.length === 1 ? 'player' : 'players'}
        </Text>
        <Text style={styles.hint}>
          {audience.presentCount} present · {audience.absentCount} absent
          {audience.unrecordedCount ? ` · ${audience.unrecordedCount} not recorded` : ''}
        </Text>
        <Pressable accessibilityRole="link" accessibilityLabel="Review attendance" onPress={() => router.push(`/event/${event.id}` as never)}>
          <Text style={styles.link}>Review attendance</Text>
        </Pressable>
        {audience.unrecordedCount ? (
          <Text style={styles.error}>Attendance is still open for {audience.unrecordedCount} {audience.unrecordedCount === 1 ? 'player' : 'players'}. Sending stays off until everyone is marked. Not recorded is not the same as absent.</Text>
        ) : null}
        {audience.missingContact.length ? (
          <Text style={styles.error}>
            No linked parent contact: {audience.missingContact.map((person) => person.firstName).join(', ')}. {audience.missingContact.length === 1 ? 'That family is' : 'Those families are'} not included in the {audience.recipients.length}.
          </Text>
        ) : null}

        {offline ? <Text style={styles.banner}>Offline — drafts save on this device.</Text> : null}
        {savedAt && draft.status !== 'sent' ? <Text style={styles.saved}>Draft saved</Text> : null}

        {view === 'receipt' && draft.status === 'sent' ? (
          <Receipt recap={draft} identity={identity.kicker} />
        ) : view === 'preview' ? (
          <View style={styles.phase}>
            <Text style={styles.phaseTitle}>Parent view</Text>
            <Text style={styles.hint}>This is exactly what families will receive, plus a private note only if you wrote one for their child.</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Delivery" style={styles.gap}>
              {(['now', 'after_session', 'tonight'] as RecapDelivery[]).map((choice) => {
                const when = deliveryMoment(event, choice);
                const selected = delivery === choice;
                return (
                  <Pressable
                    key={choice}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${deliveryChoiceLabel(choice)}, ${formatEventWhen(when)}`}
                    onPress={() => persist({ ...draft, delivery: choice, scheduledFor: choice === 'now' ? undefined : when })}
                    style={({ pressed }) => [styles.mode, selected && styles.modeOn, pressed && styles.pressed]}
                  >
                    <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.ink : colors.stone} />
                    <View style={styles.modeCopy}>
                      <Text style={styles.modeLabel}>{deliveryChoiceLabel(choice)}</Text>
                      <Text style={styles.modeHint}>{formatEventWhen(when)}</Text>
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
              deliveryWhen={formatEventWhen(deliveryWhen)}
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
            <Text style={styles.phaseTitle}>Shared recap</Text>
            <Text style={styles.hint}>Demo only. No microphone audio is captured. {voiceLabel(voicePhase)}</Text>
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
              <>
                <Text style={styles.hint}>This is exactly what families will receive.</Text>
                <TextInput
                  accessibilityLabel="Session recap"
                  multiline
                  value={display}
                  editable={canDraft && draft.status !== 'sent'}
                  onChangeText={(message) => persist({ ...draft, message })}
                  style={styles.composer}
                  textAlignVertical="top"
                />
                <Button
                  label={voicePhase === 'recording' || voicePhase === 'transcribing' ? voiceLabel(voicePhase) : 'Record again'}
                  variant="ghost"
                  onPress={recordVoice}
                  disabled={!canDraft || voicePhase === 'recording' || voicePhase === 'transcribing'}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: polishOpen }}
                  accessibilityLabel="Polish with AI"
                  onPress={() => setPolishOpen((open) => !open)}
                  style={({ pressed }) => [styles.advanced, pressed && styles.pressed]}
                >
                  <Text style={styles.advancedLabel}>Polish with AI</Text>
                  <Ionicons name={polishOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.stone} />
                </Pressable>
                {polishOpen ? (
                  <View accessibilityRole="radiogroup" accessibilityLabel="AI transformation" style={styles.gap}>
                    <Text style={styles.hint}>Rewrites your words. It will not add drills, scores, or named children.</Text>
                    {POLISH_MODES.map((mode) => {
                      const selected = draft.polishMode === mode.id && Boolean(draft.polishedText);
                      return (
                        <Pressable
                          key={mode.id}
                          accessibilityRole="radio"
                          accessibilityState={{ selected, disabled: !canDraft || polishing }}
                          accessibilityLabel={mode.label}
                          disabled={!canDraft || polishing}
                          onPress={() => polish(mode.id)}
                          style={({ pressed }) => [styles.mode, selected && styles.modeOn, pressed && styles.pressed]}
                        >
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={22}
                            color={selected ? colors.ink : colors.stone}
                          />
                          <View style={styles.modeCopy}>
                            <Text style={styles.modeLabel}>{mode.label}</Text>
                            <Text style={styles.modeHint}>{mode.hint}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    {polishing ? <Text style={styles.hint}>Polishing…</Text> : null}
                    {polishError ? <Text style={styles.error}>{polishError}</Text> : null}
                  </View>
                ) : null}
                {recapTranscript(draft) && recapTranscript(draft) !== display ? (
                  <>
                    <Button
                      label={showTranscript ? 'Hide original transcript' : 'View original transcript'}
                      variant="ghost"
                      onPress={() => setShowTranscript((open) => !open)}
                    />
                    {showTranscript ? <Text selectable style={styles.polished}>{recapTranscript(draft)}</Text> : null}
                    <Button
                      label="Restore original"
                      variant="ghost"
                      onPress={() => persist({ ...draft, message: recapTranscript(draft), polishedText: '', polishMode: null })}
                    />
                  </>
                ) : null}
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: notesOpen }}
              accessibilityLabel="Add individual notes, optional"
              onPress={() => setNotesOpen((open) => !open)}
              style={({ pressed }) => [styles.advanced, pressed && styles.pressed]}
            >
              <Text style={styles.advancedLabel}>Add individual notes — optional</Text>
              <Ionicons accessible={false} importantForAccessibility="no" name={notesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.stone} />
            </Pressable>
            {notesOpen ? (
              <View style={styles.gap}>
                <Text style={styles.hint}>Add notes only where something specific is worth sharing. The shared recap goes to everyone who attended.</Text>
                <Text style={styles.sourceLabel}>
                  {notedChildren.length} of {audience.present.length} children have notes.
                </Text>
                {notedChildren.map((person) => (
                  <NoteEditorRow
                    key={person.id}
                    person={person}
                    note={draft.notes.find((item) => item.childId === person.id)}
                    open={noteChildId === person.id}
                    onToggle={() => setNoteChildId(noteChildId === person.id ? null : person.id)}
                    onToggleTag={(tag) => toggleTag(person.id, tag)}
                    onText={(originalText) => upsertNote(person.id, { originalText })}
                  />
                ))}
                <Button label="Add another attendee" variant="ghost" onPress={() => setAddingNote((open) => !open)} />
                {addingNote ? (
                  <View style={styles.wrap}>
                    {unnamedChildren.map((person) => (
                      <Chip
                        key={person.id}
                        label={person.firstName}
                        onPress={() => {
                          setNoteChildId(person.id);
                          setAddingNote(false);
                          setNotesOpen(true);
                        }}
                      />
                    ))}
                  </View>
                ) : null}
                {noteChildId && !notedChildren.some((person) => person.id === noteChildId) ? (
                  <NoteEditorRow
                    person={audience.present.find((person) => person.id === noteChildId)!}
                    note={draft.notes.find((item) => item.childId === noteChildId)}
                    open
                    onToggle={() => setNoteChildId(null)}
                    onToggleTag={(tag) => toggleTag(noteChildId, tag)}
                    onText={(originalText) => upsertNote(noteChildId, { originalText })}
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
      <View style={styles.back} />
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
          ? `Scheduled for ${formatEventWhen(recap.scheduledFor!)}`
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
  open,
  onToggle,
  onToggleTag,
  onText,
}: {
  person: { id: string; firstName: string; displayName: string };
  note?: IndividualCoachNote;
  open: boolean;
  onToggle: () => void;
  onToggleTag: (tag: CoachNoteTag) => void;
  onText: (value: string) => void;
}) {
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
        <Text style={styles.childMeta}>{note ? noteDraftFromTags(note.tags, note.originalText) || 'Note' : 'Add'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.notePad}>
          <View style={styles.wrap}>
            {NOTE_TAGS.map((tag) => (
              <Chip key={tag.id} label={tag.label} active={note?.tags.includes(tag.id)} onPress={() => onToggleTag(tag.id)} />
            ))}
          </View>
          <TextInput
            accessibilityLabel={`Note for ${person.firstName}`}
            placeholder="Short dictated or typed note"
            placeholderTextColor={colors.stone}
            value={note?.originalText ?? ''}
            onChangeText={onText}
            style={styles.noteInput}
            multiline
          />
        </View>
      ) : null}
    </View>
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
  flex: { flex: 1, backgroundColor: colors.cream },
  screen: { paddingBottom: 48 },
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.ink, fontSize: 15, ...typography.heading },
  kicker: { color: colors.inkSoft, fontSize: 11, marginTop: spacing.lg, ...typography.label, letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 36, marginTop: spacing.sm, ...typography.display },
  when: { color: colors.stone, fontSize: 14, marginTop: spacing.sm, ...typography.body },
  counts: { color: colors.ink, fontSize: 16, marginTop: spacing.md, ...typography.heading },
  banner: { marginTop: spacing.md, color: colors.warning, ...typography.body },
  saved: { marginTop: spacing.sm, color: colors.stone, fontSize: 12, ...typography.body },
  phase: { marginTop: spacing.xxl, gap: spacing.md },
  phaseTitle: { color: colors.ink, fontSize: 22, ...typography.heading },
  hint: { color: colors.stone, fontSize: 14, lineHeight: 20, ...typography.body },
  composer: {
    minHeight: 160,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    padding: spacing.lg,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    ...typography.body,
  },
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
  preview: { gap: spacing.sm, paddingVertical: spacing.md },
  previewBody: { color: colors.ink, fontSize: 16, lineHeight: 24, ...typography.body },
  meta: { color: colors.stone, fontSize: 13, ...typography.body },
  error: { color: colors.danger, fontSize: 14, ...typography.body },
  link: { color: colors.orangeDark, fontSize: 14, marginTop: spacing.sm, ...typography.label },
});
