import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { RoyMotionValues } from '@/components/mascot/motion';
import { royPoseSource, type RoyPose } from '@/components/mascot/poses';

/**
 * Whole-character renderer. Part shared values are composed onto the PNG so
 * states still read as wave / point / celebrate. Swap this module for layered
 * SVG parts without changing `Roy` or the motion hook.
 */
export function FullBodyPng({
  size,
  values,
  pose = 'idle',
  still = false,
  scene = 'light',
}: {
  size: number;
  values: RoyMotionValues;
  pose?: RoyPose;
  still?: boolean;
  scene?: 'light' | 'dark';
}) {
  const rootStyle = useAnimatedStyle(() => ({
    opacity: values.opacity.value,
    transform: [{ translateX: values.x.value }, { translateY: values.y.value }, { scale: values.scale.value }],
  }));

  const bodyStyle = useAnimatedStyle(() => {
    const armLean = (values.rightArm.value - values.leftArm.value) * 5.5;
    const tailLean = values.tail.value * 2.2;
    return {
      transform: [
        { rotate: `${values.rotate.value + armLean + tailLean}deg` },
        { scaleY: values.stretchY.value },
        { rotate: `${values.headTilt.value * 0.35}deg` },
      ],
    };
  });

  const blend = { mixBlendMode: scene === 'dark' ? 'darken' : 'multiply' } as const;
  const image = (
    <Image
      source={royPoseSource[pose]}
      style={styles.image}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );

  if (still) {
    return <Animated.View style={[{ width: size, height: size }, styles.body, blend]}>{image}</Animated.View>;
  }

  return (
    <Animated.View style={[{ width: size, height: size }, rootStyle]}>
      <Animated.View style={[styles.body, blend, bodyStyle]}>{image}</Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  image: { width: '100%', height: '100%' },
});
