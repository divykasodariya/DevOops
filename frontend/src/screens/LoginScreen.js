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
import InputField from '../components/InputField';
import Button from '../components/Button';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';
import { API_BASE } from '../config/api';

export default function LoginScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Incorrect password. Please try again.');
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem('user', JSON.stringify(data));

      router.replace('/dashboard');
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
              <Text style={styles.title}>Aether</Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </View>

            <View style={styles.formCard}>
              <InputField
                label="Email Address"
                value={email}
                onChangeText={(text) => { setEmail(text); setError(''); }}
                placeholder="julian@university.edu"
                keyboardType="email-address"
                icon="mail"
                error={!!error}
              />

              <View style={styles.passwordHeader}>
                <Text style={styles.label}>PASSWORD</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotText}>Forgot?</Text>
                </TouchableOpacity>
              </View>
              
              <InputField
                value={password}
                onChangeText={(text) => { setPassword(text); setError(''); }}
                placeholder="••••••••"
                secureTextEntry
                icon="lock"
                error={!!error}
                errorMessage={error}
              />

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={loading}
                style={styles.loginButton}
              />

              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity 
                style={styles.ssoButton} 
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/register', params: { role } })}
              >
                <Text style={styles.ssoButtonText}>Sign Up</Text>
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
  },
  container: {
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.hero,
    color: COLORS.gold,
    marginBottom: SPACING.small,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white, // Match design
  },
  formCard: {
    backgroundColor: COLORS.surface1,
    borderRadius: 20,
    padding: SPACING.large,
    borderWidth: 1,
    borderColor: COLORS.surface2,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.small,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  forgotText: {
    ...TYPOGRAPHY.label,
    color: COLORS.gold,
    textTransform: 'none',
  },
  loginButton: {
    marginTop: SPACING.medium,
    marginBottom: SPACING.large,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.large,
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
    backgroundColor: COLORS.surface2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ssoButtonText: {
    fontFamily: FONTS.semibold,
    fontSize: TYPOGRAPHY.body.fontSize,
    color: COLORS.gold,
  }
});