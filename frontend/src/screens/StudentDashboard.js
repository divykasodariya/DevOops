import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  TextInput,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import { API_BASE } from '../config/api';
import { PressableScale } from '../components/dashboard';

const BG = '#16130c';
const CARD_BG = '#221f18';
const CARD_BORDER = 'rgba(77,70,54,0.28)';
const TEXT_PRIMARY = '#e9e2d5';
const TEXT_SECONDARY = '#d0c6b0';
const TEXT_MUTED = '#9a9280';
const GOLD = '#f5d060';
const GOLD_DIM = '#e7c355';
const GOLD_MUTED = '#c4b896';
const NAV_BG = '#0c0a07';
const BADGE_RED = '#E53935';

const TY = {
  caption: 11,
  label: 12,
  body: 14,
  bodyLg: 15,
  title: 20,
  hero: 32,
};

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

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

function AttendanceRing({ pct = 0 }) {
  const sz = 88;
  const bw = 6;
  const clear = 'transparent';
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, Math.round(pct)));
    if (target === 0) {
      setDisplay(0);
      return;
    }
    let raf;
    const start = Date.now();
    const dur = 950;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setDisplay(Math.round(target * easeOutCubic(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  return (
    <Animated.View entering={ZoomIn.duration(560)} style={{ width: sz, height: sz, justifyContent: 'center', alignItems: 'center' }}>
      <View style={styles.ringBase} />
      <View
        style={[
          styles.ringProgress,
          {
            width: sz,
            height: sz,
            borderRadius: sz / 2,
            borderWidth: bw,
            borderTopColor: display > 0 ? GOLD : clear,
            borderRightColor: display >= 25 ? GOLD : clear,
            borderBottomColor: display >= 50 ? GOLD : clear,
            borderLeftColor: display >= 75 ? GOLD : clear,
          },
        ]}
      />
      <Text style={styles.ringPct}>{display}%</Text>
    </Animated.View>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  const [user, setUser] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [attendance, setAttendance] = useState({ percentage: 0, status: 'No Data' });
  const [announcements, setAnnouncements] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [askText, setAskText] = useState('');

  /** Fixed footprint so every announcement card matches. */
  const annCardW = Math.min(300, winW * 0.72);
  /** Fits title (2 lines) + body (4 lines) + materials block; all cards share this box. */
  const annCardH = 300;

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial data load only
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
    if (t.includes('career') || t.includes('fair') || t.includes('event')) return { n: 'calendar', c: GOLD_DIM };
    if (t.includes('maintenance') || t.includes('warning') || t.includes('down')) return { n: 'alert-triangle', c: '#ffb4ab' };
    return { n: 'bell', c: GOLD_DIM };
  };

  const openAttachment = async (url) => {
    if (!url) return;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Unable to open file', 'This file link is not supported on your device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Download failed', 'Please try again later.');
    }
  };

  const lightHaptic = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* optional */
    }
  }, []);

  const bottomPad = insets.bottom + NAV_H + 72;

  if (loading) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top + SPACING.small }]}>
        <Animated.View entering={FadeIn.duration(350)} style={styles.loader}>
          <ActivityIndicator size="large" color={GOLD} />
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(420)}>
          <View style={styles.topBar}>
            <View style={styles.topBarL}>
              <InitialAvatar name={user?.name} size={42} />
              <Text style={styles.greeting} numberOfLines={1}>
                {greeting}, {firstName}
              </Text>
            </View>
            <PressableScale
              style={styles.bellBtn}
              onPress={() => {
                lightHaptic();
                router.push('/notifications');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Notifications"
            >
              <Feather name="bell" size={20} color={GOLD} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </PressableScale>
          </View>

          <Animated.View entering={FadeInDown.duration(380).delay(40)}>
            <View style={styles.heroCard}>
              <View style={styles.heroTop}>
                <Text style={styles.heroLabel}>NEXT CLASS</Text>
                <View style={styles.timePill}>
                  <Feather name="clock" size={13} color={GOLD} />
                  <Text style={styles.timePillText}>{nextClass ? fmtTime(nextClass.start) : '--:--'}</Text>
                </View>
              </View>
              <Text
                style={[styles.heroTitle, { fontSize: Math.min(TY.hero, winW * 0.082) }]}
                numberOfLines={2}
              >
                {nextClass?.course?.name || nextClass?.title || 'No upcoming class'}
              </Text>
              <View style={styles.heroMetaRow}>
                <Feather name="map-pin" size={14} color={TEXT_SECONDARY} />
                <Text style={styles.heroMetaText}>{nextClass?.room || nextClass?.location || 'Room TBA'}</Text>
              </View>
              <PressableScale
                style={styles.heroBtn}
                onPress={() => {
                  lightHaptic();
                  router.push('/schedule');
                }}
                accessibilityLabel="View schedule"
              >
                <Text style={styles.heroBtnText}>View Schedule</Text>
              </PressableScale>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(380).delay(80)} style={styles.actionsRow}>
            <PressableScale
              style={[styles.quickBtn, styles.quickBtnPrimary, { flex: 1 }]}
              onPress={() => {
                lightHaptic();
                router.push('/make-request?kind=request');
              }}
            >
              <Feather name="file-plus" size={17} color={BG} />
              <Text style={styles.quickBtnPrimaryText}>Make a Request</Text>
            </PressableScale>
            <PressableScale
              style={[styles.quickBtn, styles.quickBtnSecondary, { flex: 1 }]}
              onPress={() => {
                lightHaptic();
                router.push('/report-issue');
              }}
            >
              <Feather name="alert-octagon" size={17} color={GOLD} />
              <Text style={styles.quickBtnSecondaryText}>Report Issue</Text>
            </PressableScale>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(380).delay(120)} style={styles.grid}>
            <View style={styles.gridCard}>
              <View style={styles.gridHead}>
                <Text style={styles.gridLabel}>PENDING TASKS</Text>
                {pendingTasks.length > 0 && (
                  <View style={styles.taskBadge}>
                    <Text style={styles.taskBadgeT}>{pendingTasks.length > 99 ? '99+' : pendingTasks.length}</Text>
                  </View>
                )}
              </View>
              {pendingTasks.length === 0 ? (
                <View style={styles.emptyTaskWrap}>
                  <Feather name="check-circle" size={22} color={GOLD_DIM} />
                  <Text style={styles.emptyTitle}>{"You're all caught up"}</Text>
                  <Text style={styles.emptySub}>No pending requests right now</Text>
                </View>
              ) : (
                <View style={styles.taskList}>
                  {pendingTasks.slice(0, 2).map((t) => (
                    <PressableScale
                      key={t._id}
                      style={styles.taskRow}
                      onPress={() => router.push('/approvals')}
                    >
                      <View style={styles.chk} />
                      <Text style={styles.taskText} numberOfLines={2}>
                        {t.title}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              )}
            </View>

            <View style={[styles.gridCard, styles.attCard]}>
              <Text style={styles.gridLabel}>ATTENDANCE</Text>
              <View style={styles.ringWrap}>
                <AttendanceRing pct={attendance.percentage || 0} />
              </View>
              <Text style={styles.attStatus}>{attendance.status || 'On Track'}</Text>
            </View>
          </Animated.View>

          <View style={styles.annSection}>
            <View style={styles.annSectionHead}>
              <Text style={styles.secEyebrow}>ANNOUNCEMENTS</Text>
              <Text style={styles.secTitle}>Announcements</Text>
            </View>
            {announcements.length === 0 ? (
              <View style={styles.emptyAnn}>
                <Feather name="inbox" size={22} color={TEXT_MUTED} />
                <Text style={styles.emptyText}>No announcements yet.</Text>
              </View>
            ) : (
              <FlatList
                data={announcements}
                keyExtractor={(i) => i._id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: SPACING.large, paddingVertical: 2 }}
                renderItem={({ item, index }) => {
                  const ic = announcementIcon(item.title);
                  return (
                    <Animated.View
                      key={item._id}
                      entering={FadeInRight.duration(380).delay(Math.min(index * 55, 330))}
                    >
                      <View style={[styles.annCard, { width: annCardW, height: annCardH }]}>
                        <View style={styles.annHead}>
                          <Feather name={ic.n} size={15} color={ic.c} />
                          <Text style={styles.annLabel} numberOfLines={2}>
                            {item.title}
                          </Text>
                        </View>
                        <View style={styles.annBodyWrap}>
                          <Text style={styles.annBody} numberOfLines={4}>
                            {item.body}
                          </Text>
                        </View>
                        <View style={styles.annFooter}>
                          {Array.isArray(item.attachments) && item.attachments.length > 0 ? (
                            <View style={styles.attachmentWrap}>
                              <Text style={styles.attachmentLabel}>Materials</Text>
                              {item.attachments.slice(0, 2).map((attachment, idx) => (
                                <PressableScale
                                  key={`${item._id}-${idx}`}
                                  style={styles.attachmentBtn}
                                  onPress={() => openAttachment(attachment.url)}
                                >
                                  <Feather name="download" size={13} color={GOLD} />
                                  <Text style={styles.attachmentBtnText} numberOfLines={1}>
                                    {attachment.fileName || 'Download file'}
                                  </Text>
                                </PressableScale>
                              ))}
                            </View>
                          ) : (
                            <View style={styles.annFooterSpacer} />
                          )}
                        </View>
                      </View>
                    </Animated.View>
                  );
                }}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[styles.askWrap, { bottom: NAV_H + 10 + insets.bottom }]}>
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
          <PressableScale
            style={styles.micBtn}
            onPress={() => {
              lightHaptic();
              router.push('/ai-assistant');
            }}
            accessibilityLabel="Open AI assistant"
          >
            <Feather name="mic" size={20} color={GOLD} />
          </PressableScale>
        </View>
      </View>

      <View style={[styles.nav, { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 6) }]}>
        <PressableScale style={styles.navItemFlex} onPress={() => lightHaptic()}>
          <Feather name="home" size={22} color={GOLD} />
          <Text style={[styles.navLbl, { color: GOLD }]}>HOME</Text>
        </PressableScale>
        <PressableScale style={styles.navItemFlex} onPress={() => { lightHaptic(); router.push('/schedule'); }}>
          <Feather name="calendar" size={22} color={TEXT_MUTED} />
          <Text style={styles.navLbl}>SCHEDULE</Text>
        </PressableScale>
        <View style={styles.fabWrap}>
          <PressableScale
            style={styles.fab}
            onPress={() => {
              lightHaptic();
              router.push('/ai-assistant');
            }}
            scaleTo={0.94}
          >
            <MaterialCommunityIcons name="robot-outline" size={24} color={BG} />
          </PressableScale>
        </View>
        <PressableScale style={styles.navItemFlex} onPress={() => { lightHaptic(); router.push('/alerts'); }}>
          <Feather name="bell" size={22} color={TEXT_MUTED} />
          <Text style={styles.navLbl}>ALERTS</Text>
        </PressableScale>
        <PressableScale
          style={styles.navItemFlex}
          onPress={() => {
            lightHaptic();
            router.push('/profile');
          }}
        >
          <Feather name="user" size={22} color={TEXT_MUTED} />
          <Text style={styles.navLbl}>PROFILE</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

const NAV_H = Platform.OS === 'ios' ? 78 : 58;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: {
    paddingHorizontal: SPACING.medium,
    paddingTop: SPACING.small,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.medium,
    marginBottom: SPACING.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2d2a22',
  },
  topBarL: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.small },
  greeting: {
    fontFamily: FONTS.semibold,
    fontSize: TY.bodyLg,
    color: TEXT_PRIMARY,
    flexShrink: 1,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2d2a22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: BADGE_RED,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: BG,
  },
  bellBadgeText: { fontFamily: FONTS.bold, fontSize: 9, color: '#fff' },

  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: SPACING.large,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.medium,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.small },
  heroLabel: {
    fontFamily: FONTS.medium,
    fontSize: TY.caption,
    letterSpacing: 1.2,
    color: '#d7c28f',
  },
  timePill: {
    backgroundColor: '#3b3328',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timePillText: { fontFamily: FONTS.semibold, fontSize: TY.label, color: TEXT_PRIMARY },
  heroTitle: {
    fontFamily: FONTS.semibold,
    color: TEXT_PRIMARY,
    lineHeight: 38,
    marginBottom: SPACING.small,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.medium, gap: 8 },
  heroMetaText: { fontFamily: FONTS.medium, fontSize: TY.bodyLg, color: TEXT_SECONDARY },
  heroBtn: {
    alignSelf: 'stretch',
    backgroundColor: GOLD,
    paddingVertical: 12,
    minHeight: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBtnText: { fontFamily: FONTS.semibold, fontSize: TY.bodyLg, color: BG },

  actionsRow: { flexDirection: 'row', gap: SPACING.small, marginBottom: SPACING.medium },
  quickBtn: {
    borderRadius: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: SPACING.small,
  },
  quickBtnPrimary: { backgroundColor: GOLD },
  quickBtnSecondary: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: 'rgba(245,208,96,0.38)' },
  quickBtnPrimaryText: { fontFamily: FONTS.semibold, color: BG, fontSize: TY.label },
  quickBtnSecondaryText: { fontFamily: FONTS.semibold, color: GOLD, fontSize: TY.label },

  grid: { flexDirection: 'row', gap: SPACING.small, marginBottom: SPACING.large, marginTop: 2 },
  gridCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: SPACING.medium,
    borderColor: CARD_BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.14,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  attCard: { alignItems: 'center', justifyContent: 'flex-start' },
  gridHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.small,
    minHeight: 22,
  },
  gridLabel: {
    fontFamily: FONTS.medium,
    fontSize: TY.caption,
    color: TEXT_SECONDARY,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  taskBadge: {
    backgroundColor: '#9b1c26',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  taskBadgeT: { fontFamily: FONTS.semibold, fontSize: TY.caption, color: '#ffdad6' },
  taskList: { gap: SPACING.small },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  chk: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#4d4636',
    marginTop: 3,
  },
  taskText: { flex: 1, fontFamily: FONTS.regular, fontSize: TY.body, color: TEXT_PRIMARY, lineHeight: 20 },
  emptyTaskWrap: { alignItems: 'center', paddingVertical: SPACING.small, gap: 6 },
  emptyTitle: { fontFamily: FONTS.semibold, fontSize: TY.body, color: TEXT_PRIMARY, textAlign: 'center' },
  emptySub: { fontFamily: FONTS.regular, fontSize: TY.label, color: TEXT_MUTED, textAlign: 'center' },
  emptyText: { fontFamily: FONTS.regular, fontSize: TY.body, color: TEXT_SECONDARY, fontStyle: 'italic' },
  emptyAnn: { alignItems: 'center', paddingVertical: SPACING.medium, gap: SPACING.small },

  ringBase: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 6,
    borderColor: '#38342c',
  },
  ringProgress: {
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
  },
  ringPct: { fontFamily: FONTS.semibold, fontSize: 22, color: TEXT_PRIMARY },
  ringWrap: { marginVertical: SPACING.small },
  attStatus: { fontFamily: FONTS.medium, fontSize: TY.label, color: GOLD_MUTED, letterSpacing: 0.3, textAlign: 'center' },

  annSection: { marginBottom: SPACING.medium },
  annSectionHead: { marginBottom: SPACING.small },
  secEyebrow: {
    fontFamily: FONTS.medium,
    fontSize: TY.caption,
    letterSpacing: 1.2,
    color: '#d7c28f',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  secTitle: {
    fontFamily: FONTS.semibold,
    fontSize: TY.title,
    color: TEXT_PRIMARY,
    letterSpacing: 0.2,
  },
  annCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.medium,
    borderColor: CARD_BORDER,
    marginRight: SPACING.small,
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
      },
      android: { elevation: 2 },
    }),
  },
  annHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 40 },
  annLabel: { fontFamily: FONTS.medium, fontSize: TY.body, color: TEXT_SECONDARY, flex: 1 },
  annBodyWrap: {
    flex: 1,
    marginTop: 8,
    justifyContent: 'flex-start',
  },
  annBody: { fontFamily: FONTS.regular, fontSize: TY.body, color: TEXT_PRIMARY, lineHeight: 22 },
  annFooter: {
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  annFooterSpacer: {
    height: 72,
  },
  attachmentWrap: {
    gap: 8,
  },
  attachmentLabel: {
    fontFamily: FONTS.medium,
    fontSize: TY.caption,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1a1710',
    borderWidth: 1,
    borderColor: 'rgba(245,208,96,0.28)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 34,
  },
  attachmentBtnText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: TY.label,
    color: GOLD,
  },

  askWrap: { position: 'absolute', left: SPACING.medium, right: SPACING.medium },
  askBox: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.medium,
    paddingRight: 6,
    minHeight: 50,
    borderColor: CARD_BORDER,
  },
  askInput: { flex: 1, fontFamily: FONTS.regular, fontSize: TY.body, color: TEXT_PRIMARY, paddingVertical: 10 },
  micBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  nav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: NAV_H,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: NAV_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1e1b14',
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  navItemFlex: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  navLbl: { fontFamily: FONTS.medium, fontSize: 9, color: TEXT_MUTED, letterSpacing: 0.6, textTransform: 'uppercase' },
  fabWrap: { marginTop: -26, alignItems: 'center' },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: BG,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: { elevation: 6 },
    }),
  },
});
