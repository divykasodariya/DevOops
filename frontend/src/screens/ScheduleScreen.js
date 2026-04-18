import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  runOnJS,
  SlideInLeft,
  SlideInRight,
  ZoomIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';
import { SPACING } from '../theme/spacing';
import PressableScale from '../components/dashboard/PressableScale';

const theme = {
  bg: '#16130c',
  surface: '#221f18',
  surface2: '#2a2419',
  primary: '#f5d060',
  text: '#e9e2d5',
  textMuted: '#9e947f',
  darkText: '#1a1610',
  line: 'rgba(245, 208, 96, 0.28)',
  radiusCard: 18,
};

const S = { xs: 8, sm: 12, md: 16, lg: 20 };

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d) {
  return sameDay(d, new Date());
}

const formatTime = (iso) => {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

/** Monday-first leading padding + current month + trailing to full weeks */
function buildMonthGrid(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstMondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const prevMonthLast = new Date(year, month, 0).getDate();

  const grid = [];
  for (let i = 0; i < firstMondayOffset; i += 1) {
    grid.push({
      key: `p-${year}-${month}-${i}`,
      date: prevMonthLast - firstMondayOffset + i + 1,
      muted: true,
      fullDate: null,
    });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    grid.push({
      key: `c-${year}-${month}-${d}`,
      date: d,
      muted: false,
      fullDate: new Date(year, month, d),
    });
  }
  let n = 1;
  while (grid.length % 7 !== 0) {
    grid.push({ key: `n-${year}-${month}-${n}`, date: n, muted: true, fullDate: null });
    n += 1;
  }
  return grid;
}

export default function ScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [displayMonth, setDisplayMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [monthSlide, setMonthSlide] = useState(1); // +1 next, -1 prev — drives enter animation
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/schedule/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) setSchedules(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Error fetching schedule:', e);
    } finally {
      setLoading(false);
    }
  };

  const monthGrid = useMemo(
    () => buildMonthGrid(displayMonth.year, displayMonth.month),
    [displayMonth.year, displayMonth.month]
  );

  const filteredEvents = useMemo(
    () =>
      schedules
        .filter((s) => sameDay(new Date(s.start), selectedDate))
        .sort((a, b) => new Date(a.start) - new Date(b.start)),
    [schedules, selectedDate]
  );

  const dateKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;

  const hasEventOnDate = useCallback(
    (d) => schedules.some((s) => sameDay(new Date(s.start), d)),
    [schedules]
  );

  const goPrevMonth = useCallback(() => {
    setMonthSlide(-1);
    setDisplayMonth((dm) => {
      let m = dm.month - 1;
      let y = dm.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
      return { year: y, month: m };
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setMonthSlide(1);
    setDisplayMonth((dm) => {
      let m = dm.month + 1;
      let y = dm.year;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      return { year: y, month: m };
    });
  }, []);

  const swipeMonth = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .onEnd((e) => {
      if (e.translationX < -48) {
        runOnJS(goNextMonth)();
      } else if (e.translationX > 48) {
        runOnJS(goPrevMonth)();
      }
    });

  const onSelectDay = useCallback((fullDate) => {
    setSelectedDate(fullDate);
    if (fullDate.getMonth() !== displayMonth.month || fullDate.getFullYear() !== displayMonth.year) {
      setDisplayMonth({ year: fullDate.getFullYear(), month: fullDate.getMonth() });
    }
  }, [displayMonth.month, displayMonth.year]);

  const onToday = useCallback(() => {
    const n = new Date();
    setSelectedDate(n);
    setDisplayMonth({ year: n.getFullYear(), month: n.getMonth() });
  }, []);

  const enteringMonth = monthSlide >= 0 ? SlideInRight.duration(240) : SlideInLeft.duration(240);

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: Math.max(insets.top, S.sm) }]} edges={['left', 'right']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appHeader}>
        <PressableScale
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
        </PressableScale>
        <Text style={styles.headerTitle}>Schedule</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: month + Today */}
        <View style={styles.headerTextRow}>
          <View style={{ flex: 1, paddingRight: S.sm }}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              {monthNames[displayMonth.month]} {displayMonth.year}
            </Text>
            <Text style={styles.pageSubtitle}>Tap a date to see events</Text>
          </View>
          <PressableScale style={styles.todayBtn} onPress={onToday} accessibilityLabel="Jump to today">
            <Ionicons name="calendar-clear-outline" size={15} color={theme.primary} />
            <Text style={styles.todayBtnText}>Today</Text>
          </PressableScale>
        </View>

        {/* Book a space — compact, above calendar */}
        <PressableScale
          style={styles.bookSpaceShadow}
          onPress={() => router.push('/book-space')}
          accessibilityLabel="Book a space"
        >
          <LinearGradient
            colors={['#e7c355', '#c59d2b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookSpaceBtn}
          >
            <Ionicons name="business-outline" size={20} color={theme.darkText} style={{ marginRight: S.sm }} />
            <Text style={styles.bookSpaceBtnText}>Book a Space</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.darkText} style={{ marginLeft: S.xs }} />
          </LinearGradient>
        </PressableScale>

        {/* Calendar — primary block */}
        <GestureDetector gesture={swipeMonth}>
          <View style={styles.monthCard}>
            <View style={styles.monthHeaderRow}>
              <Text style={styles.monthTitle}>{monthNames[displayMonth.month]}</Text>
              <View style={styles.monthArrows}>
                <PressableScale onPress={goPrevMonth} style={styles.arrowHit} accessibilityLabel="Previous month">
                  <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
                </PressableScale>
                <PressableScale onPress={goNextMonth} style={styles.arrowHit} accessibilityLabel="Next month">
                  <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                </PressableScale>
              </View>
            </View>
            <Text style={styles.swipeHint}>Swipe calendar to change month</Text>

            <Animated.View key={`${displayMonth.year}-${displayMonth.month}`} entering={enteringMonth}>
              <View style={styles.calendarGrid}>
                {WEEK_LABELS.map((d) => (
                  <View key={d} style={[styles.calDayLabelCell, { width: `${100 / 7}%` }]}>
                    <Text style={styles.calDayLabel}>{d}</Text>
                  </View>
                ))}
                {monthGrid.map((item) => {
                  if (item.muted || !item.fullDate) {
                    return (
                      <View key={item.key} style={[styles.calCell, { width: `${100 / 7}%` }]}>
                        <Text style={styles.calDateMuted}>{item.date}</Text>
                      </View>
                    );
                  }
                  const d = item.fullDate;
                  const selected = sameDay(d, selectedDate);
                  const today = isToday(d);
                  const hasEv = hasEventOnDate(d);

                  return (
                    <View key={item.key} style={[styles.calCell, { width: `${100 / 7}%` }]}>
                      <PressableScale
                        style={[
                          styles.dayTouch,
                          selected && styles.dayTouchSelected,
                          today && !selected && styles.dayTouchToday,
                        ]}
                        onPress={() => onSelectDay(d)}
                        scaleTo={0.92}
                        accessibilityLabel={`${monthNames[d.getMonth()]} ${d.getDate()}`}
                      >
                        <Text style={[styles.calDate, selected && styles.calDateSelected]}>{item.date}</Text>
                        {hasEv && <View style={[styles.eventDot, selected && styles.eventDotOnSelected]} />}
                      </PressableScale>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        </GestureDetector>

        {/* Events — timeline */}
        <View style={styles.eventsSection}>
          <Text style={styles.sectionLabel}>EVENTS</Text>
          <Text style={styles.sectionTitle}>
            {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: S.lg }} />
          ) : (
            <Animated.View key={dateKey} entering={FadeInDown.duration(300)} style={styles.timelineWrap}>
              {filteredEvents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={40} color={theme.textMuted} />
                  <Text style={styles.emptyTitle}>No events scheduled for this day</Text>
                  <Text style={styles.emptySub}>Pick another date or use Book a Space above.</Text>
                </View>
              ) : (
                <View style={styles.timelineList}>
                  {filteredEvents.map((ev, index) => {
                    const endDate = new Date(ev.end);
                    const diffMin = Math.max(0, Math.round((endDate - new Date(ev.start)) / 60000));
                    const durStr =
                      diffMin >= 60 ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `${diffMin} min`;
                    const isFirst = index === 0;
                    const isLast = index === filteredEvents.length - 1;
                    const stagger = Math.min(index * 48, 360);

                    return (
                      <View key={ev._id} style={styles.timelineRow}>
                        <View style={styles.tlTimeCol}>
                          <Text style={styles.tlTime} numberOfLines={1}>
                            {formatTime(ev.start)}
                          </Text>
                          <Text style={styles.tlDur} numberOfLines={1}>
                            {durStr}
                          </Text>
                        </View>

                        <View style={styles.tlTrack}>
                          {isFirst ? (
                            <View style={styles.tlSegGapTop} />
                          ) : (
                            <View style={styles.tlSegUp} />
                          )}
                          <Animated.View
                            entering={ZoomIn.duration(280).delay(stagger)}
                            style={styles.tlDotWrap}
                          >
                            <View style={styles.tlDot} />
                          </Animated.View>
                          {!isLast ? <View style={styles.tlSegDown} /> : <View style={styles.tlSegGapBot} />}
                        </View>

                        <View style={styles.tlCardOuter}>
                          <PressableScale
                            style={styles.tlCard}
                            onPress={() => {
                              try {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              } catch {
                                /* optional */
                              }
                            }}
                            scaleTo={0.96}
                            accessibilityLabel={`${ev.title || 'Event'} at ${formatTime(ev.start)}`}
                          >
                            <Text
                              style={styles.tlTitle}
                              numberOfLines={3}
                              ellipsizeMode="tail"
                            >
                              {ev.title || ev.course?.name || 'Event'}
                            </Text>
                            <View style={styles.tlMetaRow}>
                              <Ionicons name="location-outline" size={14} color={theme.textMuted} />
                              <Text style={styles.tlLocation} numberOfLines={2} ellipsizeMode="tail">
                                {ev.room || ev.location || 'Location TBD'}
                              </Text>
                            </View>
                            {(ev.type || ev.kind) ? (
                              <View style={styles.typePill}>
                                <Text style={styles.typePillText} numberOfLines={1}>
                                  {(ev.type || ev.kind || 'schedule').toString()}
                                </Text>
                              </View>
                            ) : null}
                          </PressableScale>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.medium,
    paddingVertical: S.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: 'rgba(245, 208, 96, 0.22)',
  },
  headerTitle: {
    marginLeft: S.sm,
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: theme.primary,
  },
  scrollView: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContent: {
    paddingHorizontal: SPACING.medium,
    paddingTop: S.xs,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: theme.bg,
  },

  headerTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: S.md,
  },
  pageTitle: {
    fontFamily: FONTS.bold,
    fontSize: 26,
    color: theme.text,
    marginBottom: 4,
  },
  pageSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: theme.textMuted },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: 'rgba(245, 208, 96, 0.32)',
    borderRadius: 100,
    paddingHorizontal: S.md,
    paddingVertical: S.xs,
    gap: 6,
  },
  todayBtnText: { fontFamily: FONTS.semibold, fontSize: 12, color: theme.primary },

  bookSpaceShadow: {
    marginBottom: S.md,
    borderRadius: theme.radiusCard,
    ...Platform.select({
      ios: {
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  bookSpaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: theme.radiusCard,
    paddingHorizontal: S.md,
  },
  bookSpaceBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: theme.darkText,
    flex: 1,
    textAlign: 'center',
  },

  monthCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.radiusCard,
    padding: S.md,
    marginBottom: S.lg,
    borderWidth: 1,
    borderColor: theme.line,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.xs,
    paddingHorizontal: S.xs,
  },
  monthTitle: { fontFamily: FONTS.semibold, fontSize: 16, color: theme.text },
  monthArrows: { flexDirection: 'row', gap: S.xs },
  arrowHit: { padding: S.xs },
  swipeHint: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: S.sm,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calDayLabelCell: {
    alignItems: 'center',
    marginBottom: S.sm,
  },
  calDayLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: theme.textMuted,
    letterSpacing: 0.3,
  },
  calCell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    minHeight: 44,
  },
  dayTouch: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayTouchSelected: {
    backgroundColor: theme.primary,
  },
  dayTouchToday: {
    borderWidth: 1.5,
    borderColor: theme.primary,
    backgroundColor: 'rgba(245, 208, 96, 0.08)',
  },
  calDate: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: theme.text,
  },
  calDateSelected: {
    color: theme.darkText,
  },
  calDateMuted: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: theme.textMuted,
    opacity: 0.45,
    paddingVertical: 10,
  },
  eventDot: {
    marginTop: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.primary,
  },
  eventDotOnSelected: {
    backgroundColor: theme.darkText,
  },

  eventsSection: {
    marginTop: S.xs,
    width: '100%',
    maxWidth: '100%',
  },
  sectionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: theme.textMuted,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: theme.text,
    marginBottom: S.md,
  },
  timelineWrap: {
    minHeight: 72,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  timelineList: {
    paddingTop: 4,
    paddingBottom: S.md,
    width: '100%',
    maxWidth: '100%',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 22,
    width: '100%',
    maxWidth: '100%',
    backgroundColor: theme.bg,
  },
  tlCardOuter: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: '100%',
  },
  tlTimeCol: {
    width: 70,
    paddingRight: 10,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  tlTime: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    color: theme.primary,
    textAlign: 'right',
  },
  tlDur: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
  tlTrack: {
    width: 28,
    alignItems: 'center',
  },
  tlSegGapTop: {
    height: 8,
  },
  tlSegGapBot: {
    height: 8,
  },
  tlSegUp: {
    width: 2,
    height: 22,
    backgroundColor: theme.line,
    borderRadius: 1,
  },
  tlSegDown: {
    width: 2,
    height: 28,
    backgroundColor: theme.line,
    borderRadius: 1,
  },
  tlDotWrap: {
    marginVertical: 2,
  },
  tlDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.bg,
    borderWidth: 2,
    borderColor: theme.primary,
  },
  tlCard: {
    width: '100%',
    maxWidth: '100%',
    marginLeft: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: S.md,
    borderWidth: 1,
    borderColor: theme.line,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  tlTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
    lineHeight: 21,
    color: theme.text,
    marginBottom: S.xs,
    flexShrink: 1,
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
  tlMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: S.xs,
    minWidth: 0,
    maxWidth: '100%',
  },
  tlLocation: {
    flex: 1,
    minWidth: 0,
    fontFamily: FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: theme.textMuted,
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
  typePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 208, 96, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 208, 96, 0.25)',
  },
  typePillText: {
    fontFamily: FONTS.semibold,
    fontSize: 10,
    color: theme.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.large,
    paddingHorizontal: S.md,
  },
  emptyTitle: {
    fontFamily: FONTS.semibold,
    fontSize: 16,
    color: theme.text,
    marginTop: S.sm,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: theme.textMuted,
    marginTop: S.xs,
    textAlign: 'center',
  },
});
