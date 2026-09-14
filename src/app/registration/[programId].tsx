import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Field, Screen, StatusPill } from '@/components/ui';
import { demoPrograms, kidsProgramId } from '@/data/demo';
import { useApp } from '@/state/AppProvider';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return demoPrograms.map((item) => ({ programId: item.id }));
}

const youthSchema = z.object({
  guardianName: z.string().min(2, 'Enter the parent or guardian name'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  address: z.string().min(4, 'Enter a home address'),
  parentConsent: z.boolean().refine(Boolean, 'Required'),
  emergencyConsent: z.boolean().refine(Boolean, 'Required'),
  signature: z.string().min(2, 'Type your full legal name'),
});

type YouthForm = z.infer<typeof youthSchema>;
type Step = 'overview' | 'household' | 'children' | 'consent' | 'review' | 'payment' | 'confirmation';

const steps: { id: Step; label: string }[] = [
  { id: 'overview', label: 'Program' },
  { id: 'household', label: 'Household' },
  { id: 'children', label: 'Children' },
  { id: 'consent', label: 'Consent' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Status' },
];

export default function RegistrationScreen() {
  const { programId } = useLocalSearchParams<{ programId: string }>();
  const program = demoPrograms.find((item) => item.id === programId) ?? demoPrograms[0];
  const { household, addChild, submitRegistration } = useApp();
  const isYouth = program.id === kidsProgramId || program.id === 'travel-soccer';
  const [step, setStep] = useState<Step>('overview');
  const [selected, setSelected] = useState<string[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChild, setNewChild] = useState({ firstName: '', lastName: '', dateOfBirth: '' });
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const form = useForm<YouthForm>({
    resolver: zodResolver(youthSchema),
    defaultValues: {
      guardianName: household.guardianName,
      email: household.email,
      phone: household.phone,
      address: household.address,
      parentConsent: false,
      emergencyConsent: false,
      signature: '',
    },
  });

  const selectedChildren = useMemo(
    () => household.children.filter((child) => selected.includes(child.id)),
    [household.children, selected],
  );
  const subtotal = selectedChildren.length > 0 ? 120 + Math.max(0, selectedChildren.length - 1) * 60 : 0;
  const standardPrice = selectedChildren.length * 120;
  const discount = standardPrice - subtotal;
  const activeStepIndex = steps.findIndex((item) => item.id === step);

  if (!isYouth) {
    return <AdultRegistration programId={program.id} title={program.title} />;
  }

  const goNext = async () => {
    if (step === 'overview') setStep('household');
    if (step === 'household') {
      const valid = await form.trigger(['guardianName', 'email', 'phone', 'address']);
      if (valid) setStep('children');
    }
    if (step === 'children' && selected.length > 0) setStep('consent');
    if (step === 'consent') {
      const valid = await form.trigger(['parentConsent', 'emergencyConsent', 'signature']);
      if (valid) setStep('review');
    }
    if (step === 'review') setStep('payment');
    if (step === 'payment') {
      const registration = submitRegistration({
        programId: program.id,
        participantIds: selectedChildren.map((child) => child.id),
        participantNames: selectedChildren.map((child) => `${child.firstName} ${child.lastName}`),
        status: 'pending',
        amountDue: subtotal,
        discountAmount: discount,
        paymentStatus: 'pending',
      });
      setSubmittedId(registration.id);
      setStep('confirmation');
    }
  };

  const goBack = () => {
    if (step === 'overview') return router.back();
    const previous = steps[Math.max(0, activeStepIndex - 1)];
    setStep(previous.id);
  };

  const toggleChild = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const saveChild = () => {
    if (!newChild.firstName.trim() || !newChild.lastName.trim() || !newChild.dateOfBirth.trim()) return;
    const created = addChild(newChild);
    setSelected((current) => [...current, created.id]);
    setNewChild({ firstName: '', lastName: '', dateOfBirth: '' });
    setShowAddChild(false);
  };

  if (step === 'confirmation') {
    return (
      <Screen contentStyle={styles.confirmationPage}>
        <View style={styles.confirmIcon}><Ionicons name="checkmark" size={44} color={colors.white} /></View>
        <StatusPill label="Submitted · Demo checkout" tone="success" />
        <Text style={styles.confirmTitle}>Welcome to the{'\n'}Royals family.</Text>
        <Text style={styles.confirmCopy}>
          We received {selectedChildren.length === 1 ? `${selectedChildren[0].firstName}’s` : 'your children’s'} registration for {program.title}.
        </Text>
        <View style={styles.confirmCard}>
          <SummaryRow label="Registration" value={submittedId?.slice(-8).toUpperCase() ?? 'DEMO'} />
          <SummaryRow label="Participants" value={selectedChildren.map((child) => child.firstName).join(', ')} />
          <SummaryRow label="Amount due" value={`$${subtotal}`} />
          <SummaryRow label="Status" value="Pending review" last />
        </View>
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={21} color={colors.info} />
          <Text style={styles.noticeText}>No real payment was processed. Your demo registration is saved on this device.</Text>
        </View>
        <Button label="Go to my profile" onPress={() => router.replace('/(tabs)/profile')} style={styles.fullButton} />
        <Button label="View schedule" variant="secondary" onPress={() => router.replace('/(tabs)/schedule')} style={styles.fullButton} />
      </Screen>
    );
  }

  return (
    <Screen scrollKey={step}>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.topEyebrow}>REGISTRATION</Text>
          <Text numberOfLines={1} style={styles.topTitle}>{program.title}</Text>
        </View>
        <Text style={styles.stepCount}>{activeStepIndex + 1}/{steps.length}</Text>
      </View>

      <View style={styles.progress}>
        {steps.map((item, index) => (
          <View key={item.id} style={[styles.progressSegment, index <= activeStepIndex && styles.progressActive]} />
        ))}
      </View>
      <Text style={styles.currentLabel}>{steps[activeStepIndex]?.label}</Text>

      {step === 'overview' && (
        <View style={styles.step}>
          <StatusPill label="Registration open" tone="orange" />
          <Text style={styles.stepTitle}>Let’s get your family on the field.</Text>
          <Text style={styles.stepBody}>Your household details and child profiles are securely reusable next season—no starting over.</Text>
          <View style={styles.programCard}>
            <SummaryRow label="Program" value={program.title} />
            <SummaryRow label="Ages" value="3–16" />
            <SummaryRow label="Dates" value="Sep 13 – Nov 22" />
            <SummaryRow label="Sessions" value="12 Sundays" />
            <SummaryRow label="Price" value="$120 first · $60 siblings" last />
          </View>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.success} />
            <Text style={styles.trustText}>Children’s information is private and visible only to authorized guardians and staff.</Text>
          </View>
        </View>
      )}

      {step === 'household' && (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>Parent & household</Text>
          <Text style={styles.stepBody}>We prefilled your saved account information. Update anything that has changed.</Text>
          <Controller control={form.control} name="guardianName" render={({ field, fieldState }) => (
            <Field label="Parent / guardian name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoCapitalize="words" />
          )} />
          <Controller control={form.control} name="email" render={({ field, fieldState }) => (
            <Field label="Guardian email" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} keyboardType="email-address" autoCapitalize="none" />
          )} />
          <Controller control={form.control} name="phone" render={({ field, fieldState }) => (
            <Field label="Guardian phone" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} keyboardType="phone-pad" />
          )} />
          <Controller control={form.control} name="address" render={({ field, fieldState }) => (
            <Field label="Home address" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoCapitalize="words" hint="Used only for registration administration." />
          )} />
        </View>
      )}

      {step === 'children' && (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>Who’s playing?</Text>
          <Text style={styles.stepBody}>Select saved children or add a new profile. The sibling rate updates automatically.</Text>
          <View style={styles.childList}>
            {household.children.map((child, index) => {
              const checked = selected.includes(child.id);
              return (
                <Pressable key={child.id} onPress={() => toggleChild(child.id)} style={[styles.childChoice, checked && styles.childSelected]}>
                  <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                    {checked ? <Ionicons name="checkmark" size={17} color={colors.white} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.childName}>{child.firstName} {child.lastName}</Text>
                    <Text style={styles.childMeta}>Saved child profile · Birth date private</Text>
                  </View>
                  <Text style={styles.childPrice}>{selected.indexOf(child.id) > 0 ? '$60' : checked ? '$120' : index === 0 ? '$120' : '$60+'}</Text>
                </Pressable>
              );
            })}
          </View>
          {showAddChild ? (
            <View style={styles.addForm}>
              <Text style={styles.addTitle}>New child profile</Text>
              <Field label="First name" value={newChild.firstName} onChangeText={(value) => setNewChild((child) => ({ ...child, firstName: value }))} />
              <Field label="Last name" value={newChild.lastName} onChangeText={(value) => setNewChild((child) => ({ ...child, lastName: value }))} />
              <Field label="Date of birth" placeholder="YYYY-MM-DD" value={newChild.dateOfBirth} onChangeText={(value) => setNewChild((child) => ({ ...child, dateOfBirth: value }))} hint="Never shown publicly." />
              <View style={styles.inlineButtons}>
                <Button label="Cancel" variant="ghost" onPress={() => setShowAddChild(false)} />
                <Button label="Save child" onPress={saveChild} style={styles.flex} />
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowAddChild(true)} style={styles.addButton}>
              <Ionicons name="add-circle-outline" size={21} color={colors.orangeDark} />
              <Text style={styles.addButtonText}>Add another child</Text>
            </Pressable>
          )}
          {selected.length === 0 ? <Text style={styles.selectionError}>Select at least one child to continue.</Text> : null}
          <PriceCard count={selected.length} total={subtotal} discount={discount} />
        </View>
      )}

      {step === 'consent' && (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>Consent & waiver</Text>
          <Text style={styles.stepBody}>Review and accept the required terms for every selected child.</Text>
          <View style={styles.legal}>
            <Text style={styles.legalTitle}>Participation consent</Text>
            <Text style={styles.legalText}>I am the parent or authorized guardian of the listed participant(s). I understand that athletic activities involve risk of injury and consent to their participation in this Nova Royals program.</Text>
            <Text style={styles.legalTitle}>Emergency treatment authorization</Text>
            <Text style={styles.legalText}>If I cannot be reached, I authorize Nova Royals representatives to obtain reasonable emergency medical treatment for the listed participant(s). I understand that I remain responsible for resulting costs.</Text>
          </View>
          <Controller control={form.control} name="parentConsent" render={({ field, fieldState }) => (
            <CheckRow label="I accept the participation consent" checked={field.value} onPress={() => field.onChange(!field.value)} error={fieldState.error?.message} />
          )} />
          <Controller control={form.control} name="emergencyConsent" render={({ field, fieldState }) => (
            <CheckRow label="I authorize emergency treatment" checked={field.value} onPress={() => field.onChange(!field.value)} error={fieldState.error?.message} />
          )} />
          <Controller control={form.control} name="signature" render={({ field, fieldState }) => (
            <Field label="Typed legal signature" placeholder="Full name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} hint={`Signed electronically on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`} />
          )} />
        </View>
      )}

      {step === 'review' && (
        <View style={styles.step}>
          <Text style={styles.stepTitle}>Review your registration</Text>
          <Text style={styles.stepBody}>Make sure everything looks right before continuing to payment status.</Text>
          <View style={styles.reviewCard}>
            <ReviewSection title="Program" icon="football-outline">
              <SummaryRow label={program.title} value={program.dates} last />
            </ReviewSection>
            <ReviewSection title="Household" icon="home-outline">
              <SummaryRow label={form.getValues('guardianName')} value={form.getValues('email')} last />
            </ReviewSection>
            <ReviewSection title="Players" icon="people-outline">
              {selectedChildren.map((child, index) => (
                <SummaryRow key={child.id} label={`${child.firstName} ${child.lastName}`} value={index === 0 ? '$120' : '$60'} last={index === selectedChildren.length - 1} />
              ))}
            </ReviewSection>
          </View>
          <PriceCard count={selected.length} total={subtotal} discount={discount} />
        </View>
      )}

      {step === 'payment' && (
        <View style={styles.step}>
          <StatusPill label="Development checkout" tone="warning" />
          <Text style={styles.stepTitle}>Ready to submit.</Text>
          <Text style={styles.stepBody}>Payment credentials are not configured, so this build records a pending payment without charging a card.</Text>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>TOTAL DUE</Text>
            <Text style={styles.totalValue}>${subtotal}</Text>
            {discount > 0 ? <Text style={styles.saved}>You saved ${discount} with sibling pricing</Text> : null}
          </View>
          <View style={styles.demoCheckout}>
            <Ionicons name="flask-outline" size={24} color={colors.warning} />
            <View style={styles.flex}>
              <Text style={styles.demoTitle}>Demo payment status</Text>
              <Text style={styles.demoCopy}>Submission creates a local registration marked “pending.” Production checkout will use the payment-provider abstraction.</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          {step === 'children' || step === 'review' || step === 'payment' ? (
            <>
              <Text style={styles.footerLabel}>TOTAL</Text>
              <Text style={styles.footerPrice}>${subtotal}</Text>
            </>
          ) : (
            <>
              <Text style={styles.footerLabel}>FALL 2026</Text>
              <Text style={styles.footerPrice}>$120+</Text>
            </>
          )}
        </View>
        <Button
          label={step === 'payment' ? 'Submit registration' : 'Continue'}
          icon="arrow-forward"
          onPress={goNext}
          disabled={step === 'children' && selected.length === 0}
          style={styles.continue}
        />
      </View>
    </Screen>
  );
}

function AdultRegistration({ programId, title }: { programId: string; title: string }) {
  const { submitRegistration } = useApp();
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  if (submitted) {
    return (
      <Screen contentStyle={styles.confirmationPage}>
        <View style={styles.confirmIcon}><Ionicons name="checkmark" size={44} color={colors.white} /></View>
        <Text style={styles.confirmTitle}>Interest received.</Text>
        <Text style={styles.confirmCopy}>We saved your demo player registration for {title}.</Text>
        <Button label="Return to programs" onPress={() => router.replace('/(tabs)/programs')} style={styles.fullButton} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={21} /></Pressable>
        <View style={styles.topCopy}><Text style={styles.topEyebrow}>PLAYER REGISTRATION</Text><Text style={styles.topTitle}>{title}</Text></View>
      </View>
      <View style={styles.step}>
        <Text style={styles.stepTitle}>Tell us about you.</Text>
        <Text style={styles.stepBody}>This adult flow only collects information relevant to the player and program.</Text>
        <Field label="Player full name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Phone" keyboardType="phone-pad" />
        <Field label="Date of birth" placeholder="YYYY-MM-DD" />
        <Field label="Playing experience (optional)" multiline numberOfLines={3} />
        <Button label="Submit player interest" icon="arrow-forward" disabled={!name || !email} onPress={() => {
          submitRegistration({
            programId,
            participantIds: [],
            participantNames: [name],
            status: 'pending',
            amountDue: 0,
            discountAmount: 0,
            paymentStatus: 'unpaid',
          });
          setSubmitted(true);
        }} />
      </View>
    </Screen>
  );
}

function CheckRow({ label, checked, onPress, error }: { label: string; checked: boolean; onPress: () => void; error?: string }) {
  return (
    <View>
      <Pressable onPress={onPress} style={styles.checkRow}>
        <View style={[styles.checkbox, checked && styles.checkboxActive]}>
          {checked ? <Ionicons name="checkmark" size={17} color={colors.white} /> : null}
        </View>
        <Text style={styles.checkLabel}>{label}</Text>
      </Pressable>
      {error ? <Text style={styles.checkError}>{error}</Text> : null}
    </View>
  );
}

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryBorder]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ReviewSection({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  return (
    <View style={styles.reviewSection}>
      <View style={styles.reviewTitleRow}><Ionicons name={icon} size={18} color={colors.orangeDark} /><Text style={styles.reviewTitle}>{title}</Text></View>
      {children}
    </View>
  );
}

function PriceCard({ count, total, discount }: { count: number; total: number; discount: number }) {
  return (
    <View style={styles.priceCard}>
      <View style={styles.priceHeader}><Text style={styles.priceTitle}>Price summary</Text><Text style={styles.priceCount}>{count} {count === 1 ? 'child' : 'children'}</Text></View>
      {count > 0 ? <View style={styles.priceLine}><Text style={styles.priceLineLabel}>First child</Text><Text style={styles.priceLineValue}>$120</Text></View> : null}
      {count > 1 ? <View style={styles.priceLine}><Text style={styles.priceLineLabel}>{count - 1} additional {count - 1 === 1 ? 'child' : 'children'}</Text><Text style={styles.priceLineValue}>${(count - 1) * 60}</Text></View> : null}
      {discount > 0 ? <View style={styles.priceLine}><Text style={styles.priceLineLabel}>Sibling discount</Text><Text style={styles.priceDiscount}>−${discount}</Text></View> : null}
      <View style={styles.priceTotal}><Text style={styles.priceTotalLabel}>Total</Text><Text style={styles.priceTotalValue}>${total}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  topCopy: { flex: 1 },
  topEyebrow: { color: colors.orangeDark, fontSize: 9, ...typography.label, letterSpacing: 1.1 },
  topTitle: { color: colors.ink, fontSize: 15, marginTop: 2, ...typography.heading },
  stepCount: { color: colors.stone, fontSize: 12, ...typography.label },
  progress: { flexDirection: 'row', gap: 5, marginTop: spacing.md },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.sand },
  progressActive: { backgroundColor: colors.orange },
  currentLabel: { color: colors.stone, fontSize: 10, textTransform: 'uppercase', marginTop: spacing.sm, ...typography.label, letterSpacing: 1 },
  step: { marginTop: spacing.xxl },
  stepTitle: { color: colors.ink, fontSize: 31, lineHeight: 36, marginTop: spacing.md, ...typography.heading },
  stepBody: { color: colors.stone, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, marginBottom: spacing.xl, ...typography.body },
  programCard: { borderRadius: radius.md, backgroundColor: colors.paper, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  summaryRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  summaryBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel: { flex: 1, color: colors.charcoal, fontSize: 13, ...typography.body },
  summaryValue: { maxWidth: '55%', color: colors.ink, fontSize: 12, textAlign: 'right', ...typography.label },
  trustRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  trustText: { flex: 1, color: colors.success, fontSize: 12, lineHeight: 18, ...typography.body },
  childList: { gap: spacing.md },
  childChoice: { padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childSelected: { borderColor: colors.orange, backgroundColor: colors.orangeSoft },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  checkboxActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  flex: { flex: 1 },
  childName: { color: colors.ink, fontSize: 15, ...typography.heading },
  childMeta: { color: colors.stone, fontSize: 11, marginTop: 3, ...typography.body },
  childPrice: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  addButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange },
  addButtonText: { color: colors.orangeDark, fontSize: 13, ...typography.label },
  selectionError: { color: colors.stone, fontSize: 11, textAlign: 'center', marginTop: spacing.sm, ...typography.body },
  addForm: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  addTitle: { color: colors.ink, fontSize: 17, marginBottom: spacing.lg, ...typography.heading },
  inlineButtons: { flexDirection: 'row', gap: spacing.sm },
  priceCard: { marginTop: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.ink },
  priceHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.charcoal },
  priceTitle: { color: colors.white, fontSize: 15, ...typography.heading },
  priceCount: { color: colors.sand, fontSize: 11, ...typography.body },
  priceLine: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.charcoal },
  priceLineLabel: { color: colors.sand, fontSize: 12, ...typography.body },
  priceLineValue: { color: colors.white, fontSize: 12, ...typography.label },
  priceDiscount: { color: colors.successSoft, fontSize: 12, ...typography.label },
  priceTotal: { minHeight: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceTotalLabel: { color: colors.white, fontSize: 14, ...typography.label },
  priceTotalValue: { color: colors.orange, fontSize: 24, ...typography.heading },
  legal: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, marginBottom: spacing.lg },
  legalTitle: { color: colors.ink, fontSize: 14, marginBottom: 5, ...typography.heading },
  legalText: { color: colors.stone, fontSize: 12, lineHeight: 18, marginBottom: spacing.lg, ...typography.body },
  checkRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkLabel: { flex: 1, color: colors.charcoal, fontSize: 14, ...typography.label },
  checkError: { color: colors.danger, fontSize: 11, marginLeft: 36, ...typography.body },
  reviewCard: { paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  reviewSection: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  reviewTitle: { color: colors.ink, fontSize: 14, ...typography.heading },
  totalCard: { padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center' },
  totalLabel: { color: colors.sand, fontSize: 11, ...typography.label, letterSpacing: 1.2 },
  totalValue: { color: colors.white, fontSize: 52, marginVertical: spacing.sm, ...typography.display },
  saved: { color: colors.orange, fontSize: 12, ...typography.label },
  demoCheckout: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.warningSoft, flexDirection: 'row', gap: spacing.md },
  demoTitle: { color: colors.warning, fontSize: 14, ...typography.heading },
  demoCopy: { color: colors.warning, fontSize: 12, lineHeight: 18, marginTop: 3, ...typography.body },
  footer: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  footerTotal: { minWidth: 72 },
  footerLabel: { color: colors.stone, fontSize: 9, ...typography.label },
  footerPrice: { color: colors.ink, fontSize: 19, ...typography.heading },
  continue: { flex: 1 },
  confirmationPage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxxl },
  confirmIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  confirmTitle: { color: colors.ink, fontSize: 35, lineHeight: 39, textAlign: 'center', marginTop: spacing.lg, ...typography.heading },
  confirmCopy: { maxWidth: 440, color: colors.stone, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: spacing.md, ...typography.body },
  confirmCard: { width: '100%', marginTop: spacing.xxl, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper },
  notice: { width: '100%', marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: '#E7F0F5', flexDirection: 'row', gap: spacing.md },
  noticeText: { flex: 1, color: colors.info, fontSize: 12, lineHeight: 18, ...typography.body },
  fullButton: { width: '100%', marginTop: spacing.md },
});
