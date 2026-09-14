import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme/tokens';

const links = [
  { title: 'About', body: 'Nova Royals Athletic Club is a Northern Virginia 501(c)(3) building a family of sports lovers through soccer, cricket, fitness and community.' },
  { title: 'Support Us', body: 'Donations and in-kind help keep youth training accessible. Contact the board for current campaigns.' },
  { title: 'Sponsors', body: 'Partner logos will live here. Sponsors are not a primary tab in Stage 2.' },
  { title: 'Volunteer', body: 'Match-day marshalling, setup, and Royals Run support. Open volunteer spots appear on Home this week.' },
  { title: 'Contact', body: 'Sully Highlands Park, Herndon, VA · (703) 220-0763 · infonovaroyals@gmail.com' },
];

export default function AboutScreen() {
  return (
    <Screen>
      <View style={styles.topbar}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={21} /></Pressable>
        <Text style={styles.title}>About ROYALS</Text>
        <View style={styles.back} />
      </View>
      {links.map((item) => (
        <View key={item.title} style={styles.card}>
          <Text style={styles.heading}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      ))}
      <Pressable onPress={() => Linking.openURL('mailto:infonovaroyals@gmail.com')} style={styles.mail}>
        <Ionicons name="mail-outline" size={18} color={colors.orangeDark} />
        <Text style={styles.mailText}>Email the club</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44 },
  title: { color: colors.ink, fontSize: 18, ...typography.heading },
  card: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.paper, marginBottom: spacing.md },
  heading: { color: colors.ink, fontSize: 16, marginBottom: 6, ...typography.heading },
  body: { color: colors.stone, fontSize: 13, lineHeight: 20, ...typography.body },
  mail: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mailText: { color: colors.orangeDark, ...typography.label },
});
