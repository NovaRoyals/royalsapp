import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { onTabPressHaptic, TabBarIcon } from '@/components/motion';
import { colors, radius } from '@/theme/tokens';

const iconMap = {
  index: ['home-outline', 'home'],
  programs: ['grid-outline', 'grid'],
  schedule: ['calendar-outline', 'calendar'],
  fields: ['location-outline', 'location'],
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
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 26 : 14,
          height: 64,
          paddingTop: 0,
          paddingBottom: 0,
          paddingHorizontal: 6,
          borderRadius: radius.pill,
          backgroundColor: colors.night,
          borderTopWidth: 0,
          maxWidth: 440,
          alignSelf: 'center',
          ...Platform.select({
            web: { boxShadow: '0 12px 32px rgba(6, 36, 26, 0.32)' },
            default: { shadowColor: colors.night, shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
          }),
        },
        tabBarItemStyle: { height: 64, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' },
        tabBarIconStyle: { width: 52, height: 44, marginTop: 0, marginBottom: 0 },
        tabBarIcon: ({ focused, size }) => {
          const icons = iconMap[route.name as keyof typeof iconMap] ?? iconMap.index;
          return <TabBarIcon outline={icons[0]} filled={icons[1]} focused={focused} size={Math.min(size, 24)} />;
        },
      })}
    >
      {(['index', 'schedule', 'fields', 'profile'] as const).map((name) => (
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
      <Tabs.Screen name="programs" options={{ href: null, title: 'Programs' }} />
      <Tabs.Screen name="teams" options={{ href: null, title: 'Teams' }} />
    </Tabs>
  );
}
