/**
 * What a saved registration draft is allowed to keep.
 *
 * A draft sits in plain device storage (localStorage on the web, shared by anyone using that
 * browser). Names, contact details and the child's profile are what make coming back later
 * painless, so those stay. Consent is different: a waiver and a typed signature are a
 * legal act that should happen once, at the moment of submitting, by the person submitting.
 * They are never written to the draft and never restored from one.
 */
export type DraftForm = {
  guardianName: string;
  email: string;
  phone: string;
  address: string;
  parentConsent: boolean;
  emergencyConsent: boolean;
  signature: string;
};

export function redactDraftForm(form: DraftForm): DraftForm {
  return { ...form, parentConsent: false, emergencyConsent: false, signature: '' };
}
