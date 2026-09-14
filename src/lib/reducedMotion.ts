import { AccessibilityInfo, Platform } from 'react-native';
import { useEffect, useState } from 'react';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => setReduced(media.matches);
      apply();
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);

  return reduced;
}
