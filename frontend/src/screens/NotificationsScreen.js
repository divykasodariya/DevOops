import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { TYPOGRAPHY } from '../theme/typography';
import { API_BASE } from '../config/api';

function formatWhen(dateValue) {
  if (!dateValue) return 'Just now';
  const date = new Date(dateValue);
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

function typeLabel(type) {
  if (!type) return 'General';
  return String(type).replace(/_/g, ' ');
}

async function resolveHomeRoute() {
  try {
    const raw = await AsyncStorage.getItem('user');
    const u = raw ? JSON.parse(raw) : {};
    const r = String(u.role || '').toLowerCase();
    if (r === 'faculty' || r === 'hod') return '/faculty-dashboard';
    if (r === 'admin' || r === 'principal') return '/admin-dashboard';
    return '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/notifications/my`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Unable to fetch notifications');
      }
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsDone = async (id) => {
    if (!id || markingId) return;
    setMarkingId(String(id));
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Could not mark as read');
      }
      setNotifications((prev) =>
        prev.map((n) => (String(n._id) === String(id) ? { ...n, ...data, isRead: true } : n))
      );
    } catch (err) {
      Alert.alert('Notification', err.message || 'Something went wrong');
    } finally {
      setMarkingId(null);
    }
  };

  const markAllDone = async () => {
    if (markingAll || !notifications.some((n) => !n.isRead)) return;
    setMarkingAll(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Could not mark all read');
      }
      await loadNotifications();
    } catch (err) {
      Alert.alert('Notifications', err.message || 'Something went wrong');
    } finally {
      setMarkingAll(false);
    }
  };

  const { unread, read } = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications : [];
    return {
      unread: list.filter((item) => !item.isRead),
      read: list.filter((item) => item.isRead),
    };
  }, [notifications]);

  const handleBack = async () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const home = await resolveHomeRoute();
    router.replace(home);
  };

  const renderRow = (item, isUnread, hasBorderBottom) => {
    const key = item._id || `${item.title}-${item.createdAt}`;
    const busy = markingId === String(item._id);
    return (
      <TouchableOpacity
        key={key}
        activeOpacity={isUnread ? 0.75 : 1}
        disabled={!isUnread || busy}
        onPress={() => isUnread && markAsDone(item._id)}
        style={[styles.row, isUnread && styles.rowUnread, hasBorderBottom && styles.rowBorder]}
      >
        <View style={styles.rowMain}>
          <View style={styles.rowTitleRow}>
            <Text style={isUnread ? styles.rowTitle : styles.rowTitleRead} numberOfLines={2}>
              {item.title || 'Notification'}
            </Text>
            <Text style={styles.rowWhen}>{formatWhen(item.createdAt || item.updatedAt)}</Text>
          </View>
          <Text style={isUnread ? styles.rowBody : styles.rowBodyRead} numberOfLines={3}>
            {item.body || item.message || 'No additional details.'}
          </Text>
          <View style={styles.rowMeta}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{typeLabel(item.type)}</Text>
            </View>
            {isUnread ? (
              <View style={styles.newPill}>
                <Text style={styles.newPillText}>New · tap to dismiss</Text>
              </View>
            ) : null}
          </View>
        </View>
        {isUnread ? (
          <View style={styles.rowAction}>
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
              <Feather name="check-circle" size={22} color={COLORS.gold} />
            )}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={handleBack}
            activeOpacity={0.85}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={18} color={COLORS.gold} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.kicker}>ALERTS</Text>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>All campus updates in one place.</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.iconCircle, unread.length === 0 && styles.iconDisabled]}
              onPress={markAllDone}
              disabled={unread.length === 0 || markingAll}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {markingAll ? (
                <ActivityIndicator size="small" color={COLORS.gold} />
              ) : (
                <Feather name="check-square" size={15} color={COLORS.gold} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={loadNotifications}
              activeOpacity={0.85}
              hitSlop={{
                top: 10,
                bottom: 10,
                left: 10,
                right: 10
              }}>
              <Feather name="refresh-cw" size={15} color={COLORS.gold} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsPanel}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>UNREAD</Text>
            <Text style={styles.statNum}>{unread.length}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>TOTAL</Text>
            <Text style={styles.statNumMuted}>{notifications.length}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loadingHint}>Loading alerts…</Text>
          </View>
        ) : (
          <>
            {!!error ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={16} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {notifications.length === 0 && !error ? (
              <View style={styles.emptyPanel}>
                <View style={styles.emptyIconWrap}>
                  <Feather name="bell-off" size={28} color={COLORS.muted} />
                </View>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySub}>When something needs your attention, it will show up here.</Text>
              </View>
            ) : (
              <View style={styles.listPanel}>
                {unread.length > 0 ? (
                  <>
                    <Text style={styles.groupLabel}>NEW</Text>
                    {unread.map((item, idx) => {
                      const isLastUnread = idx === unread.length - 1;
                      const hasBorder = !(isLastUnread && read.length === 0);
                      return renderRow(item, true, hasBorder);
                    })}
                  </>
                ) : null}
                {read.length > 0 ? (
                  <>
                    {unread.length > 0 ? <View style={styles.groupSpacer} /> : null}
                    <Text style={styles.groupLabel}>EARLIER</Text>
                    {read.slice(0, 40).map((item, idx, arr) => {
                      const hasBorder = idx < arr.length - 1;
                      return renderRow(item, false, hasBorder);
                    })}
                  </>
                ) : null}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
   paddingTop: Platform.OS === 'android' ? 64 : 88 },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.medium,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#24190E',
    borderWidth: 1,
    borderColor: '#3C2C1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconDisabled: {
    opacity: 0.35,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  kicker: {
    ...TYPOGRAPHY.label,
    color: '#97886F',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.white,
    fontSize: 26,
    lineHeight: 30,
    marginBottom: 2,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  statsPanel: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#22180D',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#352615',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: SPACING.medium,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 4,
  },
  statLabel: {
    ...TYPOGRAPHY.label,
    color: '#97886F',
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statNum: {
    ...TYPOGRAPHY.hero,
    color: COLORS.gold,
    fontSize: 28,
    lineHeight: 30,
  },
  statNumMuted: {
    ...TYPOGRAPHY.hero,
    color: COLORS.white,
    fontSize: 28,
    lineHeight: 30,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingHint: {
    ...TYPOGRAPHY.label,
    color: COLORS.muted,
    marginTop: 12,
    fontSize: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,83,80,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,83,80,0.35)',
    borderRadius: 12,
    padding: 12,
    marginBottom: SPACING.medium,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: '#FFB4AB',
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  emptyPanel: {
    backgroundColor: '#22180D',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#352615',
    padding: SPACING.large,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B140C',
    borderWidth: 1,
    borderColor: '#342716',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.white,
    fontSize: 18,
    marginBottom: 6,
  },
  emptySub: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listPanel: {
    backgroundColor: '#22180D',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#352615',
    paddingHorizontal: 0,
    paddingBottom: 4,
    overflow: 'hidden',
  },
  groupLabel: {
    ...TYPOGRAPHY.label,
    color: '#97886F',
    fontSize: 9,
    letterSpacing: 0.9,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  groupSpacer: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#22180D',
  },
  rowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
    paddingLeft: 11,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowMain: {
    flex: 1,
  },
  rowAction: {
    justifyContent: 'center',
    paddingLeft: 8,
    minWidth: 32,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  rowTitleRead: {
    ...TYPOGRAPHY.body,
    color: '#C9B89A',
    fontSize: 15,
    flex: 1,
    lineHeight: 20,
  },
  rowWhen: {
    ...TYPOGRAPHY.label,
    color: '#8A7A66',
    fontSize: 11,
    marginTop: 1,
    marginLeft: 10,
    flexShrink: 0,
  },
  rowBody: {
    ...TYPOGRAPHY.body,
    color: '#D0C0A5',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  rowBodyRead: {
    ...TYPOGRAPHY.body,
    color: '#9A8B74',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  typePill: {
    alignSelf: 'flex-start',
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#1B140C',
    borderWidth: 1,
    borderColor: '#3A2E1C',
  },
  typePillText: {
    ...TYPOGRAPHY.label,
    color: '#B39E7A',
    fontSize: 10,
    textTransform: 'capitalize',
  },
  newPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(245,208,96,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,208,96,0.35)',
  },
  newPillText: {
    ...TYPOGRAPHY.label,
    color: COLORS.gold,
    fontSize: 10,
  },
});
