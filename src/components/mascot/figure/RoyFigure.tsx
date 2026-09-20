import { FullBodyPng } from '@/components/mascot/figure/FullBodyPng';
import type { RoyMotionValues } from '@/components/mascot/motion';
import type { RoyPose } from '@/components/mascot/poses';

/** Current visual implementation. Replace with SVG part layers when artwork is split. */
export function RoyFigure({
  size,
  values,
  pose,
  still,
  scene,
}: {
  size: number;
  values: RoyMotionValues;
  pose?: RoyPose;
  still?: boolean;
  scene?: 'light' | 'dark';
}) {
  return <FullBodyPng size={size} values={values} pose={pose} still={still} scene={scene} />;
}
