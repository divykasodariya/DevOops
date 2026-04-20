import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const BG = '#16130c';
const CARD = '#221f18';
const BORDER = 'rgba(77,70,54,0.35)';
const GOLD = '#f5d060';
const TEXT = '#e9e2d5';
const MUTED = '#9a9280';
const STATUSES = ['present', 'absent', 'late', 'od'];

const localDateYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function MarkAttendanceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [dateStr, setDateStr] = useState(localDateYmd);
  const [rows, setRows] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchHits, setSearchHits] = useState([]);

  const apiHeaders = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, []);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await apiHeaders();
      const res = await fetch(`${API_BASE}/courses/for-attendance`, { headers });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || 'Could not load courses');
      }
      const list = Array.isArray(data) ? data : [];
      setCourses(list);
      setCourseId((prev) => prev || (list[0] ? String(list[0]._id) : ''));
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [apiHeaders]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c._id) === String(courseId)),
    [courses, courseId]
  );

  useEffect(() => {
    if (!selectedCourse) {
      setRows([]);
      return;
    }
    const enrolled = Array.isArray(selectedCourse.enrolledStudents)
      ? selectedCourse.enrolledStudents
      : [];
    setRows(
      enrolled.map((s) => ({
        student: s,
        status: 'present',
      }))
    );
  }, [selectedCourse]);

  const runSearch = async () => {
    const q = searchQ.trim();
    if (q.length < 2) {
      Alert.alert('Search', 'Type at least 2 characters (name, email, or roll number).');
      return;
    }
    setSearching(true);
    try {
      const headers = await apiHeaders();
      const res = await fetch(
        `${API_BASE}/courses/for-attendance/roster-search?q=${encodeURIComponent(q)}`,
        { headers }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || 'Search failed');
      setSearchHits(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Search', e.message || 'Failed');
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  };

  const addStudent = (student) => {
    const id = String(student._id);
    if (rows.some((r) => String(r.student._id) === id)) {
      Alert.alert('Already added', `${student.name} is already on this list.`);
      return;
    }
    setRows((prev) => [...prev, { student, status: 'present' }]);
    setSearchHits([]);
    setSearchQ('');
  };

  const cycleStatus = (id) => {
    setRows((prev) =>
      prev.map((r) => {
        if (String(r.student._id) !== id) return r;
        const i = STATUSES.indexOf(r.status);
        const next = STATUSES[(i + 1) % STATUSES.length];
        return { ...r, status: next };
      })
    );
  };

  const submit = async () => {
    if (!courseId) {
      Alert.alert('Course', 'Select a course first.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      Alert.alert('Date', 'Use YYYY-MM-DD format.');
      return;
    }
    if (!rows.length) {
      Alert.alert('Roster', 'Add at least one student (enrolled list or search).');
      return;
    }

    setSubmitting(true);
    try {
      const headers = await apiHeaders();
      const body = {
        courseId,
        date: dateStr.trim(),
        records: rows.map((r) => ({
          student: r.student._id,
          status: r.status,
        })),
      };
      const res = await fetch(`${API_BASE}/attendance/mark`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Could not save attendance');
      }
      Alert.alert('Saved', 'Attendance recorded for this date.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.muted}>Loading courses…</Text>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={22} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.title}>Mark attendance</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Course</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {courses.map((c) => {
            const active = String(c._id) === String(courseId);
            return (
              <TouchableOpacity
                key={c._id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCourseId(String(c._id))}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {c.code} · {c.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {courses.length === 0 && (
          <Text style={styles.warn}>No courses found. Ask an admin to create a course, or try again later.</Text>
        )}

        <Text style={styles.sectionLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={dateStr}
          onChangeText={setDateStr}
          placeholder="2026-04-19"
          placeholderTextColor={MUTED}
          autoCapitalize="none"
        />

        <Text style={styles.sectionLabel}>Students on sheet</Text>
        <Text style={styles.hint}>Tap status to cycle: present → absent → late → OD</Text>

        {rows.map((r) => (
          <View key={r.student._id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.student.name || '—'}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {[r.student.rollNumber, r.student.email].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <TouchableOpacity style={styles.statusBtn} onPress={() => cycleStatus(String(r.student._id))}>
              <Text style={styles.statusTxt}>{r.status}</Text>
              <Feather name="refresh-ccw" size={14} color={GOLD} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Add student (search)</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Name, email, or roll #"
            placeholderTextColor={MUTED}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={runSearch} disabled={searching}>
            {searching ? (
              <ActivityIndicator color={BG} />
            ) : (
              <Text style={styles.searchBtnTxt}>Find</Text>
            )}
          </TouchableOpacity>
        </View>

        {searchHits.map((s) => (
          <TouchableOpacity key={s._id} style={styles.hit} onPress={() => addStudent(s)}>
            <Feather name="user-plus" size={18} color={GOLD} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {[s.rollNumber, s.email].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.submit, submitting && { opacity: 0.7 }]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#1a1510" />
          ) : (
            <>
              <Feather name="check" size={18} color="#1a1510" />
              <Text style={styles.submitTxt}>Save attendance</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'android' ? 48 : 56,
  },
  center: { justifyContent: 'center', alignItems: 'center' },
  muted: { marginTop: 10, color: MUTED, fontFamily: FONTS.medium },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  back: { padding: 6 },
  title: { fontFamily: FONTS.bold, fontSize: 18, color: TEXT },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
    color: MUTED,
    marginBottom: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipRow: { marginBottom: 14, maxHeight: 44 },
  chip: {
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    maxWidth: 260,
  },
  chipActive: { borderColor: GOLD, backgroundColor: 'rgba(245,208,96,0.12)' },
  chipText: { color: MUTED, fontFamily: FONTS.medium, fontSize: 13 },
  chipTextActive: { color: GOLD },
  warn: { color: '#c98', fontFamily: FONTS.regular, fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT,
    fontFamily: FONTS.regular,
    fontSize: 15,
    marginBottom: 14,
  },
  hint: { color: MUTED, fontSize: 12, marginBottom: 10, fontFamily: FONTS.regular },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 8,
  },
  name: { color: TEXT, fontFamily: FONTS.semibold, fontSize: 15 },
  sub: { color: MUTED, fontSize: 12, marginTop: 2, fontFamily: FONTS.regular },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GOLD,
  },
  statusTxt: { color: GOLD, fontFamily: FONTS.bold, fontSize: 13, textTransform: 'capitalize' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  searchBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  searchBtnTxt: { fontFamily: FONTS.bold, color: '#1a1510' },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
    backgroundColor: 'rgba(245,208,96,0.06)',
  },
  submit: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 14,
  },
  submitTxt: { fontFamily: FONTS.bold, fontSize: 16, color: '#1a1510' },
});
