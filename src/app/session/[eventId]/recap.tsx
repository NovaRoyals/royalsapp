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
  attendanceCounts,
  noteDraftFromTags,
  noteKind,
  recapBody,
  recapForEvent,
} from '@/lib/coachRecap';
import { formatEventWhen } from '@/lib/datetime';
import { COACH_TEAM_ID } from '@/lib/membership';
import { safeBack } from '@/lib/nav';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import type { CoachNoteTag, IndividualCoachNote, SessionRecap } from '@/types/domain';

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
  const counts = attendanceCounts(roster, event.checkIns ?? []);
  const canDraft = canCreateSessionRecap(role, event.teamId);
  const canSend = canSendSessionRecap(role, managerCanSendRecap);
  const canView = canDraft || can(role, 'view_recap_status');

  const [draft, setDraft] = useState<SessionRecap>(() => stored ?? blankRecap(event.id));
  const [eventKey, setEventKey] = useState(event.id);
  const [phase, setPhase] = useState<Phase>(stored?.status === 'sent' ? 'receipt' : 'compose');
  const [recording, setRecording] = useState(false);
  const [polishOpen, setPolishOpen] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteChildId, setNoteChildId] = useState<string | null>(stored?.notes[0]?.childId ?? null);
  const [previewChild, setPreviewChild] = useState(counts.present[0]?.id ?? '');
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
    setDraft(stored ?? blankRecap(event.id));
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
    setRecording(true);
    setTimeout(() => {
      persist({ ...draft, originalText: MOCK_VOICE_TRANSCRIPT, polishedText: draft.polishedText && draft.originalText ? draft.polishedText : '' });
      setRecording(false);
      toast('Transcription ready — edit anything that sounds off');
    }, 900);
  };

  const polish = async (mode: RecapPolishMode) => {
    setPolishing(true);
    setPolishError('');
    try {
      const result = await getCoachPolishProvider().polish({
        original: draft.originalText,
        mode,
        sessionLabel: event.title,
      });
      persist({ ...draft, polishedText: result.text, polishMode: mode });
      toast(mode === 'verbatim' ? 'Kept as spoken' : 'Draft polished — restore original anytime');
    } catch {
      setPolishError('Could not polish right now. Your original words are still here.');
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
    const approved: SessionRecap = {
      ...draft,
      coachName: ACTIVE_COACH.displayName,
      recipientCount: counts.presentCount,
      notes: draft.notes.map((note) => ({ ...note, approvedText: noteDraftFromTags(note.tags, note.originalText) })),
    };
    const result = sendSessionRecap(approved);
    if (!result.ok) {
      setSendError(result.error ?? 'Could not send.');
      return;
    }
    setDraft({ ...approved, status: 'sent', sentAt: new Date().toISOString(), deliveryStatus: 'delivered' });
    setPhase('receipt');
  };

  const display = recapBody(draft);
  const activeNote = draft.notes.find((note) => note.childId === noteChildId);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={styles.screen}>
        <Topbar />
        <Text style={styles.kicker}>U8 · SUNDAY</Text>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.when}>{formatEventWhen(event.startsAt)}</Text>
        <Text style={styles.counts}>
          {counts.presentCount} present · {counts.absentCount} absent
        </Text>

        {offline ? <Text style={styles.banner}>Offline — drafts save on this device.</Text> : null}
        {savedAt && draft.status !== 'sent' ? <Text style={styles.saved}>Draft saved</Text> : null}

        {view === 'receipt' && draft.status === 'sent' ? (
          <Receipt recap={draft} />
        ) : view === 'preview' ? (
          <View style={styles.phase}>
            <Text style={styles.phaseTitle}>Parent view</Text>
            <Text style={styles.hint}>Families only see the shared recap plus a note if you wrote one for their child.</Text>
            <View style={styles.wrap}>
              {counts.present.slice(0, 8).map((person) => (
                <Chip key={person.id} label={person.firstName} active={previewChild === person.id} onPress={() => setPreviewChild(person.id)} />
              ))}
            </View>
            <ParentPreview recap={draft} childId={previewChild} sessionTitle={event.title} when={formatEventWhen(event.startsAt)} />
            {sendError ? <Text style={styles.error}>{sendError}</Text> : null}
            <Button label="Approve and send" onPress={onSend} disabled={!canSend || !display} />
            <Button label="Keep editing" variant="ghost" onPress={() => setPhase('compose')} />
          </View>
        ) : (
          <View style={styles.phase}>
            {!draft.originalText ? (
              <>
                <Text style={styles.phaseTitle}>Shared recap</Text>
                <Text style={styles.hint}>One note for every attending family. Names stay out of this message.</Text>
                <Button
                  label={recording ? 'Listening…' : 'Record session recap'}
                  icon="mic-outline"
                  loading={recording}
                  onPress={recordVoice}
                  disabled={!canDraft}
                />
              </>
            ) : (
              <>
                <Text style={styles.phaseTitle}>Shared recap</Text>
                <TextInput
                  accessibilityLabel="Session recap"
                  multiline
                  value={draft.originalText}
                  editable={canDraft && draft.status !== 'sent'}
                  onChangeText={(originalText) => persist({ ...draft, originalText })}
                  style={styles.composer}
                  textAlignVertical="top"
                />
                <Button
                  label={recording ? 'Listening…' : 'Re-record (demo)'}
                  variant="ghost"
                  onPress={recordVoice}
                  disabled={!canDraft}
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
                    <Text style={styles.subkicker}>
                      {draft.polishedText && draft.polishMode && draft.polishMode !== 'verbatim'
                        ? 'AI-POLISHED DRAFT'
                        : 'ORIGINAL TRANSCRIPTION'}
                    </Text>
                    <Text selectable style={styles.polished}>
                      {draft.polishedText && draft.polishMode && draft.polishMode !== 'verbatim'
                        ? draft.polishedText
                        : draft.originalText}
                    </Text>
                    {draft.polishedText ? (
                      <Button label="Restore original" variant="ghost" onPress={() => persist({ ...draft, polishedText: '', polishMode: null })} />
                    ) : null}
                  </View>
                ) : draft.polishedText ? (
                  <Text style={styles.sourceLabel}>
                    {draft.polishMode && draft.polishMode !== 'verbatim' ? 'Using AI-polished draft' : 'Using original transcription'}
                  </Text>
                ) : (
                  <Text style={styles.sourceLabel}>Using original transcription</Text>
                )}
              </>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: notesOpen }}
              accessibilityLabel="Optional notes for individual children"
              onPress={() => setNotesOpen((open) => !open)}
              style={({ pressed }) => [styles.advanced, pressed && styles.pressed]}
            >
              <Text style={styles.advancedLabel}>Optional notes for individual children</Text>
              <Ionicons name={notesOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.stone} />
            </Pressable>
            {notesOpen ? (
              <View style={styles.gap}>
                <Text style={styles.hint}>Tags draft a line from what you pick. Nothing else is invented.</Text>
                {counts.present.map((person) => {
                  const note = draft.notes.find((item) => item.childId === person.id);
                  const open = noteChildId === person.id;
                  return (
                    <View key={person.id}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        accessibilityLabel={`${person.displayName}. ${note ? 'Edit note' : 'Add note'}`}
                        onPress={() => setNoteChildId(open ? null : person.id)}
                        style={({ pressed }) => [styles.childRow, pressed && styles.pressed]}
                      >
                        <Text style={styles.childName}>{person.displayName}</Text>
                        <Text style={styles.childMeta}>{note ? noteDraftFromTags(note.tags, note.originalText) || 'Note' : 'Add'}</Text>
                      </Pressable>
                      {open ? (
                        <View style={styles.notePad}>
                          <View style={styles.wrap}>
                            {NOTE_TAGS.map((tag) => (
                              <Chip
                                key={tag.id}
                                label={tag.label}
                                active={activeNote?.tags.includes(tag.id)}
                                onPress={() => toggleTag(person.id, tag.id)}
                              />
                            ))}
                          </View>
                          <TextInput
                            accessibilityLabel={`Note for ${person.firstName}`}
                            placeholder="Short dictated or typed note"
                            placeholderTextColor={colors.stone}
                            value={activeNote?.originalText ?? ''}
                            onChangeText={(originalText) => upsertNote(person.id, { originalText })}
                            style={styles.noteInput}
                            multiline
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
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
                persist({ ...draft, recipientCount: counts.presentCount });
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
  sessionTitle,
  when,
}: {
  recap: SessionRecap;
  childId: string;
  sessionTitle: string;
  when: string;
}) {
  const note = recap.notes.find((item) => item.childId === childId);
  const noteText = note ? noteDraftFromTags(note.tags, note.originalText) : '';
  const kind = note ? noteKind(note.tags) : null;
  return (
    <View style={styles.preview}>
      <Text style={styles.subkicker}>{KIND_LABEL.session_recap.toUpperCase()}</Text>
      <Text style={styles.previewBody}>{recapBody(recap)}</Text>
      {noteText ? (
        <>
          <Text style={styles.subkicker}>{KIND_LABEL[kind ?? 'private_note'].toUpperCase()} · {note?.childFirstName}</Text>
          <Text style={styles.previewBody}>{noteText}</Text>
        </>
      ) : (
        <Text style={styles.hint}>No private note for this child.</Text>
      )}
      <Text style={styles.meta}>Sent by {ACTIVE_COACH.displayName} · {sessionTitle} · {when}</Text>
    </View>
  );
}

function Receipt({ recap }: { recap: SessionRecap }) {
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseTitle}>Sent</Text>
      <Text style={styles.counts}>{recap.recipientCount} families · {recap.deliveryStatus ?? 'delivered'}</Text>
      <Text style={styles.hint}>
        {recap.sentAt ? formatEventWhen(recap.sentAt) : ''} · Shared recap
        {recap.notes.length ? ` plus ${recap.notes.length} individual note${recap.notes.length === 1 ? '' : 's'}` : ''}
      </Text>
      <Text selectable style={styles.polished}>
        {recapBody(recap)}
      </Text>
      <Button label="Done" onPress={() => router.replace(`/event/${recap.eventId}`)} />
    </View>
  );
}

function blankRecap(eventId: string): SessionRecap {
  return {
    id: `recap-${eventId}`,
    eventId,
    teamId: COACH_TEAM_ID,
    coachName: ACTIVE_COACH.displayName,
    originalText: '',
    polishedText: '',
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
});
