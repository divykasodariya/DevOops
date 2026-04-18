import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';
import { API_BASE } from '../config/api';

const { width: SW } = Dimensions.get('window');

// ── Design Tokens ──
const BG      = '#16130c';
const CARD    = '#221f18';
const CARD_B  = 'rgba(77,70,54,0.30)';
const T1      = '#e9e2d5';
const T2      = '#d0c6b0';
const T3      = '#99907d';
const GOLD    = '#f5d060';
const GOLD_D  = '#e7c355';
const NAV_BG  = '#0c0a07';
const RED     = '#FF6B6B';

// ── Initials Avatar ──
const Avatar = ({ name = 'F', size = 44 }) => {
  const ini = (name || 'F').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: 'rgba(245,208,96,0.15)',
      borderWidth: 1.5, borderColor: GOLD_D,
      justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ fontFamily: FONTS.bold, fontSize: size * 0.38, color: GOLD }}>{ini}</Text>
    </View>
  );
};

export default function FacultyDashboard() {
  const router = useRouter();
  const [user, setUser]                     = useState(null);
  const [schedules, setSchedules]           = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [attendance, setAttendance]         = useState({
    percentage: 0, status: 'No Data', totalClasses: 0,
    courseName: '', label: 'Average this week',
  });
  const [loading, setLoading]               = useState(true);
  const [schedExpanded, setSchedExpanded]   = useState(false);

  // pulse for badge
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
      await Promise.allSettled([fetchSchedule(), fetchApprovals(), fetchAttendance()]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const apiFetch = async (path) => {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.json();
  };

  const fetchSchedule   = async () => { const d = await apiFetch('/schedule/my'); if (d) setSchedules(d); };
  const fetchApprovals  = async () => { const d = await apiFetch('/request'); if (d) setPendingApprovals(d.filter(r => r.overallStatus === 'pending')); };
  const fetchAttendance = async () => { const d = await apiFetch('/attendance/overview'); if (d) setAttendance(d); };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const fmtTime = (iso) => {
    const d  = new Date(iso);
    let h    = d.getHours();
    const m  = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
  };

  const todaySchedules = schedules.filter(s => {
    const d = new Date(s.start);
    return d.toDateString() === new Date().toDateString();
  });

  const firstName = user?.name?.split(' ')[0] ?? 'Faculty';

  if (loading) {
    return (
      <View style={st.safe}>
        <View style={st.loader}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      </View>
    );
  }

  // bar thresholds for attendance chart
  const bars = [
    { threshold: 20,  h: 14 },
    { threshold: 40,  h: 22 },
    { threshold: 60,  h: 30 },
    { threshold: 80,  h: 38 },
    { threshold: 100, h: 46 },
  ];

  const displayedSchedules = (todaySchedules.length > 0 ? todaySchedules : schedules)
    .slice(0, schedExpanded ? undefined : 1);

  return (
    <View style={st.safe}>
      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* ── HEADER ── */}
        <View style={st.header}>
          <View style={st.headerL}>
            <Avatar name={user?.name} size={44} />
            <Text style={st.greet}>{greeting}, {firstName}</Text>
          </View>
          <View style={st.headerR}>
            <TouchableOpacity
              style={st.bellBtn}
              activeOpacity={0.7}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10
              }}>
              <Feather name="bell" size={20} color={GOLD} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ATTENDANCE OVERVIEW ── */}
        <LinearGradient
          colors={['#2A2415', '#1a1710']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[st.card, st.attCard]}
        >
          <View style={st.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>Attendance Overview</Text>
              {/* Course sub-label matching the reference */}
              <Text style={st.cardSub}>
                {attendance.courseName || 'CS301 - Intro to Algorithms'}
              </Text>
            </View>
            <View style={st.attIconBox}>
              <Feather name="trending-up" size={16} color={GOLD} />
            </View>
          </View>

          <View style={st.attBody}>
            <View>
              <Text style={st.attPct}>{attendance.percentage ?? 94}%</Text>
              <Text style={st.cardSub}>{attendance.label || 'Average this week'}</Text>
            </View>
            {/* Bar chart */}
            <View style={st.bars}>
              {bars.map((b, i) => {
                const active = (attendance.percentage ?? 94) >= b.threshold;
                return (
                  <LinearGradient
                    key={i}
                    colors={active ? [GOLD, '#B38E22'] : ['#3a3629', '#2a271f']}
                    style={[st.bar, { height: b.h, opacity: active ? 1 : 0.55 }]}
                  />
                );
              })}
            </View>
          </View>
        </LinearGradient>

        {/* ── PENDING APPROVALS ── */}
        <TouchableOpacity
          activeOpacity={0.82}
          style={[st.card, st.appCard]}
          onPress={() => router.push('/approvals')}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <View style={st.appRow}>
            <View style={st.appLeft}>
              <View style={st.appIconBox}>
                {/* Exclamation icon */}
                <Text style={{ fontFamily: FONTS.bold, fontSize: 16, color: RED }}>!</Text>
              </View>
              <View>
                <Text style={st.cardTitle}>Pending Approvals</Text>
                <Text style={st.cardSub}>Leave requests & extensions</Text>
              </View>
            </View>
            {pendingApprovals.length > 0 && (
              <Animated.View style={[st.appBadge, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={st.appBadgeT}>{pendingApprovals.length}</Text>
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>

        {/* ── POST NOTICE BUTTON ── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/publish-notice')}
          style={st.noticeShadow}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <LinearGradient
            colors={[GOLD_D, '#c59d2b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={st.noticeBtn}
          >
            <MaterialCommunityIcons name="bullhorn-outline" size={19} color="#16130c" style={st.noticeIcon} />
            <Text style={st.noticeBtnT}>Post Notice</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── QUICK ACTIONS ── */}
        <View style={st.qaSection}>
          <Text style={st.qaLabel}>QUICK ACTIONS</Text>
          <View style={st.qaRow}>
            {[
              { icon: 'user-check', color: GOLD,      bg: 'rgba(245,208,96,0.10)',  label: 'Mark\nAttendance',  route: '/mark-attendance' },
              { icon: 'upload',     color: '#64C8FF',  bg: 'rgba(100,200,255,0.10)', label: 'Upload\nMaterial',  route: '/upload-material'  },
              { icon: 'message-square', color: '#FFC864', bg: 'rgba(255,200,100,0.10)', label: 'Message\nStudents', route: '/message-students' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={st.qaCard}
                activeOpacity={0.78}
                onPress={() => router.push(item.route)}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10
                }}>
                <View style={[st.qaIcon, { backgroundColor: item.bg }]}>
                  <Feather name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={st.qaText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── TODAY'S SCHEDULE ── */}
        <View style={st.schedSection}>
          <View style={st.schedHead}>
            <Text style={st.schedTitle}>Today's Schedule</Text>
            {(todaySchedules.length > 1 || schedules.length > 1) && (
              <TouchableOpacity onPress={() => setSchedExpanded(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={st.viewAll}>{schedExpanded ? 'Show Less' : 'View All'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {todaySchedules.length === 0 && schedules.length === 0 ? (
            <Text style={st.emptyT}>No classes scheduled today.</Text>
          ) : (
            <View style={st.timeline}>
              <View style={st.tlLine} />
              {displayedSchedules.map((item) => {
                const d   = new Date(item.start);
                const h   = d.getHours();
                const ap  = h >= 12 ? 'PM' : 'AM';
                const hh  = (h % 12 || 12).toString().padStart(2, '0');
                return (
                  <View key={item._id} style={st.tlItem}>
                    {/* Time circle */}
                    <View style={st.tlTimeCol}>
                      <View style={st.tlCircle}>
                        <Text style={st.tlH}>{hh}</Text>
                        <Text style={st.tlAp}>{ap}</Text>
                      </View>
                    </View>
                    {/* Card */}
                    <View style={st.tlCard}>
                      <View style={st.tlCardTop}>
                        <Text style={st.tlTitle} numberOfLines={2}>
                          {item.course?.name || item.title}
                        </Text>
                        <View style={st.tlBadge}>
                          <Text style={st.tlBadgeT}>
                            {item.type === 'class' ? 'Lecture' : item.type || 'Lecture'}
                          </Text>
                        </View>
                      </View>
                      <View style={st.tlDetails}>
                        <View style={st.tlDetailRow}>
                          <Feather name="map-pin" size={12} color={T3} style={{ marginRight: 4 }} />
                          <Text style={st.tlDetailT}>{item.room || item.location || 'TBA'}</Text>
                        </View>
                        <View style={[st.tlDetailRow, { marginLeft: 14 }]}>
                          <Feather name="users" size={12} color={T3} style={{ marginRight: 4 }} />
                          <Text style={st.tlDetailT}>{item.audienceIds?.length ?? 0} Students</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
      {/* ── BOTTOM NAV ── */}
      <View style={st.nav}>
        {/* Home */}
        <TouchableOpacity
          style={st.navI}
          onPress={() => {}}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Feather name="home" size={22} color={GOLD} />
          <Text style={[st.navL, { color: GOLD }]}>HOME</Text>
        </TouchableOpacity>

        {/* Schedule */}
        <TouchableOpacity
          style={st.navI}
          onPress={() => router.push('/schedule')}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Feather name="calendar" size={22} color={T3} />
          <Text style={st.navL}>SCHEDULE</Text>
        </TouchableOpacity>

        {/* FAB – AI Assistant (centre) */}
        <View style={st.fabW}>
          <TouchableOpacity
            style={st.fab}
            activeOpacity={0.8}
            onPress={() => router.push('/ai-assistant')}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <MaterialCommunityIcons name="robot-outline" size={24} color={BG} />
          </TouchableOpacity>
          {/* Label below the FAB */}
          <Text style={[st.navL, { color: T3, textAlign: 'center', marginTop: 2 }]}>AI ASSISTANT</Text>
        </View>

        {/* Alerts */}
        <TouchableOpacity
          style={st.navI}
          onPress={() => router.push('/alerts')}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Feather name="bell" size={22} color={T3} />
          <Text style={st.navL}>ALERTS</Text>
        </TouchableOpacity>

        {/* Profile */}
        <TouchableOpacity
          style={st.navI}
          onPress={() => router.push('/profile')}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Feather name="user" size={22} color={T3} />
          <Text style={st.navL}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ──────── STYLES ────────
const NAV_H = Platform.OS === 'ios' ? 84 : 64;

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG , paddingTop: Platform.OS === 'android' ? 64 : 88 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  // ── Header ──
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, paddingVertical: 17 },
  headerL:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  greet:       { fontFamily: FONTS.semibold, fontSize: 17, color: T1, marginLeft: 12, flexShrink: 1 },
  headerR:     { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  bellBtn:     { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // ── Card base ──
  card:      { backgroundColor: CARD, borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: CARD_B },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: T1, marginBottom: 3 },
  cardSub:   { fontFamily: FONTS.medium, fontSize: 12, color: T3 },

  // ── Attendance ──
  attCard:   {
    borderColor: 'rgba(245,208,96,0.25)',
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },
  attIconBox: { backgroundColor: 'rgba(245,208,96,0.12)', padding: 7, borderRadius: 10 },
  attBody:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  attPct:    { fontFamily: FONTS.bold, fontSize: 42, color: GOLD, lineHeight: 46 },
  bars:      { flexDirection: 'row', alignItems: 'flex-end', height: 46, gap: 5 },
  bar:       { width: 11, borderRadius: 4 },

  // ── Approvals ──
  appCard:   {
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  appRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appLeft:   { flexDirection: 'row', alignItems: 'center', flex: 1 },
  appIconBox: {
    width: 40, height: 40, borderRadius: 11,
    backgroundColor: 'rgba(255,107,107,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)',
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  appBadge:  {
    backgroundColor: RED, width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: RED, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 7, elevation: 5,
  },
  appBadgeT: { fontFamily: FONTS.bold, color: '#fff', fontSize: 14 },

  // ── Post Notice button ──
  noticeShadow: {
    marginBottom: 26,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6,
  },
  noticeBtn:  {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    height: 54, borderRadius: 16,
  },
  noticeIcon: { marginRight: 9 },
  noticeBtnT: { fontFamily: FONTS.bold, fontSize: 16, color: '#16130c' },

  // ── Quick Actions ──
  qaSection: { marginBottom: 26 },
  qaLabel:   { fontFamily: FONTS.semibold, fontSize: 11, color: T3, letterSpacing: 1.3, marginBottom: 12 },
  qaRow:     { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  qaCard:    {
    backgroundColor: CARD, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 10,
    alignItems: 'center', flex: 1,
    borderWidth: 1, borderColor: CARD_B,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  qaIcon:    { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 9 },
  qaText:    { fontFamily: FONTS.medium, fontSize: 11, color: T1, textAlign: 'center', lineHeight: 15 },

  // ── Schedule ──
  schedSection: { marginBottom: 20 },
  schedHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  schedTitle:   { fontFamily: FONTS.semibold, fontSize: 20, color: T1 },
  viewAll:      { fontFamily: FONTS.medium, fontSize: 13, color: GOLD },
  emptyT:       { fontFamily: FONTS.regular, fontSize: 13, color: T3, fontStyle: 'italic' },

  // timeline
  timeline:   { paddingLeft: 4 },
  tlLine:     { position: 'absolute', left: 27, top: 23, bottom: 0, width: 2, backgroundColor: '#2d2a22' },
  tlItem:     { flexDirection: 'row', marginBottom: 16 },
  tlTimeCol:  { width: 46, alignItems: 'center', zIndex: 1 },
  tlCircle:   {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5, borderColor: GOLD,
    backgroundColor: BG, justifyContent: 'center', alignItems: 'center',
  },
  tlH:        { fontFamily: FONTS.semibold, fontSize: 13, color: GOLD, lineHeight: 15 },
  tlAp:       { fontFamily: FONTS.medium, fontSize: 9, color: GOLD },
  tlCard:     {
    flex: 1, marginLeft: 14, backgroundColor: CARD,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: CARD_B,
  },
  tlCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  tlTitle:    { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: T1, marginRight: 8 },
  tlBadge:    { backgroundColor: 'rgba(245,208,96,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tlBadgeT:   { fontFamily: FONTS.medium, fontSize: 10, color: GOLD },
  tlDetails:  { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  tlDetailRow:{ flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  tlDetailT:  { fontFamily: FONTS.medium, fontSize: 12, color: T3 },

  // ── Bottom Nav ──
  nav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: NAV_H,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: NAV_BG,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1e1b14',
    paddingBottom:  20 ,
  },
  navI:  { alignItems: 'center', gap: 3, minWidth: 44 },
  navL:  { fontFamily: FONTS.medium, fontSize: 9, color: T3, letterSpacing: 0.6, textTransform: 'uppercase' },
  fabW:  { alignItems: 'center', marginTop: -28 },
  fab:   {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: BG,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
});
