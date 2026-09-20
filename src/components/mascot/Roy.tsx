import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { RoyFigure } from '@/components/mascot/figure/RoyFigure';
import { useRoyMotion } from '@/components/mascot/motion';
import type { RoyPose } from '@/components/mascot/poses';
import type { RoyHandle, RoyState } from '@/components/mascot/types';
import { useReducedMotion } from '@/lib/reducedMotion';

export type RoyProps = {
  state?: RoyState;
  pose?: RoyPose;
  size?: number;
  autoIdle?: boolean;
  still?: boolean;
  scene?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  onComplete?: (state: RoyState) => void;
};

export const Roy = forwardRef<RoyHandle, RoyProps>(function Roy(
  { state = 'idle', pose = 'idle', size = 220, autoIdle = true, still = false, scene = 'light', style, onComplete },
  ref,
) {
  const reduced = useReducedMotion();
  const { values, play } = useRoyMotion({ reduced, autoIdle: still ? false : autoIdle, onComplete });

  useImperativeHandle(ref, () => ({ play }), [play]);

  useEffect(() => {
    if (still) return;
    play(state);
  }, [play, state, still]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Roy, Nova Royals mascot"
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <RoyFigure size={size} values={values} pose={pose} still={still} scene={scene} />
    </View>
  );
});
