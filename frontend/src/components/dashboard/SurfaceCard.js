import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const shadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
      }
    : { elevation: 3 };

/**
 * Consistent card shell: shadow/elevation + hairline border. Radius, colors, padding come from `style`.
 */
export default function SurfaceCard({ children, style }) {
  return <View style={[styles.base, shadow, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
