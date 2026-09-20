import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Person } from '@/types/domain';

export const REGISTRATION_DRAFT_KEY = '@royals/registration-draft/v1';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type RegistrationDraftStep =
  | 'overview'
  | 'household'
  | 'children'
  | 'consent'
  | 'review'
  | 'payment';

export type RegistrationDraft = {
  identityKey: string;
  programId: string;
  step: RegistrationDraftStep;
  lens: 'chooser' | 'guest' | 'demo' | 'account';
  selected: string[];
  localChildren: Person[];
  form: {
    guardianName: string;
    email: string;
    phone: string;
    address: string;
    parentConsent: boolean;
    emergencyConsent: boolean;
    signature: string;
  };
  editHousehold: boolean;
  showAddChild: boolean;
  newChild: { firstName: string; lastName: string; dateOfBirth: string };
  savedAt: string;
  expiresAt: string;
};

export function registrationIdentityKey(input: {
  persona: 'visitor' | 'demo';
  role: string;
  householdId: string;
  email?: string;
}) {
  if (input.persona === 'demo') return `demo:${input.householdId}`;
  if (input.role === 'guest') return 'guest';
  return `account:${input.householdId}:${input.email || 'local'}`;
}

export async function loadRegistrationDraft(programId: string, identityKey: string) {
  const raw = await AsyncStorage.getItem(REGISTRATION_DRAFT_KEY);
  if (!raw) return null;
  const draft = JSON.parse(raw) as RegistrationDraft;
  if (draft.programId !== programId) return null;
  if (draft.identityKey !== identityKey) return null;
  if (new Date(draft.expiresAt).getTime() <= Date.now()) {
    await AsyncStorage.removeItem(REGISTRATION_DRAFT_KEY);
    return null;
  }
  return draft;
}

export async function saveRegistrationDraft(draft: Omit<RegistrationDraft, 'savedAt' | 'expiresAt'>) {
  const savedAt = new Date().toISOString();
  const payload: RegistrationDraft = {
    ...draft,
    savedAt,
    expiresAt: new Date(Date.now() + DRAFT_TTL_MS).toISOString(),
  };
  await AsyncStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(payload));
  return payload;
}

export async function clearRegistrationDraft() {
  await AsyncStorage.removeItem(REGISTRATION_DRAFT_KEY);
}
