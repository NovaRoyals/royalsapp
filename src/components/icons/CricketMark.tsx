import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

export function CricketMark({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Cricket">
      <Ellipse cx="7.2" cy="16.4" rx="2.1" ry="5.6" fill={color} transform="rotate(-28 7.2 16.4)" />
      <Path d="M8.4 11.2 L16.8 3.4 L18.4 5 L10 12.8 Z" fill={color} />
      <Path d="M16.2 2.6 L19.1 5.4 L18.2 6.3 L15.3 3.5 Z" fill={color} />
      <Circle cx="17.6" cy="16.8" r="3.35" fill={color} />
      <Path
        d="M16.1 14.4 C17.2 15.2 18.2 16.4 18.6 17.8"
        stroke="#FFFFFF"
        strokeWidth="0.7"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M15.4 15.6 C16.6 16.3 17.5 17.4 17.8 18.7"
        stroke="#FFFFFF"
        strokeWidth="0.7"
        fill="none"
        opacity={0.85}
      />
    </Svg>
  );
}
