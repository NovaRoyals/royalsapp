import { router } from 'expo-router';
import { useLayoutEffect } from 'react';

import { setHomeView } from '@/lib/homeView';

export default function ProgramsScreen() {
  useLayoutEffect(() => {
    setHomeView('club');
    router.replace('/');
  }, []);
  return null;
}
