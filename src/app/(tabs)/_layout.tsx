import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { onTabPressHaptic, TabBarIcon } from '@/components/motion';
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
        animation: 'none',
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.stone,
        tabBarLabelStyle: { fontSize: 10, fontFamily: typography.label.fontFamily, letterSpacing: 0.1 },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 82 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ focused, size }) => {
          const icons = iconMap[route.name as keyof typeof iconMap] ?? iconMap.index;
          return <TabBarIcon outline={icons[0]} filled={icons[1]} focused={focused} size={size} />;
        },
      })}
    >
      {(['index', 'programs', 'schedule', 'profile'] as const).map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: name === 'index' ? 'Home' : name[0].toUpperCase() + name.slice(1),
            tabBarAccessibilityLabel: name === 'index' ? 'Home' : name[0].toUpperCase() + name.slice(1),
          }}
          listeners={({ navigation, route }) => ({
            tabPress: () => {
              const state = navigation.getState();
              onTabPressHaptic(state.routes[state.index]?.name === route.name);
            },
          })}
        />
      ))}
      <Tabs.Screen name="teams" options={{ href: null, title: 'Teams' }} />
    </Tabs>
  );
}
