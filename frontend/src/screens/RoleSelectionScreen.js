import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Button from '../components/Button';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';

const roles = [
  { id: 'student', title: 'Student', description: 'Access courses, schedules, and campus life.', icon: 'book' },
  { id: 'faculty', title: 'Faculty', description: 'Manage classes, grading, and department info.', icon: 'briefcase' },
  { id: 'admin', title: 'Admin', description: 'System oversight and institutional management.', icon: 'shield' }
];

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState('student');

  return (
    <View style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Select Your Role</Text>
          <Text style={styles.subtitle}>Choose your primary account type to continue.</Text>
        </View>

        <View style={styles.cardsContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role.id}
              style={[
                styles.card,
                selectedRole === role.id && styles.cardSelected
              ]}
              onPress={() => setSelectedRole(role.id)}
              activeOpacity={0.8}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10
              }}>
              <View style={[styles.iconContainer, selectedRole === role.id && styles.iconContainerSelected]}>
                <Feather name={role.icon} size={22} color={selectedRole === role.id ? COLORS.gold : COLORS.muted} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{role.title}</Text>
                <Text style={styles.cardDescription}>{role.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Button 
          title="CONTINUE" 
          onPress={() => router.push({ pathname: '/login', params: { role: selectedRole } })} 
          style={styles.button} 
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? 64 : 88 },
  container: {
    flexGrow: 1,
    padding: SPACING.xl,
    paddingTop: SPACING.xl * 2,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.hero,
    fontSize: 32,
    color: COLORS.gold,
    marginBottom: SPACING.small,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.surface2,
    borderRadius: 16,
    padding: SPACING.large,
    marginBottom: SPACING.medium,
    alignItems: 'center',
  },
  cardSelected: {
    borderColor: COLORS.gold,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.medium,
  },
  iconContainerSelected: {
    backgroundColor: 'rgba(245, 208, 96, 0.1)', 
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.white,
    fontSize: 18,
    marginBottom: 4,
  },
  cardDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.large,
  }
});
