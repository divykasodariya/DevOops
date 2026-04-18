import React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const SPRING = { damping: 16, stiffness: 380, mass: 0.4 };

/**
 * Subtle scale-down on press (≈0.96). Keeps dark + gold styling; no extra deps.
 */
export default function PressableScale({
  children,
  style,
  contentStyle,
  onPress,
  disabled,
  scaleTo = 0.96,
  accessibilityLabel,
  hitSlop,
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(scaleTo, SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING);
      }}
      onPress={onPress}
    >
      <Animated.View style={[style, animatedStyle, contentStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
