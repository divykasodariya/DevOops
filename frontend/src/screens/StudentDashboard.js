import React, { useState, useEffect } from 'react';
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
  Platform
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';
import { API_BASE } from '../config/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_BG = '#221f18';
const CARD_BORDER = 'rgba(77,70,54,0.25)';
const TEXT_PRIMARY = '#e9e2d5';
const TEXT_SECONDARY = '#d0c6b0';
const GOLD = '#f5d060';
const GOLD_DIM = '#e7c355';
const RING_BG = '#38342c';
const NAV_BG = '#0c0a07';

// ── Attendance ring (pure RN views) ──
const AttendanceRing = ({ pct = 0 }) => {
  const sz = 90;
  const bw = 7;
  // Quadrant approach: each border side covers 25%
  const gold = GOLD;
  const clear = 'transparent';
  return (
    <View style={{ width: sz, height: sz, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        position: 'absolute', width: sz, height: sz,
        borderRadius: sz / 2, borderWidth: bw, borderColor: RING_BG,
      }} />
      <View style={{
        position: 'absolute', width: sz, height: sz,
        borderRadius: sz / 2, borderWidth: bw,
        borderTopColor: pct > 0 ? gold : clear,
        borderRightColor: pct >= 25 ? gold : clear,
        borderBottomColor: pct >= 50 ? gold : clear,
        borderLeftColor: pct >= 75 ? gold : clear,
        transform: [{ rotate: '-45deg' }],
      }} />
      <Text style={{ fontFamily: FONTS.semibold, fontSize: 20, color: TEXT_PRIMARY }}>{pct}%</Text>
    </View>
  );
};

// ── Initial avatar (no external images) ──
const InitialAvatar = ({ name, size = 40 }) => {
  const initials = (name || 'S')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: 'rgba(245,208,96,0.15)',
      borderWidth: 1.5, borderColor: GOLD_DIM,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{
        fontFamily: FONTS.bold, fontSize: size * 0.38, color: GOLD,
      }}>{initials}</Text>
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
  const [schedExpanded, setSchedExpanded] = useState(false);

  useEffect(() => { bootstrap(); }, []);

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
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
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

  // ── Helpers ──
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const todaySchedules = schedules.filter(s => {
    const d = new Date(s.start);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const fmtTime = (iso) => {
    const d = new Date(iso);
    let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const announcementIcon = (title = '') => {
    const t = title.toLowerCase();
    if (t.includes('library') || t.includes('hour')) return { n: 'book-open', c: GOLD_DIM };
    if (t.includes('career') || t.includes('fair') || t.includes('event')) return { n: 'calendar', c: '#81d1f2' };
    if (t.includes('maintenance') || t.includes('warning') || t.includes('down')) return { n: 'alert-triangle', c: '#ffb4ab' };
    return { n: 'bell', c: GOLD_DIM };
  };

  // ── Loading state ──
  if (loading) {
    return (
      <View style={s.safe}>
        <View style={s.loader}><ActivityIndicator size="large" color={GOLD} /></View>
      </View>
    );
  }

  const firstName = user ? user.name.split(' ')[0] : 'Student';

  return (
    <View style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ─── TOP BAR ─── */}
        <View style={s.topBar}>
          <View style={s.topBarL}>
            <InitialAvatar name={user?.name} size={40} />
            <Text style={s.greeting}>{greeting}, {firstName}</Text>
          </View>
          <TouchableOpacity style={s.bellBtn} activeOpacity={0.7}>
            <Feather name="bell" size={22} color={GOLD} />
            {unreadCount > 0 && (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ─── 2-COL: TASKS + ATTENDANCE ─── */}
        <View style={s.grid}>
          {/* Pending Tasks */}
          <View style={s.gridCard}>
            <View style={s.gridHead}>
              <Text style={s.gridLabel}>PENDING TASKS</Text>
              <View style={s.taskBadge}>
                <Text style={s.taskBadgeT}>{pendingTasks.length}</Text>
              </View>
            </View>
            {pendingTasks.length === 0 ? (
              <Text style={s.emptyText}>All clear</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {pendingTasks.slice(0, 3).map(t => (
                  <View key={t._id} style={s.taskRow}>
                    <View style={s.chk} />
                    <Text style={s.taskText} numberOfLines={2}>{t.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Attendance */}
          <View style={[s.gridCard, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={s.gridLabel}>ATTENDANCE</Text>
            <View style={{ marginVertical: 12 }}>
              <AttendanceRing pct={attendance.percentage} />
            </View>
            <Text style={s.attStatus}>{attendance.status}</Text>
          </View>
        </View>

        {/* ─── TODAY'S SCHEDULE ─── */}
        <View style={s.schedSection}>
          <View style={s.schedHead}>
            <Text style={s.schedTitle}>Today's Schedule</Text>
            {(todaySchedules.length > 1 || schedules.length > 1) && (
              <TouchableOpacity onPress={() => setSchedExpanded(!schedExpanded)}>
                <Text style={s.viewAll}>{schedExpanded ? 'Show Less' : 'View All'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {todaySchedules.length === 0 && schedules.length === 0 ? (
            <Text style={s.emptyT}>No classes scheduled.</Text>
          ) : (
            <View style={s.timeline}>
              <View style={s.tlLine} />
              {(todaySchedules.length > 0 ? todaySchedules : schedules).slice(0, schedExpanded ? undefined : 1).map((item) => {
                const h = new Date(item.start).getHours();
                const ap = h >= 12 ? 'PM' : 'AM';
                const hh = (h % 12 || 12).toString().padStart(2, '0');
                return (
                  <View key={item._id} style={s.tlItem}>
                    <View style={s.tlTimeCol}>
                      <View style={s.tlCircle}>
                        <Text style={s.tlH}>{hh}</Text>
                        <Text style={s.tlAp}>{ap}</Text>
                      </View>
                    </View>
                    <View style={s.tlCard}>
                      <View style={s.tlCardTop}>
                        <Text style={s.tlTitle} numberOfLines={2}>{item.course?.name || item.title}</Text>
                        <View style={s.tlBadge}>
                          <Text style={s.tlBadgeT}>{item.type === 'class' ? 'Lecture' : item.type}</Text>
                        </View>
                      </View>
                      <View style={s.tlDetails}>
                        <View style={s.tlDetailRow}>
                          <Feather name="map-pin" size={13} color={TEXT_SECONDARY} style={{ marginRight: 5 }} />
                          <Text style={s.tlDetailT}>{item.room || item.location || 'TBA'}</Text>
                        </View>
                        <View style={s.tlDetailRow}>
                          <Feather name="clock" size={13} color={TEXT_SECONDARY} style={{ marginRight: 5 }} />
                          <Text style={s.tlDetailT}>{fmtTime(item.start)} - {fmtTime(item.end)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>



        {/* ─── ANNOUNCEMENTS ─── */}
        <View style={s.annSection}>
          <Text style={s.secTitle}>Announcements</Text>
          {announcements.length === 0 ? (
            <Text style={s.emptyText}>No announcements yet.</Text>
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
                  <View style={s.annCard}>
                    <View style={s.annHead}>
                      <Feather name={ic.n} size={15} color={ic.c} />
                      <Text style={s.annLabel}>{item.title}</Text>
                    </View>
                    <Text style={s.annBody} numberOfLines={3}>{item.body}</Text>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* spacer */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* ─── ASK AETHER ─── */}
      <View style={s.askWrap}>
        <View style={s.askBox}>
          <TextInput
            style={s.askInput}
            placeholder="Ask Aether..."
            placeholderTextColor="#99907d"
            value={askText}
            onChangeText={setAskText}
          />
          <TouchableOpacity style={s.micBtn} activeOpacity={0.7}>
            <Feather name="mic" size={20} color={GOLD} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── BOTTOM NAV ─── */}
      <View style={s.nav}>
        <TouchableOpacity style={s.navItem}><Feather name="home" size={23} color={GOLD} /><Text style={[s.navLbl, { color: GOLD }]}>HOME</Text></TouchableOpacity>
        <TouchableOpacity style={s.navItem}><Feather name="calendar" size={23} color="#78716c" /><Text style={s.navLbl}>SCHEDULE</Text></TouchableOpacity>
        <View style={s.fabWrap}>
          <TouchableOpacity style={s.fab} activeOpacity={0.8}>
            <MaterialCommunityIcons name="robot-outline" size={26} color="#16130c" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.navItem}><Feather name="bell" size={23} color="#78716c" /><Text style={s.navLbl}>ALERTS</Text></TouchableOpacity>
        <TouchableOpacity style={s.navItem}><Feather name="user" size={23} color="#78716c" /><Text style={s.navLbl}>PROFILE</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ──────────── STYLES ────────────
const NAV_H = Platform.OS === 'ios' ? 84 : 64;
const ASK_BOTTOM = NAV_H + 8;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#16130c' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 16 },

  // top bar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2d2a22' },
  topBarL: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  greeting: { fontFamily: FONTS.semibold, fontSize: 17, color: TEXT_PRIMARY, marginLeft: 12, flexShrink: 1 },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2d2a22', justifyContent: 'center', alignItems: 'center' },
  bellBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#EF5350', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#16130c' },
  bellBadgeText: { fontFamily: FONTS.bold, fontSize: 9, color: '#fff' },

  // schedule timeline
  schedSection: { marginBottom: 24 },
  schedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  schedTitle: { fontFamily: FONTS.semibold, fontSize: 20, color: TEXT_PRIMARY },
  viewAll: { fontFamily: FONTS.medium, fontSize: 13, color: GOLD },
  emptyT: { fontFamily: FONTS.regular, fontSize: 13, color: TEXT_SECONDARY, fontStyle: 'italic' },
  timeline: { paddingLeft: 6 },
  tlLine: { position: 'absolute', left: 29, top: 22, bottom: 0, width: 2, backgroundColor: '#2d2a22' },
  tlItem: { flexDirection: 'row', marginBottom: 18 },
  tlTimeCol: { width: 48, alignItems: 'center', zIndex: 1 },
  tlCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: GOLD, backgroundColor: '#16130c', justifyContent: 'center', alignItems: 'center' },
  tlH: { fontFamily: FONTS.semibold, fontSize: 13, color: GOLD, lineHeight: 15 },
  tlAp: { fontFamily: FONTS.medium, fontSize: 9, color: GOLD },
  tlCard: { flex: 1, marginLeft: 16, backgroundColor: CARD_BG, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: CARD_BORDER },
  tlCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  tlTitle: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: TEXT_PRIMARY, marginRight: 8 },
  tlBadge: { backgroundColor: 'rgba(245,208,96,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tlBadgeT: { fontFamily: FONTS.medium, fontSize: 10, color: GOLD },
  tlDetails: { flexDirection: 'row', flexWrap: 'wrap' },
  tlDetailRow: { flexDirection: 'row', alignItems: 'center', marginRight: 18, marginTop: 2 },
  tlDetailT: { fontFamily: FONTS.medium, fontSize: 12, color: TEXT_SECONDARY },

  // grid
  grid: { flexDirection: 'row', gap: 14, marginBottom: 28 },
  gridCard: { flex: 1, backgroundColor: CARD_BG, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: CARD_BORDER },
  gridHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  gridLabel: { fontFamily: FONTS.medium, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 1.2, textTransform: 'uppercase' },
  taskBadge: { backgroundColor: '#93000a', minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  taskBadgeT: { fontFamily: FONTS.semibold, fontSize: 11, color: '#ffdad6' },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  chk: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#4d4636', marginTop: 2 },
  taskText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 19 },
  emptyText: { fontFamily: FONTS.regular, fontSize: 13, color: TEXT_SECONDARY, fontStyle: 'italic' },

  // attendance
  attStatus: { fontFamily: FONTS.medium, fontSize: 12, color: '#81d1f2', letterSpacing: 0.4, textAlign: 'center' },

  // announcements
  annSection: { marginBottom: 16 },
  secTitle: { fontFamily: FONTS.semibold, fontSize: 20, color: TEXT_PRIMARY, marginBottom: 14 },
  annCard: { width: SCREEN_W * 0.62, backgroundColor: CARD_BG, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: CARD_BORDER, marginRight: 14, gap: 6 },
  annHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  annLabel: { fontFamily: FONTS.medium, fontSize: 12, color: TEXT_SECONDARY, letterSpacing: 0.3 },
  annBody: { fontFamily: FONTS.regular, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 22 },

  // ask aether
  askWrap: { position: 'absolute', bottom: ASK_BOTTOM, left: 16, right: 16 },
  askBox: { backgroundColor: CARD_BG, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 8, height: 50, borderWidth: 1, borderColor: CARD_BORDER },
  askInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, color: TEXT_PRIMARY },
  micBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  // nav
  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: NAV_H, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: NAV_BG, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1e1b14', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  navItem: { alignItems: 'center', gap: 3 },
  navLbl: { fontFamily: FONTS.medium, fontSize: 9, color: '#78716c', letterSpacing: 0.6, textTransform: 'uppercase' },
  fabWrap: { marginTop: -28 },
  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#16130c' },
});