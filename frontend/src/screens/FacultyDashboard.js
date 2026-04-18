import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { FONTS, TYPOGRAPHY } from '../theme/typography';
import { API_BASE } from '../config/api';

const { width: SW } = Dimensions.get('window');
const BG = '#16130c';
const CARD = '#221f18';
const CARD_B = 'rgba(77,70,54,0.25)';
const T1 = '#e9e2d5';
const T2 = '#d0c6b0';
const T3 = '#99907d';
const GOLD = '#f5d060';
const GOLD_D = '#e7c355';
const NAV_BG = '#0c0a07';

// ── Initials Avatar ──
const Avatar = ({ name, size = 40 }) => {
  const ini = (name || 'F').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(245,208,96,0.15)', borderWidth: 1.5, borderColor: GOLD_D, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontFamily: FONTS.bold, fontSize: size * 0.38, color: GOLD }}>{ini}</Text>
    </View>
  );
};

export default function FacultyDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [attendance, setAttendance] = useState({ percentage: 0, status: 'No Data', totalClasses: 0 });
  const [loading, setLoading] = useState(true);

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
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.json();
  };

  const fetchSchedule = async () => {
    const d = await apiFetch('/schedule/my');
    if (d) setSchedules(d);
  };

  const fetchApprovals = async () => {
    const d = await apiFetch('/request');
    if (d) setPendingApprovals(d.filter(r => r.overallStatus === 'pending'));
  };

  const fetchAttendance = async () => {
    const d = await apiFetch('/attendance/overview');
    if (d) setAttendance(d);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const fmtTime = (iso) => {
    const d = new Date(iso);
    let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
  };

  const todaySchedules = schedules.filter(s => {
    const d = new Date(s.start);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const firstName = user ? user.name.split(' ')[0] : 'Professor';

  if (loading) {
    return <View style={st.safe}><View style={st.loader}><ActivityIndicator size="large" color={GOLD} /></View></View>;
  }

  return (
    <View style={st.safe}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ── */}
        <View style={st.header}>
          <View style={st.headerL}>
            <Avatar name={user?.name} size={44} />
            <Text style={st.greet}>{greeting},{'\n'}{firstName}</Text>
          </View>
          <View style={st.headerR}>
            <View style={st.toggle}>
              <View style={st.toggleKnob} />
              <Feather name="moon" size={12} color={GOLD} style={{ marginLeft: 5 }} />
            </View>
            <TouchableOpacity style={st.bellBtn}>
              <Feather name="bell" size={20} color={GOLD} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ATTENDANCE OVERVIEW ── */}
        <View style={st.card}>
          <View style={st.cardTop}>
            <View>
              <Text style={st.cardTitle}>Attendance Overview</Text>
              <Text style={st.cardSub}>{attendance.totalClasses} classes tracked</Text>
            </View>
            <Feather name="trending-up" size={18} color={GOLD} />
          </View>
          <View style={st.attBody}>
            <View>
              <Text style={st.attPct}>{attendance.percentage}%</Text>
              <Text style={st.cardSub}>{attendance.status}</Text>
            </View>
            <View style={st.bars}>
              {[20, 35, 55, 75, 100].map((threshold, i) => (
                <View key={i} style={[st.bar, {
                  height: 10 + (i * 8),
                  backgroundColor: attendance.percentage >= threshold ? GOLD : T3,
                  opacity: attendance.percentage >= threshold ? 1 : 0.4,
                }]} />
              ))}
            </View>
          </View>
        </View>

        {/* ── PENDING APPROVALS ── */}
        <View style={st.card}>
          <View style={st.appRow}>
            <View style={st.appL}>
              <View style={st.appIcon}>
                <Feather name="alert-circle" size={16} color="#FFA0A0" />
              </View>
              <View>
                <Text style={st.cardTitle}>Pending Approvals</Text>
                <Text style={st.cardSub}>Leave requests & extensions</Text>
              </View>
            </View>
            <View style={st.appBadge}>
              <Text style={st.appBadgeT}>{pendingApprovals.length}</Text>
            </View>
          </View>
        </View>

        {/* ── POST NOTICE ── */}
        <TouchableOpacity style={st.noticeBtn} activeOpacity={0.8}>
          <Feather name="edit-3" size={18} color={GOLD} style={{ marginRight: 10 }} />
          <Text style={st.noticeBtnT}>Post Notice</Text>
        </TouchableOpacity>

        {/* ── QUICK ACTIONS ── */}
        <View style={st.qaSection}>
          <Text style={st.qaLabel}>QUICK ACTIONS</Text>
          <View style={st.qaRow}>
            <TouchableOpacity style={st.qaCard} activeOpacity={0.8}>
              <View style={[st.qaIcon, { backgroundColor: 'rgba(245,208,96,0.1)' }]}>
                <Feather name="user-check" size={20} color={GOLD} />
              </View>
              <Text style={st.qaText}>Mark{'\n'}Attendance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.qaCard} activeOpacity={0.8}>
              <View style={[st.qaIcon, { backgroundColor: 'rgba(100,200,255,0.1)' }]}>
                <Feather name="upload" size={20} color="#64C8FF" />
              </View>
              <Text style={st.qaText}>Upload{'\n'}Material</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.qaCard} activeOpacity={0.8}>
              <View style={[st.qaIcon, { backgroundColor: 'rgba(255,200,100,0.1)' }]}>
                <Feather name="message-square" size={20} color="#FFC864" />
              </View>
              <Text style={st.qaText}>Message{'\n'}Students</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── TODAY'S SCHEDULE ── */}
        <View style={st.schedSection}>
          <View style={st.schedHead}>
            <Text style={st.schedTitle}>Today's Schedule</Text>
            <TouchableOpacity><Text style={st.viewAll}>View All</Text></TouchableOpacity>
          </View>

          {todaySchedules.length === 0 && schedules.length === 0 ? (
            <Text style={st.emptyT}>No classes scheduled.</Text>
          ) : (
            <View style={st.timeline}>
              <View style={st.tlLine} />
              {(todaySchedules.length > 0 ? todaySchedules : schedules.slice(0, 3)).map((item) => {
                const t = fmtTime(item.start);
                const h = new Date(item.start).getHours();
                const ap = h >= 12 ? 'PM' : 'AM';
                const hh = (h % 12 || 12).toString().padStart(2, '0');
                return (
                  <View key={item._id} style={st.tlItem}>
                    <View style={st.tlTimeCol}>
                      <View style={st.tlCircle}>
                        <Text style={st.tlH}>{hh}</Text>
                        <Text style={st.tlAp}>{ap}</Text>
                      </View>
                    </View>
                    <View style={st.tlCard}>
                      <View style={st.tlCardTop}>
                        <Text style={st.tlTitle} numberOfLines={2}>{item.course?.name || item.title}</Text>
                        <View style={st.tlBadge}>
                          <Text style={st.tlBadgeT}>{item.type === 'class' ? 'Lecture' : item.type}</Text>
                        </View>
                      </View>
                      <View style={st.tlDetails}>
                        <View style={st.tlDetailRow}>
                          <Feather name="map-pin" size={13} color={T3} style={{ marginRight: 5 }} />
                          <Text style={st.tlDetailT}>{item.room || item.location || 'TBA'}</Text>
                        </View>
                        <View style={st.tlDetailRow}>
                          <Feather name="users" size={13} color={T3} style={{ marginRight: 5 }} />
                          <Text style={st.tlDetailT}>{item.audienceIds?.length || 0} Students</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── BOTTOM NAV ── */}
      <View style={st.nav}>
        <TouchableOpacity style={st.navI}><Feather name="home" size={22} color={GOLD} /><Text style={[st.navL, { color: GOLD }]}>HOME</Text></TouchableOpacity>
        <TouchableOpacity style={st.navI}><Feather name="calendar" size={22} color="#78716c" /><Text style={st.navL}>SCHEDULE</Text></TouchableOpacity>
        <View style={st.fabW}>
          <TouchableOpacity style={st.fab} activeOpacity={0.8}>
            <MaterialCommunityIcons name="robot-outline" size={24} color={BG} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={st.navI}><Feather name="bell" size={22} color="#78716c" /><Text style={st.navL}>ALERTS</Text></TouchableOpacity>
        <TouchableOpacity style={st.navI}><Feather name="user" size={22} color="#78716c" /><Text style={st.navL}>PROFILE</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ──────── STYLES ────────
const NAV_H = Platform.OS === 'ios' ? 82 : 62;

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 16 },

  // header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerL: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  greet: { fontFamily: FONTS.bold, fontSize: 28, color: T1, lineHeight: 34, marginLeft: 12 },
  headerR: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  toggle: { width: 48, height: 26, borderRadius: 13, backgroundColor: '#2d2a22', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 3, marginRight: 12 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFE6A0' },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },

  // card base
  card: { backgroundColor: CARD, borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: CARD_B },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: T1, marginBottom: 3 },
  cardSub: { fontFamily: FONTS.medium, fontSize: 12, color: T3 },

  // attendance
  attBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  attPct: { fontFamily: FONTS.bold, fontSize: 40, color: GOLD, lineHeight: 44 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 46 },
  bar: { width: 11, borderRadius: 3, marginLeft: 5 },

  // approvals
  appRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appL: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  appIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,100,100,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  appBadge: { backgroundColor: '#FFBABA', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  appBadgeT: { fontFamily: FONTS.bold, color: '#8B0000', fontSize: 15 },

  // post notice
  noticeBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 54, borderRadius: 16, borderWidth: 1, borderColor: GOLD, backgroundColor: 'rgba(245,208,96,0.05)', marginBottom: 24 },
  noticeBtnT: { fontFamily: FONTS.semibold, fontSize: 16, color: GOLD },

  // quick actions
  qaSection: { marginBottom: 28 },
  qaLabel: { fontFamily: FONTS.semibold, fontSize: 11, color: T3, letterSpacing: 1.2, marginBottom: 14 },
  qaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  qaCard: { backgroundColor: CARD, borderRadius: 14, padding: 16, alignItems: 'center', width: (SW - 56) / 3, borderWidth: 1, borderColor: CARD_B },
  qaIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  qaText: { fontFamily: FONTS.medium, fontSize: 11, color: T1, textAlign: 'center', lineHeight: 15 },

  // schedule
  schedSection: { marginBottom: 20 },
  schedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  schedTitle: { fontFamily: FONTS.semibold, fontSize: 20, color: T1 },
  viewAll: { fontFamily: FONTS.medium, fontSize: 13, color: GOLD },
  emptyT: { fontFamily: FONTS.regular, fontSize: 13, color: T3, fontStyle: 'italic' },

  // timeline
  timeline: { paddingLeft: 6 },
  tlLine: { position: 'absolute', left: 29, top: 22, bottom: 0, width: 2, backgroundColor: '#2d2a22' },
  tlItem: { flexDirection: 'row', marginBottom: 18 },
  tlTimeCol: { width: 48, alignItems: 'center', zIndex: 1 },
  tlCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: GOLD, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  tlH: { fontFamily: FONTS.semibold, fontSize: 13, color: GOLD, lineHeight: 15 },
  tlAp: { fontFamily: FONTS.medium, fontSize: 9, color: GOLD },
  tlCard: { flex: 1, marginLeft: 16, backgroundColor: CARD, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: CARD_B },
  tlCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  tlTitle: { flex: 1, fontFamily: FONTS.semibold, fontSize: 15, color: T1, marginRight: 8 },
  tlBadge: { backgroundColor: 'rgba(245,208,96,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tlBadgeT: { fontFamily: FONTS.medium, fontSize: 10, color: GOLD },
  tlDetails: { flexDirection: 'row', flexWrap: 'wrap' },
  tlDetailRow: { flexDirection: 'row', alignItems: 'center', marginRight: 18, marginTop: 2 },
  tlDetailT: { fontFamily: FONTS.medium, fontSize: 12, color: T3 },

  // nav
  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: NAV_H, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: NAV_BG, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1e1b14', paddingBottom: Platform.OS === 'ios' ? 18 : 0 },
  navI: { alignItems: 'center', gap: 3 },
  navL: { fontFamily: FONTS.medium, fontSize: 9, color: '#78716c', letterSpacing: 0.6, textTransform: 'uppercase' },
  fabW: { marginTop: -26 },
  fab: { width: 50, height: 50, borderRadius: 25, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: BG },
});
