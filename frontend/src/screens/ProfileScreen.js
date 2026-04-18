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
  Switch,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FONTS } from '../theme/typography';

// ─── Design tokens (identical to the app-wide palette) ───────────────────────
const BG     = '#16130c';
const BG2    = '#0f0d09';
const CARD   = '#221f18';
const CARD2  = '#1a1712';
const BORDER = 'rgba(77,70,54,0.35)';
const T1     = '#e9e2d5';
const T2     = '#d0c6b0';
const T3     = '#99907d';
const T4     = '#5c5647';
const GOLD   = '#f5d060';
const GOLD_DIM = 'rgba(245,208,96,0.12)';
const GOLD_MID = 'rgba(245,208,96,0.35)';
const RED_BG   = '#2d1f1f';
const RED_TEXT = '#ffb4ab';
const RED_BORDER = 'rgba(255,107,107,0.35)';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRole = (role) => {
  if (!role) return 'User';
  const map = {
    student:   'Student',
    faculty:   'Faculty',
    hod:       'Head of Department',
    principal: 'Principal',
    admin:     'Administrator',
    support:   'Support',
    club:      'Club',
  };
  return map[role] || role.charAt(0).toUpperCase() + role.slice(1);
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const InitialAvatar = ({ name, size = 76 }) => {
  const initials = (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {/* Subtle inner ring */}
      <View style={[styles.avatarInnerRing, { borderRadius: size / 2 }]} />
      <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
};

const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
    <View style={styles.sectionHeaderLine} />
  </View>
);

const InfoRow = ({ icon, label, value, last }) => (
  <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
    <View style={styles.infoRowIcon}>
      <Feather name={icon} size={14} color={GOLD} />
    </View>
    <View style={styles.infoRowContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>{value || '—'}</Text>
    </View>
  </View>
);

const ActionRow = ({ icon, label, sublabel, onPress, danger, last }) => (
  <TouchableOpacity
    style={[styles.actionRow, !last && styles.infoRowBorder]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.actionRowIcon, danger && styles.actionRowIconDanger]}>
      <Feather name={icon} size={14} color={danger ? RED_TEXT : GOLD} />
    </View>
    <View style={styles.infoRowContent}>
      <Text style={[styles.actionLabel, danger && styles.actionLabelDanger]}>{label}</Text>
      {sublabel ? <Text style={styles.actionSublabel}>{sublabel}</Text> : null}
    </View>
    <Feather name="chevron-right" size={16} color={danger ? RED_TEXT : T4} />
  </TouchableOpacity>
);

const ToggleRow = ({ icon, label, sublabel, value, onValueChange, last }) => (
  <View style={[styles.actionRow, !last && styles.infoRowBorder]}>
    <View style={styles.actionRowIcon}>
      <Feather name={icon} size={14} color={GOLD} />
    </View>
    <View style={[styles.infoRowContent, { flex: 1 }]}>
      <Text style={styles.actionLabel}>{label}</Text>
      {sublabel ? <Text style={styles.actionSublabel}>{sublabel}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#3a3426', true: GOLD_MID }}
      thumbColor={value ? GOLD : '#6b6050'}
      ios_backgroundColor="#3a3426"
    />
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [darkMode, setDarkMode]     = useState(true);

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

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.centered]} edges={['top']}>
        <ActivityIndicator size="large" color={GOLD} />
      </SafeAreaView>
    );
  }

  // ── Signed-out state ─────────────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={GOLD} />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Profile</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={[styles.centered, { flex: 1, paddingHorizontal: 32 }]}>
          <View style={styles.emptyIconWrap}>
            <Feather name="user" size={32} color={GOLD} />
          </View>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySub}>Sign in to view your profile and settings.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/')} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Go to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main profile ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Profile</Text>
        {/* Edit button placeholder — wire up as needed */}
        <TouchableOpacity style={styles.editBtn} hitSlop={12}>
          <Feather name="edit-2" size={16} color={T3} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Ambient glow behind avatar */}
          <View style={styles.avatarGlow} />
          <InitialAvatar name={user.name} size={82} />

          <Text style={styles.heroName}>{user.name || 'User'}</Text>

          <View style={styles.rolePill}>
            <MaterialCommunityIcons name="shield-account-outline" size={11} color={GOLD} style={{ marginRight: 5 }} />
            <Text style={styles.rolePillText}>{formatRole(user.role)}</Text>
          </View>

          {/* Quick stat strip */}
          <View style={styles.statStrip}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>94%</Text>
              <Text style={styles.statLabel}>Attendance</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>8.4</Text>
              <Text style={styles.statLabel}>CGPA</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>3</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        </View>

        {/* ── Account info ── */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <InfoRow icon="mail"       label="Email"        value={user.email} />
          <InfoRow icon="hash"       label="User ID"      value={user._id ? String(user._id) : '—'} />
          {user.rollNumber  ? <InfoRow icon="bookmark"  label="Roll Number"  value={user.rollNumber}  /> : null}
          {user.employeeId  ? <InfoRow icon="briefcase" label="Employee ID"  value={user.employeeId}  /> : null}
          {user.department  ? <InfoRow icon="layers"    label="Department"   value={user.department}  last /> : null}
          {!user.rollNumber && !user.employeeId && !user.department
            ? <InfoRow icon="layers" label="Department" value="—" last />
            : null}
        </View>

        {/* ── Academic ── */}
        {user.role === 'student' && (
          <>
            <SectionHeader title="Academic" />
            <View style={styles.card}>
              <InfoRow icon="book"     label="Programme"   value={user.programme  || '—'} />
              <InfoRow icon="calendar" label="Semester"    value={user.semester   ? `Semester ${user.semester}` : '—'} />
              <InfoRow icon="users"    label="Batch"       value={user.batch      || '—'} last />
            </View>
          </>
        )}

        {/* ── Preferences ── */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <ToggleRow
            icon="bell"
            label="Push notifications"
            sublabel="Alerts, announcements & reminders"
            value={notifEnabled}
            onValueChange={setNotifEnabled}
          />
          <ToggleRow
            icon="moon"
            label="Dark mode"
            sublabel="Always on for best experience"
            value={darkMode}
            onValueChange={setDarkMode}
            last
          />
        </View>

        {/* ── Quick links ── */}
        <SectionHeader title="More" />
        <View style={styles.card}>
          <ActionRow
            icon="file-text"
            label="My Requests"
            sublabel="Track leave & other submissions"
            onPress={() => router.push('/approvals')}
          />
          <ActionRow
            icon="bell"
            label="Notification History"
            sublabel="Past alerts and notices"
            onPress={() => router.push('/notifications')}
          />
          <ActionRow
            icon="shield"
            label="Privacy & Security"
            onPress={() => {}}
            last
          />
        </View>

        {/* ── Danger zone ── */}
        <SectionHeader title="Session" />
        <View style={styles.card}>
          <ActionRow
            icon="log-out"
            label="Sign out"
            sublabel="You'll be returned to the login screen"
            onPress={signOut}
            danger
            last
          />
        </View>

        {/* App version tag */}
        <View style={styles.versionWrap}>
          <Text style={styles.versionText}>Aether Campus · v1.0.0</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: BG },
  centered:{ justifyContent: 'center', alignItems: 'center' },

  // ── Top bar ──
  topBar: {
    flexDirection:      'row',
    alignItems:         'center',
    justifyContent:     'space-between',
    paddingHorizontal:  16,
    paddingTop:         Platform.OS === 'ios' ? 4 : 10,
    paddingBottom:      14,
    borderBottomWidth:  StyleSheet.hairlineWidth,
    borderBottomColor:  '#2d2a22',
    backgroundColor:    BG2,
  },
  backBtn:   { padding: 4 },
  editBtn:   { padding: 4 },
  pageTitle: { fontFamily: FONTS.bold, fontSize: 20, color: GOLD },

  // ── Hero ──
  hero: {
    alignItems:    'center',
    paddingTop:    28,
    paddingBottom: 8,
    marginBottom:  8,
  },
  // Diffuse gold ambient behind avatar
  avatarGlow: {
    position:        'absolute',
    top:             14,
    width:           130,
    height:          130,
    borderRadius:    65,
    backgroundColor: 'rgba(245,208,96,0.07)',
  },
  avatar: {
    backgroundColor: GOLD_DIM,
    borderWidth:     2,
    borderColor:     GOLD,
    justifyContent:  'center',
    alignItems:      'center',
    overflow:        'hidden',
  },
  avatarInnerRing: {
    position:    'absolute',
    top: 3, left: 3, right: 3, bottom: 3,
    borderWidth: 1,
    borderColor: GOLD_MID,
  },
  avatarText: { fontFamily: FONTS.bold, color: GOLD, zIndex: 1 },

  heroName: {
    fontFamily: FONTS.semibold,
    fontSize:   22,
    color:      T1,
    marginTop:  14,
    textAlign:  'center',
  },
  rolePill: {
    marginTop:        8,
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  GOLD_DIM,
    paddingHorizontal: 14,
    paddingVertical:  6,
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      GOLD_MID,
  },
  rolePillText: { fontFamily: FONTS.medium, fontSize: 12, color: GOLD },

  // Quick stat strip
  statStrip: {
    flexDirection:    'row',
    alignItems:       'center',
    marginTop:        22,
    backgroundColor:  CARD,
    borderRadius:     16,
    borderWidth:      1,
    borderColor:      BORDER,
    paddingVertical:  14,
    paddingHorizontal: 10,
    width:            '90%',
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FONTS.bold,   fontSize: 18, color: GOLD,  letterSpacing: 0.4 },
  statLabel: { fontFamily: FONTS.medium, fontSize: 10, color: T3,    marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.6 },
  statDivider: { width: 1, height: 32, backgroundColor: BORDER },

  // ── Section header ──
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    marginTop:      24,
    marginBottom:   10,
    paddingHorizontal: 2,
  },
  sectionHeaderText: {
    fontFamily:    FONTS.semibold,
    fontSize:      11,
    color:         T3,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginRight:   10,
  },
  sectionHeaderLine: {
    flex:            1,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },

  // ── Card ──
  card: {
    backgroundColor: CARD,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     BORDER,
    overflow:        'hidden',
  },

  // ── Info row ──
  infoRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap:            12,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  infoRowIcon: {
    width:           28,
    height:          28,
    borderRadius:    8,
    backgroundColor: GOLD_DIM,
    justifyContent:  'center',
    alignItems:      'center',
  },
  infoRowContent: { flex: 1 },
  infoLabel: {
    fontFamily:    FONTS.medium,
    fontSize:      10,
    color:         T3,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom:  3,
  },
  infoValue: {
    fontFamily: FONTS.regular,
    fontSize:   14,
    color:      T1,
    lineHeight: 20,
  },

  // ── Action row ──
  actionRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap:            12,
  },
  actionRowIcon: {
    width:           28,
    height:          28,
    borderRadius:    8,
    backgroundColor: GOLD_DIM,
    justifyContent:  'center',
    alignItems:      'center',
  },
  actionRowIconDanger: {
    backgroundColor: 'rgba(255,107,107,0.10)',
  },
  actionLabel: {
    fontFamily: FONTS.medium,
    fontSize:   14,
    color:      T1,
  },
  actionLabelDanger: { color: RED_TEXT },
  actionSublabel: {
    fontFamily: FONTS.regular,
    fontSize:   11,
    color:      T3,
    marginTop:  2,
  },

  // ── Version ──
  versionWrap: { alignItems: 'center', marginTop: 24 },
  versionText: { fontFamily: FONTS.medium, fontSize: 11, color: T4, letterSpacing: 0.6 },

  // ── Empty / signed-out ──
  emptyIconWrap: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: GOLD_DIM,
    borderWidth:     1,
    borderColor:     GOLD_MID,
    justifyContent:  'center',
    alignItems:      'center',
    marginBottom:    20,
  },
  emptyTitle: {
    fontFamily: FONTS.semibold,
    fontSize:   18,
    color:      T1,
    marginBottom: 8,
    textAlign:  'center',
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize:   14,
    color:      T3,
    textAlign:  'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor:  GOLD,
    paddingHorizontal: 28,
    paddingVertical:  13,
    borderRadius:     12,
  },
  primaryBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: BG },

  // ── Scroll ──
  scroll: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 20 },
});