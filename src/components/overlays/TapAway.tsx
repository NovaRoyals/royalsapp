import { useEffect, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

/** Full-screen tap target that closes a menu without covering the menu itself. */
export function TapAway({
  open,
  onClose,
  children,
  menuStyle,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  menuStyle?: ViewStyle;
}) {
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Dismiss menu" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View pointerEvents="box-none" style={[styles.slot, menuStyle]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slot: { position: 'absolute' },
});
