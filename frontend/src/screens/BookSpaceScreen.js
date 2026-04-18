import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const BG = '#121212';
const INPUT_BG = '#2A241E';
const BORDER = 'rgba(77,70,54,0.45)';
const T1 = '#FFFFFF';
const T2 = '#A89070';
const T3 = '#8a7d6a';
const GOLD = '#F5D060';
const GOLD_D = '#e7c355';
const ERROR = '#e8a0a8';
const NAV_BG = '#0c0a07';

/** Room codes must stay consistent for clash detection across bookings */
const SPACES = [
  { label: 'Main Library - Study Room A (4 persons)', room: 'LIB-STUDY-A' },
  { label: 'Main Library - Study Room B (6 persons)', room: 'LIB-STUDY-B' },
  { label: 'Library — Quiet Nook (2 persons)', room: 'LIB-NOOK-2' },
  { label: 'Student Center — Rehearsal Room 1', room: 'SC-REH-1' },
  { label: 'Engineering Building — Study Pod E-104', room: 'ENG-POD-104' },
];

const NAV_H = Platform.OS === 'ios' ? 84 : 66;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** @param {Date} day - date at local midnight */
function combineDateTime(day, hours, minutes) {
  const x = new Date(day);
  x.setHours(hours, minutes, 0, 0);
  return x;
}

function formatDisplayTime(h, m) {
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const timeOptions = (() => {
  const out = [];
  for (let h = 8; h <= 17; h += 1) {
    for (const m of [0, 30]) {
      if (h === 17 && m === 30) break;
      out.push({ h, m, label: formatDisplayTime(h, m) });
    }
  }
  return out;
})();

const InitialAvatar = ({ name, size = 40 }) => {
  const initials = (name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
};

export default function BookSpaceScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [spaceIndex, setSpaceIndex] = useState(0);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [startT, setStartT] = useState({ h: 14, m: 0 });
  const [endT, setEndT] = useState({ h: 16, m: 0 });
  const [timeMode, setTimeMode] = useState(null);
  const [purpose, setPurpose] = useState('');
  const [conflict, setConflict] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const space = SPACES[spaceIndex];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const homeRoute =
    user?.role === 'faculty' || user?.role === 'hod'
      ? '/faculty-dashboard'
      : user?.role === 'admin' || user?.role === 'principal'
        ? '/admin-dashboard'
        : '/dashboard';

  const startAt = useMemo(
    () => combineDateTime(selectedDay, startT.h, startT.m),
    [selectedDay, startT.h, startT.m]
  );
  const endAt = useMemo(
    () => combineDateTime(selectedDay, endT.h, endT.m),
    [selectedDay, endT.h, endT.m]
  );

  const invalidRange = endAt <= startAt;

  useEffect(() => {
    AsyncStorage.getItem('user').then((raw) => {
      if (raw) setUser(JSON.parse(raw));
    });
  }, []);

  const runConflictCheck = useCallback(async () => {
    if (invalidRange) {
      setConflict(false);
      return;
    }
    if (!space?.room) {
      setConflict(false);
      return;
    }
    try {
      setChecking(true);
      const token = await AsyncStorage.getItem('token');
      const qs = new URLSearchParams({
        room: space.room,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
      });
      const res = await fetch(`${API_BASE}/schedule/conflicts?${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setConflict(false);
        return;
      }
      setConflict(Boolean(data.hasConflict));
    } catch {
      setConflict(false);
    } finally {
      setChecking(false);
    }
  }, [space?.room, startAt, endAt, invalidRange, endT.h, startT.h]);

  useEffect(() => {
    const t = setTimeout(runConflictCheck, 350);
    return () => clearTimeout(t);
  }, [runConflictCheck]);

  const nextDays = useMemo(() => {
    const list = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 60; i += 1) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      list.push(d);
    }
    return list;
  }, []);

  const handleConfirm = async () => {
    if (invalidRange) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }
    if (conflict) {
      Alert.alert('Conflict', 'This room is already booked for part of that window. Adjust your times.');
      return;
    }
    if (!user?._id) {
      Alert.alert('Session', 'Please sign in again.');
      return;
    }

    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('token');
      const title =
        purpose.trim() ||
        `${SPACES[spaceIndex].label.split('—')[0].trim()} booking`;

      const body = {
        title,
        type: 'room_booking',
        room: space.room,
        start: startAt.toISOString(),
        end: endAt.toISOString(),
        audience: 'user',
        audienceIds: [user._id],
      };
      if (user.department) body.department = user.department;

      const res = await fetch(`${API_BASE}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Booking failed');
      }

      if (data.warning || (data.clashes && data.clashes.length)) {
        Alert.alert(
          'Booking saved with overlap',
          data.warning ||
            'Another booking overlaps this slot. Check your schedule or pick different times.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      Alert.alert('Booked', 'Your space reservation is confirmed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not complete booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backTop} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={GOLD} />
          </TouchableOpacity>
          <View style={styles.topBarL}>
            <InitialAvatar name={user?.name} size={40} />
            <Text style={styles.greet}>
              {greeting}, {firstName}
            </Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/alerts')} hitSlop={12}>
            <Feather name="bell" size={20} color={T1} />
          </TouchableOpacity>
        </View>

        <Text style={styles.pageTitle}>Book a Space</Text>
        <Text style={styles.pageSub}>
          Reserve study rooms, library nooks, or rehearsal spaces across campus.
        </Text>

        <Text style={styles.label}>SELECT SPACE</Text>
        <TouchableOpacity style={styles.selectRow} onPress={() => setSpaceOpen(true)} activeOpacity={0.85}>
          <Text style={styles.selectText} numberOfLines={2}>
            {space.label}
          </Text>
          <Feather name="chevron-down" size={20} color={T2} />
        </TouchableOpacity>

        <Text style={styles.label}>DATE</Text>
        <TouchableOpacity style={styles.selectRow} onPress={() => setDateOpen(true)} activeOpacity={0.85}>
          <Text style={styles.selectText}>
            {selectedDay.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Feather name="calendar" size={18} color={T2} />
        </TouchableOpacity>

        <Text style={styles.label}>START TIME</Text>
        <TouchableOpacity style={styles.selectRow} onPress={() => setTimeMode('start')} activeOpacity={0.85}>
          <Text style={styles.selectText}>{formatDisplayTime(startT.h, startT.m)}</Text>
          <Feather name="clock" size={18} color={T2} />
        </TouchableOpacity>

        <Text style={styles.label}>END TIME</Text>
        <TouchableOpacity
          style={[styles.selectRow, (conflict || invalidRange) && styles.selectRowError]}
          onPress={() => setTimeMode('end')}
          activeOpacity={0.85}
        >
          <Text style={styles.selectText}>{formatDisplayTime(endT.h, endT.m)}</Text>
          <Feather name="clock" size={18} color={T2} />
        </TouchableOpacity>
        {(conflict || invalidRange) && (
          <Text style={styles.errorHint}>
            {invalidRange ? 'End time must be after start time.' : 'Conflict with existing booking'}
          </Text>
        )}
        {checking && !invalidRange && <Text style={styles.checking}>Checking availability…</Text>}

        <Text style={styles.label}>PURPOSE (OPTIONAL)</Text>
        <TextInput
          style={styles.textarea}
          placeholder="E.g., Group study for Finals, Rehearsal..."
          placeholderTextColor={T3}
          value={purpose}
          onChangeText={setPurpose}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          activeOpacity={0.9}
          disabled={submitting || conflict || invalidRange}
          onPress={handleConfirm}
          style={[styles.ctaWrap, (submitting || conflict || invalidRange) && styles.ctaDisabled]}
        >
          <LinearGradient colors={[GOLD_D, GOLD]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGrad}>
            {submitting ? (
              <ActivityIndicator color={BG} />
            ) : (
              <Text style={styles.ctaText}>Confirm Booking</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: NAV_H + 24 }} />
      </ScrollView>

      <View style={styles.nav}>
        <TouchableOpacity style={styles.navI} onPress={() => router.replace(homeRoute)}>
          <Feather name="home" size={20} color={T3} />
          <Text style={styles.navL}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navI} onPress={() => router.replace('/schedule')}>
          <Feather name="calendar" size={20} color={GOLD} />
          <Text style={[styles.navL, styles.navLActive]}>SCHEDULE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navI} onPress={() => router.push('/ai-assistant')}>
          <MaterialCommunityIcons name="robot-outline" size={22} color={T3} />
          <Text style={styles.navL}>AI ASSISTANT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navI} onPress={() => router.push('/alerts')}>
          <Feather name="bell" size={20} color={T3} />
          <Text style={styles.navL}>ALERTS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navI}>
          <Feather name="user" size={20} color={T3} />
          <Text style={styles.navL}>PROFILE</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={spaceOpen} animationType="slide" transparent onRequestClose={() => setSpaceOpen(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalFill} activeOpacity={1} onPress={() => setSpaceOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select space</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {SPACES.map((s, i) => (
                <TouchableOpacity
                  key={s.room}
                  style={[styles.modalRow, i === spaceIndex && styles.modalRowOn]}
                  onPress={() => {
                    setSpaceIndex(i);
                    setSpaceOpen(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={dateOpen} animationType="slide" transparent onRequestClose={() => setDateOpen(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalFill} activeOpacity={1} onPress={() => setDateOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select date</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {nextDays.map((d) => {
                const active = toDateKey(d) === toDateKey(selectedDay);
                return (
                  <TouchableOpacity
                    key={toDateKey(d)}
                    style={[styles.modalRow, active && styles.modalRowOn]}
                    onPress={() => {
                      setSelectedDay(d);
                      setDateOpen(false);
                    }}
                  >
                    <Text style={styles.modalRowText}>
                      {d.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={timeMode !== null} animationType="slide" transparent onRequestClose={() => setTimeMode(null)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalFill} activeOpacity={1} onPress={() => setTimeMode(null)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{timeMode === 'start' ? 'Start time' : 'End time'}</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {timeOptions.map((opt) => (
                <TouchableOpacity
                  key={`${opt.h}-${opt.m}`}
                  style={styles.modalRow}
                  onPress={() => {
                    if (timeMode === 'start') setStartT({ h: opt.h, m: opt.m });
                    else setEndT({ h: opt.h, m: opt.m });
                    setTimeMode(null);
                  }}
                >
                  <Text style={styles.modalRowText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 8 : 16, paddingBottom: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingTop: 8,
    gap: 8,
  },
  backTop: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  topBarL: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  greet: { fontFamily: FONTS.semibold, fontSize: 17, color: GOLD, flexShrink: 1 },
  bellBtn: { padding: 8 },
  avatar: {
    backgroundColor: 'rgba(245,208,96,0.12)',
    borderWidth: 1.2,
    borderColor: GOLD_D,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: FONTS.bold, color: GOLD },
  pageTitle: { fontFamily: FONTS.bold, fontSize: 32, color: T1, marginBottom: 8 },
  pageSub: { fontFamily: FONTS.regular, fontSize: 15, color: T2, lineHeight: 22, marginBottom: 24 },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: T2,
    marginBottom: 8,
    marginTop: 4,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 6,
    gap: 12,
  },
  selectRowError: { borderColor: ERROR },
  selectText: { flex: 1, fontFamily: FONTS.medium, fontSize: 15, color: T1 },
  errorHint: { fontFamily: FONTS.medium, fontSize: 13, color: ERROR, marginBottom: 8, marginTop: 2 },
  checking: { fontFamily: FONTS.regular, fontSize: 12, color: T3, marginBottom: 8 },
  textarea: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 100,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: T1,
    marginBottom: 28,
  },
  ctaWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  ctaDisabled: { opacity: 0.45 },
  ctaGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: FONTS.bold, fontSize: 17, color: BG },
  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: NAV_H,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: NAV_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1e1b14',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  navI: { alignItems: 'center', gap: 2, minWidth: 52 },
  navL: { fontFamily: FONTS.medium, fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: 'uppercase' },
  navLActive: { color: GOLD },
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalFill: { flex: 1 },
  modalSheet: {
    backgroundColor: INPUT_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '72%',
  },
  modalTitle: { fontFamily: FONTS.bold, fontSize: 18, color: T1, marginBottom: 12 },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  modalRowOn: { backgroundColor: 'rgba(245,208,96,0.12)' },
  modalRowText: { fontFamily: FONTS.medium, fontSize: 15, color: T1 },
});
