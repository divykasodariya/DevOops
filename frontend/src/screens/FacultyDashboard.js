import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { FONTS, TYPOGRAPHY } from '../theme/typography';
import { SPACING } from '../theme/spacing';

export default function FacultyDashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👨‍🏫</Text>
      <Text style={styles.title}>Faculty Dashboard</Text>
      <Text style={styles.subtitle}>Welcome back, Professor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: SPACING.medium,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.white,
    marginBottom: SPACING.small,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
});
