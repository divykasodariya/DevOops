import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { FONTS } from '../theme/typography';

const BG = '#16130c';
const CARD = '#221f18';
const BORDER = 'rgba(77,70,54,0.35)';
const T1 = '#e9e2d5';
const T2 = '#d0c6b0';
const T3 = '#99907d';
const GOLD = '#f5d060';

const formatRole = (role) => {
  if (!role) return 'User';
  const map = {
    student: 'Student',
    faculty: 'Faculty',
    hod: 'Head of Department',
    principal: 'Principal',
    admin: 'Administrator',
    support: 'Support',
    club: 'Club',
  };
  return map[role] || role.charAt(0).toUpperCase() + role.slice(1);
};

const InitialAvatar = ({ name, size = 72 }) => {
  const initials = (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(245,208,96,0.12)',
        borderWidth: 2,
        borderColor: GOLD,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: FONTS.bold, fontSize: size * 0.32, color: GOLD }}>{initials}</Text>
    </View>
  );
};

const InfoRow = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} selectable>
      {value || '—'}
    </Text>
  </View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadUser();
    }, [])
  );

  const signOut = () => {
    Alert.alert('Sign out', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['user', 'token']);
          router.replace('/');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.safe, styles.centered]}>
        <ActivityIndicator size="large" color={GOLD} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={GOLD} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Profile</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={[styles.centered, { flex: 1, paddingHorizontal: 24 }]}>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySub}>Sign in to view your profile.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Go to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <InitialAvatar name={user.name} size={76} />
          <Text style={styles.name}>{user.name || 'User'}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{formatRole(user.role)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="User ID" value={user._id ? String(user._id) : '—'} />
          {user.rollNumber ? <InfoRow label="Roll number" value={user.rollNumber} /> : null}
          {user.employeeId ? <InfoRow label="Employee ID" value={user.employeeId} /> : null}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.85}>
          <Feather name="log-out" size={18} color="#ffb4ab" />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  centered: { justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2d2a22',
  },
  backBtn: { padding: 4 },
  pageTitle: { fontFamily: FONTS.bold, fontSize: 20, color: GOLD },
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  hero: { alignItems: 'center', marginBottom: 24 },
  name: { fontFamily: FONTS.semibold, fontSize: 22, color: T1, marginTop: 14, textAlign: 'center' },
  rolePill: {
    marginTop: 10,
    backgroundColor: 'rgba(245,208,96,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,208,96,0.35)',
  },
  rolePillText: { fontFamily: FONTS.medium, fontSize: 12, color: GOLD },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
  },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 15, color: T2, marginBottom: 14 },
  row: { marginBottom: 14 },
  rowLabel: { fontFamily: FONTS.medium, fontSize: 11, color: T3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  rowValue: { fontFamily: FONTS.regular, fontSize: 15, color: T1, lineHeight: 22 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2d1f1f',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.35)',
  },
  signOutText: { fontFamily: FONTS.semibold, fontSize: 15, color: '#ffb4ab' },
  emptyTitle: { fontFamily: FONTS.semibold, fontSize: 18, color: T1, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontFamily: FONTS.regular, fontSize: 14, color: T3, textAlign: 'center', marginBottom: 20 },
  primaryBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: BG },
});
