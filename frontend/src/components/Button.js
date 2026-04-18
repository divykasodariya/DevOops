import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';

export default function Button({ title, onPress, variant = 'primary', loading = false, style }) {
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.outline,
        style,
      ]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? COLORS.background : COLORS.gold} />
      ) : (
        <Text
          style={[
            styles.text,
            { color: isPrimary ? COLORS.background : COLORS.gold },
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.large,
  },
  primary: {
    backgroundColor: COLORS.gold,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.surface2,
  },
  text: {
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.body.fontSize,
  },
});
