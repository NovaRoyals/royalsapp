import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { LIGHT_TILES_A, PIN_BUSY, PIN_CLEAR, PIN_GOLD, PIN_INK, type PitchMapProps } from '@/components/fields/mapTypes';
import { CHANTILLY } from '@/lib/pitchCoords';

function zoomFromLongitudeDelta(delta: number) {
  return Math.round(Math.log2(360 / Math.max(delta, 0.001)));
}

function GlowPin({
  color,
  large,
  pulse,
  reducedMotion,
  venue,
  sub,
  showVenue,
  showSub,
}: {
  color: string;
  large: boolean;
  pulse: boolean;
  reducedMotion?: boolean;
  venue: string;
  sub: string;
  showVenue: boolean;
  showSub: boolean;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!pulse || reducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withRepeat(withTiming(1.45, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, reducedMotion, scale]);
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.pin} pointerEvents="none">
      {showVenue || showSub ? (
        <View style={styles.label}>
          {showVenue ? <Text numberOfLines={1} style={styles.labelText}>{venue}</Text> : null}
          {showSub ? <Text numberOfLines={1} style={styles.subText}>{sub}</Text> : null}
        </View>
      ) : null}
      <View style={styles.stack}>
        <Animated.View style={[styles.glow, { backgroundColor: large ? PIN_GOLD : color }, pulse ? glowStyle : null]} />
        <View
          style={[
            styles.dot,
            large && styles.dotLg,
            { backgroundColor: color, borderColor: large ? PIN_GOLD : '#fff' },
          ]}
        />
      </View>
    </View>
  );
}

export default function PitchMap({
  pitches,
  selectedId,
  topPickId,
  reducedMotion,
  frameKey,
  flyNonce,
  onSelect,
}: PitchMapProps) {
  const mapRef = useRef<ComponentRef<typeof MapView>>(null);
  const skipFly = useRef(true);
  const [zoom, setZoom] = useState(11);
  const start = useMemo(
    () => pitches.find((item) => item.id === topPickId) ?? pitches[0],
    [pitches, topPickId],
  );

  useEffect(() => {
    skipFly.current = true;
    const target = pitches.find((item) => item.id === topPickId) ?? pitches[0];
    if (!target) return;
    mapRef.current?.animateToRegion(
      { latitude: target.lat, longitude: target.lng, latitudeDelta: 0.38, longitudeDelta: 0.38 },
      reducedMotion ? 0 : 400,
    );
  }, [frameKey, pitches, reducedMotion, topPickId]);

  useEffect(() => {
    if (skipFly.current) {
      skipFly.current = false;
      return;
    }
    const pitch = pitches.find((item) => item.id === selectedId);
    if (!pitch) return;
    const delta = Math.min(0.08, 360 / 2 ** Math.max(zoom, 13));
    mapRef.current?.animateToRegion(
      { latitude: pitch.lat, longitude: pitch.lng, latitudeDelta: delta, longitudeDelta: delta },
      reducedMotion ? 0 : 500,
    );
  }, [flyNonce, pitches, reducedMotion, selectedId]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={{
        latitude: start?.lat ?? CHANTILLY.lat,
        longitude: start?.lng ?? CHANTILLY.lng,
        latitudeDelta: 0.38,
        longitudeDelta: 0.38,
      }}
      onRegionChangeComplete={(region) => {
        setZoom(zoomFromLongitudeDelta(region.longitudeDelta));
      }}
      mapType="none"
    >
      <UrlTile urlTemplate={LIGHT_TILES_A} maximumZ={16} zIndex={0} />
      {pitches.map((pitch) => {
        const selected = pitch.id === selectedId;
        const top = pitch.id === topPickId;
        const color = pitch.status === 'conflict' ? PIN_BUSY : PIN_CLEAR;
        const showVenue = pitch.isVenueLabel || selected || top;
        const showSub = zoom >= 15 || selected || top;
        return (
          <Marker
            key={pitch.id}
            coordinate={{ latitude: pitch.lat, longitude: pitch.lng }}
            onPress={() => onSelect(pitch.id)}
            tracksViewChanges
            zIndex={selected ? 20 : top ? 10 : 1}
            anchor={{ x: 0.5, y: 1 }}
          >
            <GlowPin
              color={color}
              large={selected || top}
              pulse={top}
              reducedMotion={reducedMotion}
              venue={pitch.name}
              sub={pitch.pitch}
              showVenue={showVenue}
              showSub={showSub}
            />
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#F3F5F3' },
  pin: { alignItems: 'center' },
  label: {
    backgroundColor: PIN_INK,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    maxWidth: 150,
  },
  labelText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  subText: { color: 'rgba(255,255,255,0.88)', fontSize: 10, fontWeight: '600' },
  stack: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 28, height: 28, borderRadius: 14, opacity: 0.28 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#fff' },
  dotLg: { width: 24, height: 24, borderRadius: 12 },
});
