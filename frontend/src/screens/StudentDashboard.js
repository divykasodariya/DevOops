import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
  TextInput,
  Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { FONTS } from '../theme/typography';
import { API_BASE } from '../config/api';

const { width: SCREEN_W } = Dimensions.get('window');
const BG = '#16130c';
const CARD_BG = '#221f18';
const CARD_BORDER = 'rgba(77,70,54,0.25)';
const TEXT_PRIMARY = '#e9e2d5';
const TEXT_SECONDARY = '#d0c6b0';
const TEXT_MUTED = '#99907d';
const GOLD = '#f5d060';
const GOLD_DIM = '#e7c355';
const NAV_BG = '#0c0a07';

const AttendanceRing = ({ pct = 0 }) => {
  const sz = 86;
  const bw = 6;
  const clear = 'transparent';
  return (
    <View style={{ width: sz, height: sz, justifyContent: 'center', alignItems: 'center' }}>
      <View style={styles.ringBase} />
      <View
        style={[
          styles.ringProgress,
          {
            width: sz,
            height: sz,
            borderRadius: sz / 2,
            borderWidth: bw,
            borderTopColor: pct > 0 ? GOLD : clear,
            borderRightColor: pct >= 25 ? GOLD : clear,
            borderBottomColor: pct >= 50 ? GOLD : clear,
            borderLeftColor: pct >= 75 ? GOLD : clear,
          },
        ]}
      />
      <Text style={styles.ringPct}>{pct}%</Text>
    </View>
  );
};

const InitialAvatar = ({ name, size = 40 }) => {
  const initials = (name || 'S')
    .split(' ')
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
        borderWidth: 1.2,
        borderColor: GOLD_DIM,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: FONTS.bold, fontSize: size * 0.38, color: GOLD }}>{initials}</Text>
    </View>
  );
};

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [attendance, setAttendance] = useState({ percentage: 0, status: 'No Data' });
  const [announcements, setAnnouncements] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [askText, setAskText] = useState('');

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
      await Promise.allSettled([
        fetchSchedule(),
        fetchAttendance(),
        fetchAnnouncements(),
        fetchPendingTasks(),
        fetchNotifications(),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const apiFetch = async (path) => {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.json();
  };

  const fetchSchedule = async () => {
    const d = await apiFetch('/schedule/my');
    if (d) setSchedules(d);
  };
  const fetchAttendance = async () => {
    const d = await apiFetch('/attendance/overview');
    if (d) setAttendance(d);
  };
  const fetchAnnouncements = async () => {
    const d = await apiFetch('/notifications/announcements');
    if (d) setAnnouncements(d);
  };
  const fetchPendingTasks = async () => {
    const d = await apiFetch('/request/pending');
    if (d) setPendingTasks(d);
  };
  const fetchNotifications = async () => {
    const d = await apiFetch('/notifications/my');
    if (d) setNotifications(d);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = user?.name?.split(' ')[0] || 'Student';
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const fmtTime = (iso) => {
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
  };

  const nextClass = useMemo(() => {
    const now = new Date();
    const sorted = [...schedules].sort((a, b) => new Date(a.start) - new Date(b.start));
    return sorted.find((item) => new Date(item.end) > now) || sorted[0] || null;
  }, [schedules]);

  const announcementIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('library') || t.includes('hour')) return { n: 'book-open', c: GOLD_DIM };
    if (t.includes('career') || t.includes('fair') || t.includes('event')) return { n: 'calendar', c: '#81d1f2' };
    if (t.includes('maintenance') || t.includes('warning') || t.includes('down')) return { n: 'alert-triangle', c: '#ffb4ab' };
    return { n: 'bell', c: GOLD_DIM };
  };

  if (loading) {
    return (
      <View style={styles.safe}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.topBarL}>
            <InitialAvatar name={user?.name} size={40} />
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.75}>
            <Feather name="bell" size={20} color={GOLD} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>NEXT CLASS</Text>
            <View style={styles.timePill}>
              <Feather name="clock" size={13} color={GOLD} />
              <Text style={styles.timePillText}>{nextClass ? fmtTime(nextClass.start) : '--:--'}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {nextClass?.course?.name || nextClass?.title || 'No upcoming class'}
          </Text>
          <View style={styles.heroMetaRow}>
            <Feather name="map-pin" size={14} color={TEXT_SECONDARY} />
            <Text style={styles.heroMetaText}>{nextClass?.room || nextClass?.location || 'Room TBA'}</Text>
          </View>
          <TouchableOpacity style={styles.heroBtn} activeOpacity={0.8}>
            <Text style={styles.heroBtnText}>View Schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickBtnPrimary]}
            onPress={() => router.push('/make-request?kind=request')}
            activeOpacity={0.82}
          >
            <Feather name="file-plus" size={16} color={BG} />
            <Text style={styles.quickBtnPrimaryText}>Make a Request</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickBtnSecondary]}
            onPress={() => router.push('/report-issue')}
            activeOpacity={0.82}
          >
            <Feather name="alert-octagon" size={16} color={GOLD} />
            <Text style={styles.quickBtnSecondaryText}>Report Issue</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridCard}>
            <View style={styles.gridHead}>
              <Text style={styles.gridLabel}>PENDING TASKS</Text>
              <View style={styles.taskBadge}>
                <Text style={styles.taskBadgeT}>{pendingTasks.length}</Text>
              </View>
            </View>
            {pendingTasks.length === 0 ? (
              <Text style={styles.emptyText}>All clear</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {pendingTasks.slice(0, 2).map((t) => (
                  <View key={t._id} style={styles.taskRow}>
                    <View style={styles.chk} />
                    <Text style={styles.taskText} numberOfLines={2}>
                      {t.title}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.gridCard, styles.attCard]}>
            <Text style={styles.gridLabel}>ATTENDANCE</Text>
            <View style={{ marginVertical: 10 }}>
              <AttendanceRing pct={attendance.percentage || 0} />
            </View>
            <Text style={styles.attStatus}>{attendance.status || 'On Track'}</Text>
          </View>
        </View>

        <View style={styles.annSection}>
          <Text style={styles.secTitle}>Announcements</Text>
          {announcements.length === 0 ? (
            <Text style={styles.emptyText}>No announcements yet.</Text>
          ) : (
            <FlatList
              data={announcements}
              keyExtractor={(i) => i._id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 24 }}
              renderItem={({ item }) => {
                const ic = announcementIcon(item.title);
                return (
                  <View style={styles.annCard}>
                    <View style={styles.annHead}>
                      <Feather name={ic.n} size={14} color={ic.c} />
                      <Text style={styles.annLabel} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={styles.annBody} numberOfLines={3}>
                      {item.body}
                    </Text>
                  </View>
                );
              }}
            />
          )}
        </View>

        <View style={{ height: 150 }} />
      </ScrollView>

      <View style={styles.askWrap}>
        <View style={styles.askBox}>
          <TextInput
            style={styles.askInput}
            placeholder="Ask Aether..."
            placeholderTextColor={TEXT_MUTED}
            value={askText}
            onChangeText={setAskText}
            returnKeyType="send"
            onSubmitEditing={() => {
              const value = askText.trim();
              if (!value) return;
              router.push(`/ai-assistant?q=${encodeURIComponent(value)}`);
              setAskText('');
            }}
          />
          <TouchableOpacity style={styles.micBtn} activeOpacity={0.7}>
            <Feather name="mic" size={20} color={GOLD} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.nav}>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="home" size={22} color={GOLD} />
          <Text style={[styles.navLbl, { color: GOLD }]}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/schedule')}>
          <Feather name="calendar" size={22} color={TEXT_MUTED} />
          <Text style={styles.navLbl}>SCHEDULE</Text>
        </TouchableOpacity>
        <View style={styles.fabWrap}>
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => router.push('/ai-assistant')}
          >
            <MaterialCommunityIcons name="robot-outline" size={24} color={BG} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="bell" size={22} color={TEXT_MUTED} />
          <Text style={styles.navLbl}>ALERTS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="user" size={22} color={TEXT_MUTED} />
          <Text style={styles.navLbl}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const NAV_H = Platform.OS === 'ios' ? 84 : 64;
const ASK_BOTTOM = NAV_H + 8;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 16 },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2d2a22',
  },
  topBarL: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  greeting: { fontFamily: FONTS.semibold, fontSize: 17, color: TEXT_PRIMARY, marginLeft: 12, flexShrink: 1 },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2d2a22', justifyContent: 'center', alignItems: 'center' },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF5350',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BG,
  },
  bellBadgeText: { fontFamily: FONTS.bold, fontSize: 9, color: '#fff' },

  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 16,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    letterSpacing: 1,
    color: '#d7c28f',
  },
  timePill: {
    backgroundColor: '#3b3328',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timePillText: { fontFamily: FONTS.semibold, fontSize: 12, color: TEXT_PRIMARY },
  heroTitle: { fontFamily: FONTS.semibold, fontSize: 40, color: TEXT_PRIMARY, lineHeight: 46, marginBottom: 10 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 6 },
  heroMetaText: { fontFamily: FONTS.medium, fontSize: 15, color: TEXT_SECONDARY },
  heroBtn: {
    alignSelf: 'flex-start',
    backgroundColor: GOLD,
    paddingHorizontal: 24,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
  },
  heroBtnText: { fontFamily: FONTS.semibold, fontSize: 15, color: BG },

  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  quickBtn: {
    flex: 1,
    borderRadius: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickBtnPrimary: { backgroundColor: GOLD },
  quickBtnSecondary: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(245,208,96,0.35)' },
  quickBtnPrimaryText: { fontFamily: FONTS.semibold, color: BG, fontSize: 13 },
  quickBtnSecondaryText: { fontFamily: FONTS.semibold, color: GOLD, fontSize: 13 },

  grid: { flexDirection: 'row', gap: 14, marginBottom: 22 },
  gridCard: { flex: 1, backgroundColor: CARD_BG, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: CARD_BORDER },
  attCard: { alignItems: 'center', justifyContent: 'center' },
  gridHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  gridLabel: { fontFamily: FONTS.medium, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 1.1, textTransform: 'uppercase' },
  taskBadge: { backgroundColor: '#93000a', minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  taskBadgeT: { fontFamily: FONTS.semibold, fontSize: 11, color: '#ffdad6' },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chk: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#4d4636', marginTop: 2 },
  taskText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 19 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: TEXT_SECONDARY, fontStyle: 'italic' },
  ringBase: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 6,
    borderColor: '#38342c',
  },
  ringProgress: {
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
  },
  ringPct: { fontFamily: FONTS.semibold, fontSize: 36, color: TEXT_PRIMARY },
  attStatus: { fontFamily: FONTS.medium, fontSize: 13, color: '#81d1f2', letterSpacing: 0.4, textAlign: 'center' },

  annSection: { marginBottom: 18 },
  secTitle: { fontFamily: FONTS.semibold, fontSize: 34, color: TEXT_PRIMARY, marginBottom: 14 },
  annCard: {
    width: SCREEN_W * 0.68,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginRight: 14,
    gap: 8,
  },
  annHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  annLabel: { fontFamily: FONTS.medium, fontSize: 13, color: TEXT_SECONDARY, flexShrink: 1 },
  annBody: { fontFamily: FONTS.regular, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 22 },

  askWrap: { position: 'absolute', bottom: ASK_BOTTOM, left: 16, right: 16 },
  askBox: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 8,
    height: 50,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  askInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: TEXT_PRIMARY },
  micBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

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
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  navItem: { alignItems: 'center', gap: 3 },
  navLbl: { fontFamily: FONTS.medium, fontSize: 9, color: TEXT_MUTED, letterSpacing: 0.6, textTransform: 'uppercase' },
  fabWrap: { marginTop: -28 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: BG,
  },
});