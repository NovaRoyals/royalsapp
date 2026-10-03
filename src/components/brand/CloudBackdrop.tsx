import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Stop } from 'react-native-svg';

/**
 * Still texture for dark green surfaces: soft cloud puffs and the faint centre circle and
 * halfway line of a pitch. Radial gradients only, so it renders the same on web and native
 * and costs nothing at runtime. It never moves.
 */
export function CloudBackdrop({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, style]}>
    <Svg preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 260" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="puff" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
          <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0.07" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#4FB98A" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#4FB98A" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="330" cy="70" rx="150" ry="90" fill="url(#glow)" />
      <Circle cx="300" cy="215" r="92" stroke="#FFFFFF" strokeOpacity="0.07" strokeWidth="1.5" fill="none" />
      <Line x1="300" y1="123" x2="300" y2="260" stroke="#FFFFFF" strokeOpacity="0.07" strokeWidth="1.5" />
      <Ellipse cx="70" cy="48" rx="120" ry="48" fill="url(#puff)" />
      <Ellipse cx="150" cy="30" rx="90" ry="36" fill="url(#puff)" />
      <Ellipse cx="290" cy="150" rx="130" ry="44" fill="url(#puff)" />
      <Ellipse cx="60" cy="210" rx="110" ry="40" fill="url(#puff)" />
    </Svg>
    </View>
  );
}
