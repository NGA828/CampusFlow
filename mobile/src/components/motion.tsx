import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Start conservatively: no motion until the user's OS preference has been read. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => { /* Keep the conservative no-motion default. */ });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  return reduced;
}

export function ScreenEntrance({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  useFocusEffect(useCallback(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => { animation.stop(); progress.setValue(1); };
  }, [progress, reduced]));
  return <Animated.View testID="screen-entrance" style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>{children}</Animated.View>;
}

export function ScanSweep({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || reduced) { value.setValue(0.5); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(value, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [active, reduced, value]);
  if (!active) return null;
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: 36, right: 36, height: 2, backgroundColor: '#9ce6d6', top: value.interpolate({ inputRange: [0, 1], outputRange: ['22%', '78%'] }) }} />;
}
