import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/theme/motion';
import type { RoyState } from '@/components/mascot/types';

export type RoyMotionValues = {
  opacity: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  rotate: SharedValue<number>;
  stretchY: SharedValue<number>;
  headTilt: SharedValue<number>;
  leftArm: SharedValue<number>;
  rightArm: SharedValue<number>;
  leftLeg: SharedValue<number>;
  rightLeg: SharedValue<number>;
  tail: SharedValue<number>;
  face: SharedValue<number>;
};

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const easeInOut = Easing.inOut(Easing.sin);

const DURATION: Record<Exclude<RoyState, 'idle'>, number> = {
  enter: 520,
  wave: 1120,
  pointDown: 960,
  celebrate: 1240,
  bounce: 1180,
  exit: 380,
};

function cancelAll(values: RoyMotionValues) {
  (Object.values(values) as SharedValue<number>[]).forEach((value) => cancelAnimation(value));
}

function snapRest(values: RoyMotionValues) {
  values.opacity.value = 1;
  values.x.value = 0;
  values.y.value = 0;
  values.scale.value = 1;
  values.rotate.value = 0;
  values.stretchY.value = 1;
  values.headTilt.value = 0;
  values.leftArm.value = 0;
  values.rightArm.value = 0;
  values.leftLeg.value = 0;
  values.rightLeg.value = 0;
  values.tail.value = 0;
  values.face.value = 0;
}

function startIdle(values: RoyMotionValues) {
  cancelAll(values);
  values.opacity.value = withTiming(1, { duration: motion.duration.enter, easing: easeOut });
  values.x.value = withTiming(0, { duration: 220, easing: easeOut });
  values.scale.value = withSpring(1, motion.spring.success);
  values.leftLeg.value = 0;
  values.rightLeg.value = 0;
  values.face.value = withTiming(0, { duration: 240, easing: easeOut });

  values.stretchY.value = withRepeat(
    withSequence(
      withTiming(1.025, { duration: 1400, easing: easeInOut }),
      withTiming(0.985, { duration: 1400, easing: easeInOut }),
    ),
    -1,
    true,
  );
  values.y.value = withRepeat(
    withSequence(
      withTiming(-4, { duration: 1600, easing: easeInOut }),
      withTiming(0, { duration: 1600, easing: easeInOut }),
    ),
    -1,
    true,
  );
  values.rotate.value = withRepeat(
    withSequence(
      withTiming(-2.2, { duration: 1800, easing: easeInOut }),
      withTiming(2.2, { duration: 1800, easing: easeInOut }),
    ),
    -1,
    true,
  );
  values.headTilt.value = withRepeat(
    withSequence(
      withTiming(-3, { duration: 2200, easing: easeInOut }),
      withTiming(2.4, { duration: 2200, easing: easeInOut }),
    ),
    -1,
    true,
  );
  values.tail.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 700, easing: easeInOut }),
      withTiming(-1, { duration: 700, easing: easeInOut }),
    ),
    -1,
    true,
  );
  values.rightArm.value = withRepeat(
    withSequence(
      withTiming(0.18, { duration: 1600, easing: easeInOut }),
      withTiming(-0.12, { duration: 1600, easing: easeInOut }),
    ),
    -1,
    true,
  );
  values.leftArm.value = withRepeat(
    withSequence(
      withTiming(-0.12, { duration: 1600, easing: easeInOut }),
      withTiming(0.18, { duration: 1600, easing: easeInOut }),
    ),
    -1,
    true,
  );
}

export function useRoyMotion({
  reduced,
  autoIdle,
  onComplete,
}: {
  reduced: boolean;
  autoIdle: boolean;
  onComplete?: (state: RoyState) => void;
}) {
  const opacity = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const stretchY = useSharedValue(1);
  const headTilt = useSharedValue(0);
  const leftArm = useSharedValue(0);
  const rightArm = useSharedValue(0);
  const leftLeg = useSharedValue(0);
  const rightLeg = useSharedValue(0);
  const tail = useSharedValue(0);
  const face = useSharedValue(0);

  const values = useMemo<RoyMotionValues>(
    () => ({
      opacity,
      x,
      y,
      scale,
      rotate,
      stretchY,
      headTilt,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      tail,
      face,
    }),
    [face, headTilt, leftArm, leftLeg, opacity, rightArm, rightLeg, rotate, scale, stretchY, tail, x, y],
  );

  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef<RoyState>('idle');
  const opts = useRef({ reduced, autoIdle, onComplete, values });
  opts.current = { reduced, autoIdle, onComplete, values };

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const play = useCallback((state: RoyState) => {
    const { reduced: prefersReduced, autoIdle: returnToIdle, onComplete: complete, values: motionValues } = opts.current;
    generation.current += 1;
    const gen = generation.current;
    playingRef.current = state;
    clearTimer();
    cancelAll(motionValues);

    const done = () => {
      if (gen !== generation.current) return;
      complete?.(state);
      if (state !== 'exit' && state !== 'idle' && returnToIdle) {
        playingRef.current = 'idle';
        if (prefersReduced) {
          snapRest(motionValues);
          motionValues.opacity.value = 1;
        } else {
          startIdle(motionValues);
        }
      }
    };

    if (prefersReduced) {
      snapRest(motionValues);
      motionValues.opacity.value = state === 'exit' ? 0 : 1;
      if (state !== 'idle' && state !== 'exit') motionValues.scale.value = 1.04;
      done();
      return;
    }

    if (state === 'idle') {
      snapRest(motionValues);
      startIdle(motionValues);
      done();
      return;
    }

    if (state === 'enter') {
      snapRest(motionValues);
      motionValues.opacity.value = 0;
      motionValues.y.value = 42;
      motionValues.scale.value = 0.84;
      motionValues.rotate.value = -6;
      motionValues.stretchY.value = 1.04;
      motionValues.x.value = 0;
      motionValues.opacity.value = withTiming(1, { duration: 280, easing: easeOut });
      motionValues.y.value = withSpring(0, { damping: 14, stiffness: 220 });
      motionValues.scale.value = withSpring(1, motion.spring.success);
      motionValues.rotate.value = withTiming(0, { duration: 420, easing: easeOut });
      motionValues.stretchY.value = withSequence(
        withTiming(0.96, { duration: 180 }),
        withSpring(1, motion.spring.success),
      );
    }

    if (state === 'wave') {
      snapRest(motionValues);
      motionValues.rightArm.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 140, easing: easeOut }),
          withTiming(-0.15, { duration: 140, easing: easeOut }),
        ),
        4,
        true,
      );
      motionValues.rotate.value = withRepeat(
        withSequence(
          withTiming(-7, { duration: 160, easing: easeInOut }),
          withTiming(7, { duration: 160, easing: easeInOut }),
        ),
        3,
        true,
      );
      motionValues.y.value = withRepeat(
        withSequence(withTiming(-8, { duration: 180 }), withTiming(0, { duration: 180 })),
        3,
        true,
      );
      motionValues.tail.value = withRepeat(
        withSequence(withTiming(1, { duration: 160 }), withTiming(-1, { duration: 160 })),
        4,
        true,
      );
      motionValues.face.value = withTiming(1, { duration: 180, easing: easeOut });
    }

    if (state === 'pointDown') {
      snapRest(motionValues);
      motionValues.rotate.value = withSequence(
        withTiming(11, { duration: 280, easing: easeOut }),
        withTiming(11, { duration: 420 }),
        withTiming(0, { duration: 240, easing: easeOut }),
      );
      motionValues.y.value = withSequence(
        withTiming(10, { duration: 280, easing: easeOut }),
        withTiming(10, { duration: 420 }),
        withTiming(0, { duration: 240, easing: easeOut }),
      );
      motionValues.headTilt.value = withSequence(
        withTiming(10, { duration: 260, easing: easeOut }),
        withTiming(10, { duration: 440 }),
        withTiming(0, { duration: 220, easing: easeOut }),
      );
      motionValues.rightArm.value = withSequence(
        withTiming(1, { duration: 240, easing: easeOut }),
        withTiming(1, { duration: 460 }),
        withTiming(0, { duration: 220, easing: easeOut }),
      );
      motionValues.scale.value = withSequence(
        withTiming(1.03, { duration: 240, easing: easeOut }),
        withTiming(1, { duration: 240, easing: easeOut }),
      );
    }

    if (state === 'celebrate') {
      snapRest(motionValues);
      motionValues.y.value = withSequence(
        withTiming(-34, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }),
        withTiming(-18, { duration: 140, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 280, easing: Easing.out(Easing.bounce) }),
      );
      motionValues.rotate.value = withSequence(
        withTiming(-14, { duration: 110 }),
        withTiming(14, { duration: 110 }),
        withTiming(-10, { duration: 100 }),
        withTiming(10, { duration: 100 }),
        withTiming(0, { duration: 220, easing: easeOut }),
      );
      motionValues.scale.value = withSequence(
        withTiming(1.1, { duration: 180, easing: easeOut }),
        withSpring(1, motion.spring.success),
      );
      motionValues.stretchY.value = withSequence(
        withTiming(0.94, { duration: 90 }),
        withTiming(1.08, { duration: 140 }),
        withTiming(1, { duration: 220, easing: easeOut }),
      );
      motionValues.leftArm.value = withRepeat(
        withSequence(withTiming(1, { duration: 120 }), withTiming(-0.2, { duration: 120 })),
        4,
        true,
      );
      motionValues.rightArm.value = withRepeat(
        withSequence(withTiming(-0.2, { duration: 120 }), withTiming(1, { duration: 120 })),
        4,
        true,
      );
      motionValues.tail.value = withRepeat(
        withSequence(withTiming(1, { duration: 90 }), withTiming(-1, { duration: 90 })),
        6,
        true,
      );
      motionValues.face.value = withTiming(1, { duration: 140, easing: easeOut });
    }

    if (state === 'bounce') {
      snapRest(motionValues);
      motionValues.y.value = withSequence(
        withTiming(-38, { duration: 220, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }),
        withTiming(-24, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) }),
        withTiming(-12, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 220, easing: Easing.out(Easing.bounce) }),
      );
      motionValues.stretchY.value = withSequence(
        withTiming(0.92, { duration: 80 }),
        withTiming(1.08, { duration: 140 }),
        withTiming(0.94, { duration: 80 }),
        withTiming(1.06, { duration: 130 }),
        withTiming(0.97, { duration: 70 }),
        withTiming(1, { duration: 180, easing: easeOut }),
      );
      motionValues.leftLeg.value = withSequence(withTiming(0.6, { duration: 180 }), withTiming(0, { duration: 200 }));
      motionValues.rightLeg.value = withSequence(
        withTiming(0, { duration: 90 }),
        withTiming(0.6, { duration: 180 }),
        withTiming(0, { duration: 200 }),
      );
    }

    if (state === 'exit') {
      motionValues.opacity.value = withTiming(0, { duration: DURATION.exit, easing: easeOut });
      motionValues.y.value = withTiming(28, { duration: DURATION.exit, easing: easeOut });
      motionValues.scale.value = withTiming(0.9, { duration: DURATION.exit, easing: easeOut });
      motionValues.rotate.value = withTiming(4, { duration: DURATION.exit, easing: easeOut });
    }

    timer.current = setTimeout(done, DURATION[state]);
  }, []);

  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (playingRef.current === 'idle') {
      if (reduced) {
        snapRest(values);
        values.opacity.value = 1;
      } else {
        startIdle(values);
      }
    }
  }, [reduced, values]);

  useEffect(
    () => () => {
      generation.current += 1;
      clearTimer();
      cancelAll(values);
    },
    [values],
  );

  return { values, play };
}
