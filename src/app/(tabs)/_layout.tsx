import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { colors, typography } from '@/theme/tokens';

const iconMap = {
  index: ['home-outline', 'home'],
  programs: ['grid-outline', 'grid'],
  schedule: ['calendar-outline', 'calendar'],
  teams: ['shield-outline', 'shield'],
  profile: ['person-outline', 'person'],
} as const;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: colors.cream },
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.stone,
        tabBarLabelStyle: { fontSize: 10, ...typography.label, letterSpacing: 0.1 },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 86 : 70,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 22 : 8,
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ color, focused, size }) => {
          const icons = iconMap[route.name as keyof typeof iconMap] ?? iconMap.index;
          return <Ionicons name={icons[focused ? 1 : 0]} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="programs" options={{ title: 'Programs' }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
      <Tabs.Screen name="teams" options={{ title: 'Teams' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
