import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { CloudBackdrop } from '@/components/brand/CloudBackdrop';
import { royPoseSource } from '@/components/mascot/poses';
import { Screen } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { safeBack } from '@/lib/nav';
import { shareContent } from '@/lib/share';
import { colors, gradients, spacing, tints, typography, type TintName } from '@/theme/tokens';

const sections: { icon: keyof typeof Ionicons.glyphMap; tint: TintName; title: string; body: string }[] = [
  { icon: 'heart-outline', tint: 'blush', title: 'Support us', body: 'Donations and in-kind help keep youth training affordable. Contact the board to hear about current campaigns.' },
  { icon: 'hand-left-outline', tint: 'mint', title: 'Volunteer', body: 'Match-day setup, marshalling and Royals Run support. Open spots show up on Home the week they’re needed.' },
  { icon: 'ribbon-outline', tint: 'gold', title: 'Sponsors', body: 'Local businesses help keep the club running. Partner logos will be listed here.' },
];

export default function AboutScreen() {
  const toast = useToast();
  const open = async (url: string, fallback: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      const result = await shareContent({ title: 'ROYALS', message: fallback });
      toast(result === 'copied' ? 'Copied' : 'Couldn’t open that');
    }
  };
  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => safeBack('/(tabs)')} style={styles.back}>
          <Ionicons name="arrow-back" size={21} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>About ROYALS</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.hero}>
        <LinearGradient colors={gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <CloudBackdrop />
        <Image source={royPoseSource.happy} style={styles.heroRoy} contentFit="contain" alt="" />
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>NOVA ROYALS ATHLETIC CLUB</Text>
          <Text style={styles.heroTitle}>A family of sports lovers.</Text>
          <Text style={styles.heroBody}>A Northern Virginia nonprofit building community through soccer, cricket and kids’ training.</Text>
        </View>
      </View>

      {sections.map((item) => {
        const tint = tints[item.tint];
        return (
          <View key={item.title} style={[styles.card, { backgroundColor: tint.bg }]}>
            <View style={styles.cardIcon}>
              <Ionicons accessible={false} name={item.icon} size={20} color={tint.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.heading}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </View>
        );
      })}

      <Text style={styles.contactLabel}>CONTACT</Text>
      <View style={styles.contact}>
        <Pressable accessibilityRole="link" accessibilityLabel="Email the club" onPress={() => open('mailto:infonovaroyals@gmail.com', 'infonovaroyals@gmail.com')} style={[styles.contactRow, styles.divider]}>
          <Ionicons accessible={false} name="mail-outline" size={19} color={colors.ink} />
          <Text style={styles.contactText}>infonovaroyals@gmail.com</Text>
          <Ionicons accessible={false} name="arrow-forward" size={16} color={colors.stone} />
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="Call the club" onPress={() => open('tel:+17032200763', '(703) 220-0763')} style={[styles.contactRow, styles.divider]}>
          <Ionicons accessible={false} name="call-outline" size={19} color={colors.ink} />
          <Text style={styles.contactText}>(703) 220-0763</Text>
          <Ionicons accessible={false} name="arrow-forward" size={16} color={colors.stone} />
        </Pressable>
        <View style={styles.contactRow}>
          <Ionicons accessible={false} name="location-outline" size={19} color={colors.ink} />
          <Text style={styles.contactText}>Sully Highlands Park, Herndon, VA</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  topbar: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  spacer: { width: 44, height: 44 },
  title: { color: colors.ink, fontSize: 17, ...typography.heading },
  hero: { borderRadius: 26, overflow: 'hidden', backgroundColor: colors.greenDeep, minHeight: 200, justifyContent: 'center', marginBottom: 10 },
  heroRoy: { position: 'absolute', right: -10, bottom: -22, width: 150, height: 150 },
  heroCopy: { padding: 18, paddingRight: 130, gap: 6 },
  kicker: { color: colors.mint, fontSize: 10, ...typography.label, letterSpacing: 1.6 },
  heroTitle: { color: colors.white, fontSize: 24, lineHeight: 28, ...typography.heading },
  heroBody: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19, ...typography.body },
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 22, marginBottom: 10 },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  heading: { color: colors.ink, fontSize: 16, ...typography.heading },
  body: { color: colors.charcoal, fontSize: 13, lineHeight: 19, marginTop: 2, ...typography.body },
  contactLabel: { color: colors.stone, fontSize: 11, marginTop: 8, marginBottom: 6, marginLeft: 6, ...typography.label, letterSpacing: 1.1 },
  contact: { borderRadius: 22, backgroundColor: colors.paper, paddingHorizontal: 14, marginBottom: spacing.lg },
  contactRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  contactText: { flex: 1, color: colors.ink, fontSize: 14, ...typography.bodyMedium },
});
