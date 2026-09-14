import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Screen, StatusPill } from '@/components/ui';
import { demoPrograms } from '@/data/demo';
import { colors, radius, spacing, typography } from '@/theme/tokens';

export function generateStaticParams() {
  return demoPrograms.map((item) => ({ id: item.id }));
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const program = demoPrograms.find((item) => item.id === id) ?? demoPrograms[0];
  const isYouth = program.id === 'fall-kids-2026' || program.id === 'travel-soccer';

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.hero}>
        <Image source={{ uri: program.heroImage }} contentFit="cover" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['rgba(21,19,16,0.08)', 'rgba(21,19,16,0.9)']} style={StyleSheet.absoluteFill} />
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.heroCopy}>
          <StatusPill label={program.badge ?? 'Program'} tone={program.registrationOpen ? 'orange' : 'neutral'} />
          <Text style={styles.title}>{program.title}</Text>
          <Text style={styles.audience}>{program.audience} · {program.sport.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.facts}>
        {program.facts.map((fact) => (
          <View key={fact.label} style={styles.fact}>
            <Text style={styles.factLabel}>{fact.label}</Text>
            <Text style={styles.factValue}>{fact.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>The program</Text>
        <Text style={styles.body}>{program.description}</Text>
      </View>

      <View style={styles.infoCard}>
        <InfoRow icon="calendar-outline" label="Dates" value={program.dates} />
        <InfoRow icon="location-outline" label="Venue" value={program.venue} />
        <InfoRow icon="wallet-outline" label="Price" value={program.priceLabel} last />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What’s included</Text>
        <View style={styles.includes}>
          {program.includes.map((item) => (
            <View key={item} style={styles.includeRow}>
              <View style={styles.check}><Ionicons name="checkmark" size={14} color={colors.white} /></View>
              <Text style={styles.includeText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.safetyCard}>
        <Ionicons name={isYouth ? 'shield-checkmark-outline' : 'people-outline'} size={24} color={colors.orangeDark} />
        <View style={styles.flex}>
          <Text style={styles.safetyTitle}>{isYouth ? 'Built for families' : 'The right form for you'}</Text>
          <Text style={styles.safetyText}>
            {isYouth
              ? 'One guardian account can register and safely manage multiple children without exposing private youth information.'
              : 'Adult registration only asks for player and participation details—no irrelevant guardian fields.'}
          </Text>
        </View>
      </View>

      <View style={styles.faq}>
        <Text style={styles.sectionTitle}>Good to know</Text>
        <Text style={styles.faqQuestion}>Can I save my information?</Text>
        <Text style={styles.body}>Yes. Profiles stay attached to your account so future registrations are much faster.</Text>
        <Text style={styles.faqQuestion}>When is my place confirmed?</Text>
        <Text style={styles.body}>You’ll see a live registration status and receive an update after review and payment.</Text>
      </View>

      <View style={styles.cta}>
        <View style={styles.flex}>
          <Text style={styles.ctaLabel}>{program.registrationOpen ? 'Registration open' : 'Interest list'}</Text>
          <Text style={styles.ctaPrice}>{program.priceLabel}</Text>
        </View>
        <Button
          label={program.registrationOpen ? 'Register' : 'Join list'}
          icon="arrow-forward"
          onPress={() => router.push(`/registration/${program.id}`)}
        />
      </View>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoBorder]}>
      <View style={styles.infoIcon}><Ionicons name={icon} size={19} color={colors.orangeDark} /></View>
      <View style={styles.flex}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 0 },
  hero: { minHeight: 390, justifyContent: 'space-between', overflow: 'hidden' },
  back: { marginTop: spacing.md, marginLeft: spacing.lg, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  heroCopy: { padding: spacing.xl, gap: spacing.sm },
  title: { color: colors.white, fontSize: 38, lineHeight: 41, ...typography.display },
  audience: { color: colors.sand, fontSize: 12, ...typography.label, letterSpacing: 0.6 },
  facts: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: -20, borderRadius: radius.md, backgroundColor: colors.paper, paddingVertical: spacing.lg },
  fact: { flex: 1, paddingHorizontal: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border },
  factLabel: { color: colors.stone, fontSize: 9, textTransform: 'uppercase', textAlign: 'center', ...typography.label },
  factValue: { color: colors.ink, fontSize: 13, textAlign: 'center', marginTop: 4, ...typography.heading },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  sectionTitle: { color: colors.ink, fontSize: 21, marginBottom: spacing.md, ...typography.heading },
  body: { color: colors.stone, fontSize: 15, lineHeight: 23, ...typography.body },
  infoCard: { marginHorizontal: spacing.xl, marginTop: spacing.xxl, borderRadius: radius.md, backgroundColor: colors.paper, overflow: 'hidden' },
  infoRow: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: colors.stone, fontSize: 10, textTransform: 'uppercase', ...typography.label },
  infoValue: { color: colors.ink, fontSize: 14, marginTop: 2, ...typography.heading },
  includes: { gap: spacing.md },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
  includeText: { color: colors.charcoal, fontSize: 14, ...typography.body },
  safetyCard: { marginHorizontal: spacing.xl, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.md, flexDirection: 'row', gap: spacing.md, backgroundColor: colors.orangeSoft },
  safetyTitle: { color: colors.orangeDark, fontSize: 15, ...typography.heading },
  safetyText: { color: colors.charcoal, fontSize: 12, lineHeight: 18, marginTop: 3, ...typography.body },
  faq: { marginHorizontal: spacing.xl, marginTop: spacing.xxl },
  faqQuestion: { color: colors.ink, fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.xs, ...typography.heading },
  cta: { margin: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaLabel: { color: colors.orange, fontSize: 11, textTransform: 'uppercase', ...typography.label },
  ctaPrice: { color: colors.white, fontSize: 12, marginTop: 4, ...typography.body },
  flex: { flex: 1 },
});
