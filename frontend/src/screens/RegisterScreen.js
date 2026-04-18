import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import InputField from '../components/InputField';
import Button from '../components/Button';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';
import { API_BASE } from '../config/api';

export default function RegisterScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams();
  
  // General Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Faculty Fields
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [researchInterests, setResearchInterests] = useState('');
  const [teachingAreas, setTeachingAreas] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isFaculty = role === 'faculty';

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all general fields.');
      return;
    }
    
    if (isFaculty) {
      if (!department.trim() || !position.trim()) {
         setError('Please fill in Department and Position.');
         return;
      }
    }

    setError('');
    setLoading(true);

    try {
      // Step 1: Register User
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim().toLowerCase(), 
          password,
          role: role || 'student'
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      // Save user and token to AsyncStorage
      await AsyncStorage.setItem('user', JSON.stringify(data));
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
      }

      // Step 2: If Faculty, set up profile
      if (isFaculty && data.token) {
         const profRes = await fetch(`${API_BASE}/prof/setup`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.token}`
            },
            body: JSON.stringify({
               department: department.trim(),
               position: position.trim(),
               researchInterests: researchInterests.split(',').map(s => s.trim()).filter(Boolean),
               teachingAreas: teachingAreas.split(',').map(s => s.trim()).filter(Boolean)
            })
         });
         
         const profData = await profRes.json();
         if (!profRes.ok) {
           setError('User created but profile setup failed: ' + (profData.message || 'Error'));
           setLoading(false);
           return;
         }
      }

      // Role-based routing
      const userRole = data.role || role || 'student';
      if (userRole === 'faculty' || userRole === 'hod') {
        router.replace('/faculty-dashboard');
      } else if (userRole === 'admin' || userRole === 'principal') {
        router.replace('/admin-dashboard');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Registering as a <Text style={styles.highlight}>{role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Student'}</Text>
              </Text>
            </View>

            <View style={styles.formCard}>
              <InputField
                label="Full Name"
                value={name}
                onChangeText={(text) => { setName(text); setError(''); }}
                placeholder="John Doe"
                icon="user"
                error={!!error}
              />

              <InputField
                label="Email Address"
                value={email}
                onChangeText={(text) => { setEmail(text); setError(''); }}
                placeholder="john@university.edu"
                keyboardType="email-address"
                icon="mail"
                error={!!error}
              />

              <InputField
                label="Password"
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
                placeholder="••••••••"
                secureTextEntry
                icon="lock"
                error={!!error}
              />

              {isFaculty && (
                <>
                  <View style={styles.dividerContainer}>
                    <View style={styles.divider} />
                    <Text style={styles.dividerText}>FACULTY DETAILS</Text>
                    <View style={styles.divider} />
                  </View>

                  <InputField
                    label="Department"
                    value={department}
                    onChangeText={(text) => { setDepartment(text); setError(''); }}
                    placeholder="e.g. CSE"
                    icon="briefcase"
                    error={!!error}
                  />

                  <InputField
                    label="Position"
                    value={position}
                    onChangeText={(text) => { setPosition(text); setError(''); }}
                    placeholder="e.g. Associate Professor"
                    icon="award"
                    error={!!error}
                  />

                  <InputField
                    label="Research Interests"
                    value={researchInterests}
                    onChangeText={setResearchInterests}
                    placeholder="e.g. AI, Machine Learning"
                    icon="search"
                  />

                  <InputField
                    label="Teaching Areas"
                    value={teachingAreas}
                    onChangeText={setTeachingAreas}
                    placeholder="e.g. DSA, Operating Systems"
                    icon="book-open"
                  />
                </>
              )}

              {error ? (
                 <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={14} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                 </View>
              ) : null}

              <Button
                title="Create Account"
                onPress={handleRegister}
                loading={loading}
                style={styles.loginButton}
              />

              <TouchableOpacity 
                style={styles.ssoButton} 
                activeOpacity={0.8}
                onPress={() => router.back()}
              >
                <Text style={styles.ssoButtonText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  container: {
    paddingHorizontal: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.hero,
    fontSize: 28,
    color: COLORS.gold,
    marginBottom: SPACING.small,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white, 
  },
  highlight: {
    color: COLORS.gold,
    fontFamily: FONTS.bold,
  },
  formCard: {
    backgroundColor: COLORS.surface1,
    borderRadius: 20,
    padding: SPACING.large,
    borderWidth: 1,
    borderColor: COLORS.surface2,
  },
  loginButton: {
    marginTop: SPACING.medium,
    marginBottom: SPACING.large,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.large,
    marginTop: SPACING.medium,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.surface2,
  },
  dividerText: {
    ...TYPOGRAPHY.label,
    color: COLORS.muted,
    paddingHorizontal: SPACING.medium,
  },
  ssoButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.surface2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ssoButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.body.fontSize,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.medium,
  },
  errorText: {
    ...TYPOGRAPHY.label,
    color: COLORS.error,
    marginLeft: 6,
    textTransform: 'none',
  }
});
