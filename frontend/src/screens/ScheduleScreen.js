import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const theme = {
  bg: '#1A1008',
  surface: '#2A1F0F',
  surface2: '#3D2E18',
  primary: '#F5D060',
  text: '#FFFFFF',
  textMuted: '#A89070',
  darkText: '#1A1008',
  radiusCard: 20,
  radiusPill: 100,
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const dayNamesMed = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay() || 7;

const formatTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ScheduleScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
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

  const getWeeklyStrip = () => {
    const base = new Date(selectedDate);
    const day = base.getDay();
    const diff = base.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const strip = [];
    for (let i = 0; i < 5; i += 1) {
      const d = new Date(new Date(base).setDate(diff + i));
      strip.push({
        day: dayNamesMed[d.getDay()],
        date: d.getDate(),
        fullDate: d,
        active: d.toDateString() === selectedDate.toDateString(),
      });
    }
    return strip;
  };

  const generateMonthGrid = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);

    const grid = [];
    const prevDays = getDaysInMonth(month - 1 < 0 ? 11 : month - 1, month - 1 < 0 ? year - 1 : year);
    for (let i = firstDay - 1; i > 0; i -= 1) {
      grid.push({ date: prevDays - i + 1, muted: true });
    }
    for (let i = 1; i <= daysInMonth; i += 1) {
      const d = new Date(year, month, i);
      grid.push({
        date: i,
        active: d.toDateString() === selectedDate.toDateString(),
        fullDate: d,
        hasEvent: schedules.some((s) => new Date(s.start).toDateString() === d.toDateString()),
      });
    }
    const remaining = 7 - (grid.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i += 1) {
        grid.push({ date: i, muted: true });
      }
    }
    return grid;
  };

  const filteredEvents = useMemo(
    () =>
      schedules
        .filter((s) => new Date(s.start).toDateString() === selectedDate.toDateString())
        .sort((a, b) => new Date(a.start) - new Date(b.start)),
    [schedules, selectedDate]
  );

  const handlePrevMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const handleNextMonth = () => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + 1);
    setSelectedDate(d);
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.appHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.headerTextRow}>
          <View>
            <Text style={styles.pageTitle}>
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </Text>
            <Text style={styles.pageSubtitle}>Calendar & Events</Text>
          </View>
          <TouchableOpacity
            style={styles.todayBtn}
            onPress={() => setSelectedDate(new Date())}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Ionicons name="calendar-clear-outline" size={14} color={theme.primary} />
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => router.push('/book-space')}
          style={styles.bookSpaceShadow}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <LinearGradient
            colors={['#e7c355', '#c59d2b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookSpaceBtn}
          >
            <Ionicons name="business-outline" size={20} color={theme.darkText} style={{ marginRight: 10 }} />
            <Text style={styles.bookSpaceBtnText}>Book a Space</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.darkText} style={{ marginLeft: 8 }} />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.weeklyStrip}>
          {getWeeklyStrip().map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.weekDayCol}
              onPress={() => setSelectedDate(item.fullDate)}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10
              }}>
              <Text style={styles.weekDayText}>{item.day}</Text>
              <View style={[styles.dateCircle, item.active && styles.dateCircleActive]}>
                <Text style={[styles.weekDateText, item.active && styles.weekDateTextActive]}>{item.date}</Text>
              </View>
              {schedules.some((s) => new Date(s.start).toDateString() === item.fullDate.toDateString()) ? (
                <View style={styles.dotIndicator} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          Events for {monthNames[selectedDate.getMonth()].slice(0, 3)} {selectedDate.getDate()}
        </Text>

        {loading ? (
          <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 20 }} />
        ) : filteredEvents.length === 0 ? (
          <Text style={styles.emptyText}>No events scheduled for this date.</Text>
        ) : (
          filteredEvents.map((ev) => {
            const startDate = new Date(ev.start);
            const endDate = new Date(ev.end);
            const diffMin = Math.max(0, Math.round((endDate - startDate) / 60000));
            const durStr =
              diffMin >= 60 ? `${Math.floor(diffMin / 60)}h ${diffMin % 60}m` : `${diffMin}m`;

            return (
              <View key={ev._id} style={styles.eventCard}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{formatTime(ev.start)}</Text>
                  <Text style={styles.durationText}>{durStr}</Text>
                </View>
                <View style={styles.eventDivider} />
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{ev.title || 'Class'}</Text>
                  <View style={styles.eventLocationRow}>
                    <Ionicons name="location-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.eventLocation}>{ev.room || ev.location || 'TBD'}</Text>
                  </View>
                  <Text style={styles.eventType}>{ev.type || 'schedule'}</Text>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.monthCard}>
          <View style={styles.monthHeaderRow}>
            <Text style={styles.monthTitle}>{monthNames[selectedDate.getMonth()]}</Text>
            <View style={styles.monthArrows}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={{ padding: 4 }}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10
                }}>
                <Ionicons name="chevron-back" size={18} color={theme.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={{ padding: 4, marginLeft: 8 }}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10
                }}>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.calendarGrid}>
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <Text key={d} style={styles.calDayLabel}>
                {d}
              </Text>
            ))}
            {generateMonthGrid().map((item, index) => {
              if (item.muted) {
                return (
                  <Text key={index} style={styles.calDateMuted}>
                    {item.date}
                  </Text>
                );
              }
              if (item.active) {
                return (
                  <View key={index} style={styles.calDateHighlight}>
                    <Text style={styles.calDateActive}>{item.date}</Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.calDateCell}
                  onPress={() => setSelectedDate(item.fullDate)}
                  hitSlop={{
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10
                  }}>
                  <Text style={styles.calDate}>{item.date}</Text>
                  {item.hasEvent && <View style={styles.dotIndicatorSmall} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
    
  , paddingTop: Platform.OS === 'android' ? 64 : 88 },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#271F11',
    borderWidth: 1,
    borderColor: 'rgba(245, 208, 96, 0.22)',
  },
  headerTitle: {
    marginLeft: 12,
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: theme.primary,
  },
  scrollContent: { padding: 20, paddingBottom: 40 },

  headerTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    color: theme.text,
    marginBottom: 4,
  },
  pageSubtitle: { fontFamily: FONTS.regular, fontSize: 13, color: theme.textMuted },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#271F11',
    borderWidth: 1,
    borderColor: 'rgba(245, 208, 96, 0.3)',
    borderRadius: theme.radiusPill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  todayBtnText: { fontFamily: FONTS.semibold, fontSize: 12, color: theme.primary },

  bookSpaceShadow: {
    marginBottom: 20,
    borderRadius: 16,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  bookSpaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
  },
  bookSpaceBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: theme.darkText,
    flex: 1,
    textAlign: 'center',
  },

  weeklyStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.surface,
    borderRadius: theme.radiusCard,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  weekDayCol: { alignItems: 'center', gap: 8 },
  weekDayText: { fontFamily: FONTS.medium, fontSize: 12, color: theme.textMuted },
  dateCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  dateCircleActive: { backgroundColor: theme.primary },
  weekDateText: { fontFamily: FONTS.medium, fontSize: 14, color: theme.text },
  weekDateTextActive: { color: theme.darkText, fontFamily: FONTS.bold },
  dotIndicator: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.primary },
  dotPlaceholder: { width: 4, height: 4 },

  sectionTitle: { fontFamily: FONTS.medium, fontSize: 16, color: theme.text, marginBottom: 16 },
  emptyText: { color: theme.textMuted, marginBottom: 20, fontFamily: FONTS.regular },

  eventCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 208, 96, 0.08)',
  },
  timeCol: { justifyContent: 'center', alignItems: 'center', width: 64 },
  timeText: { fontFamily: FONTS.semibold, fontSize: 11, color: theme.text },
  durationText: { fontFamily: FONTS.regular, fontSize: 10, color: theme.textMuted, marginTop: 4 },
  eventDivider: { width: 2, backgroundColor: theme.surface2, borderRadius: 1, marginHorizontal: 12 },
  eventInfo: { flex: 1, justifyContent: 'center' },
  eventTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: theme.text, marginBottom: 4 },
  eventLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventLocation: { fontFamily: FONTS.medium, fontSize: 11, color: theme.textMuted },
  eventType: {
    marginTop: 8,
    alignSelf: 'flex-start',
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: theme.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  monthCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.radiusCard,
    padding: 16,
    marginTop: 8,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  monthTitle: { fontFamily: FONTS.medium, fontSize: 14, color: theme.text },
  monthArrows: { flexDirection: 'row' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 12,
  },
  calDate: {
    textAlign: 'center',
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: theme.text,
    paddingVertical: 8,
  },
  calDateMuted: {
    width: '14.28%',
    textAlign: 'center',
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: theme.textMuted,
    opacity: 0.5,
    paddingVertical: 8,
  },
  calDateHighlight: { width: '14.28%', alignItems: 'center', justifyContent: 'center' },
  calDateActive: {
    backgroundColor: theme.primary,
    color: theme.darkText,
    fontFamily: FONTS.bold,
    fontSize: 12,
    width: 28,
    height: 28,
    lineHeight: 28,
    textAlign: 'center',
    borderRadius: 14,
    marginTop: -2,
    overflow: 'hidden',
  },
  calDateCell: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    paddingVertical: 4,
  },
  dotIndicatorSmall: {
    position: 'absolute',
    bottom: 2,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.primary,
  },
});
