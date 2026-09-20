import type { ImageSource } from 'expo-image';

export const ROY_POSES = [
  'idle',
  'wave',
  'smile',
  'happy',
  'wink',
  'think',
  'idea',
  'thumbsup',
  'celebrate',
  'excited',
  'goal',
  'highfive',
  'point',
  'confused',
  'surprised',
  'sad',
  'tired',
  'folded',
  'kick',
  'run',
] as const;

export type RoyPose = (typeof ROY_POSES)[number];

export const royPoseSource: Record<RoyPose, ImageSource> = {
  idle: require('@/assets/mascot/roy/idle.png'),
  wave: require('@/assets/mascot/roy/wave.png'),
  smile: require('@/assets/mascot/roy/smile.png'),
  happy: require('@/assets/mascot/roy/happy.png'),
  wink: require('@/assets/mascot/roy/wink.png'),
  think: require('@/assets/mascot/roy/think.png'),
  idea: require('@/assets/mascot/roy/idea.png'),
  thumbsup: require('@/assets/mascot/roy/thumbsup.png'),
  celebrate: require('@/assets/mascot/roy/celebrate.png'),
  excited: require('@/assets/mascot/roy/excited.png'),
  goal: require('@/assets/mascot/roy/goal.png'),
  highfive: require('@/assets/mascot/roy/highfive.png'),
  point: require('@/assets/mascot/roy/point.png'),
  confused: require('@/assets/mascot/roy/confused.png'),
  surprised: require('@/assets/mascot/roy/surprised.png'),
  sad: require('@/assets/mascot/roy/sad.png'),
  tired: require('@/assets/mascot/roy/tired.png'),
  folded: require('@/assets/mascot/roy/folded.png'),
  kick: require('@/assets/mascot/roy/kick.png'),
  run: require('@/assets/mascot/roy/run.png'),
};
