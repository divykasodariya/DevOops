import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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
  successText: '#4CAF50',
  successBorder: 'rgba(76, 175, 80, 0.4)',
  errorText: '#EF5350',
  errorBorder: 'rgba(239, 83, 80, 0.4)',
  cardBorder: 'rgba(255,255,255,0.06)',
  radiusCard: 16,
  radiusPill: 100,
};

const tabs = ['All', 'Leave', 'Certificate'];

const toTabType = (requestType = '') => {
  const t = requestType.toLowerCase();
  if (t === 'leave') return 'Leave';
  if (t === 'certificate' || t === 'lor') return 'Certificate';
  return 'All';
};

const formatType = (requestType = '') => {
  if (!requestType) return 'Request';
  if (requestType.toLowerCase() === 'lor') return 'Certificate';
  return requestType.charAt(0).toUpperCase() + requestType.slice(1);
};

const formatDate = (dateString) => {
  if (!dateString) return 'Date unavailable';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Date unavailable';
  }
};

// ── BUG FIX 1: Safe ID comparison that handles ObjectId objects, strings, and null ──
// MongoDB ObjectIds are objects with a toString() method. A direct === check between
// an ObjectId and a plain string always returns false even if the values are identical.
const idsMatch = (a, b) => {
  if (!a || !b) return false;
  return String(a) === String(b);
};

// ── BUG FIX 2: Safely extract approver ID regardless of whether the field is
//    populated (returns an object like { _id, name }) or unpopulated (returns a string) ──
const getApproverId = (approver) => {
  if (!approver) return null;
  if (typeof approver === 'string') return approver;
  // Populated object — use ._id (coerce to string via idsMatch)
  return approver._id ?? null;
};

const InitialAvatar = ({ name }) => {
  const initials = (name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
};

export default function ApprovalsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab]       = useState('All');
  const [requests, setRequests]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [actioningId, setActioningId]   = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    loadCurrentUser();
    fetchRequests();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const rawUser = await AsyncStorage.getItem('user');
      if (!rawUser) return;
      const parsed = JSON.parse(rawUser);
      // Coerce to string immediately so all comparisons stay in string-land
      setCurrentUserId(parsed?._id ? String(parsed._id) : null);
    } catch {
      setCurrentUserId(null);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/request`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load approvals');
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to fetch approvals.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    // ── BUG FIX 3: Don't render anything until we know who the faculty IS.
    //    The original code used `approverId && currentUserId ? ... : true` which
    //    means "if we don't have a currentUserId yet, show EVERY pending request".
    //    This caused the opposite problem on a fast connection: a flash of all items.
    //    More critically, on slow loads it never recovered because currentUserId stayed
    //    null and the comparison branch was never re-evaluated correctly.
    //    Now we gate on currentUserId being ready before applying the approver filter. ──
    if (!currentUserId) return [];

    const actionable = requests.filter((req) => {
      // Must be pending
      if (!req || req.overallStatus !== 'pending') return false;

      // Must have a valid steps array and a currentStep index
      if (!Array.isArray(req.steps) || typeof req.currentStep !== 'number') return false;

      const step = req.steps[req.currentStep];
      if (!step) return false;

      // ── Use the safe helpers so ObjectId vs string is never an issue ──
      const approverId = getApproverId(step.approver);
      return idsMatch(approverId, currentUserId);
    });

    if (activeTab === 'All') return actionable;
    return actionable.filter((req) => toTabType(req.type) === activeTab);
  }, [activeTab, requests, currentUserId]);

  const pendingCount = filteredRequests.length;

  const handleAction = async (id, action) => {
    try {
      setActioningId(id);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/request/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ requestId: id, action, remarks: '' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${action} request`);

      await fetchRequests();
    } catch (error) {
      Alert.alert('Error', error.message || 'Action failed.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Approvals · {pendingCount}</Text>
      </View>

      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabFilter, activeTab === tab && styles.tabFilterActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Show spinner while either user or requests are still loading */}
        {loading || !currentUserId ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : filteredRequests.length === 0 ? (
          <Text style={styles.emptyText}>No pending approvals.</Text>
        ) : (
          filteredRequests.map((req) => (
            <View key={req._id} style={styles.card}>
              <View style={styles.cardInfo}>
                <InitialAvatar name={req.requestedBy?.name || 'User'} />
                <View style={styles.textContent}>
                  <Text style={styles.nameText}>{req.requestedBy?.name || 'Unknown User'}</Text>
                  <Text style={styles.typeText}>
                    {formatType(req.type)} Request
                    {req.title ? ` · ${req.title}` : ''}
                  </Text>
                  <Text style={styles.dateText}>Submitted {formatDate(req.createdAt)}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnReject]}
                  onPress={() => handleAction(req._id, 'reject')}
                  disabled={actioningId === req._id}
                  activeOpacity={0.8}
                >
                  {actioningId === req._id
                    ? <ActivityIndicator size="small" color={theme.errorText} />
                    : <>
                        <Ionicons name="close-outline" size={18} color={theme.errorText} />
                        <Text style={styles.rejectText}>Reject</Text>
                      </>
                  }
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnApprove]}
                  onPress={() => handleAction(req._id, 'approve')}
                  disabled={actioningId === req._id}
                  activeOpacity={0.8}
                >
                  {actioningId === req._id
                    ? <ActivityIndicator size="small" color={theme.successText} />
                    : <>
                        <Ionicons name="checkmark-outline" size={18} color={theme.successText} />
                        <Text style={styles.approveText}>Approve</Text>
                      </>
                  }
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    marginRight: 12,
    padding: 2,
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: theme.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  tabFilter: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: theme.radiusPill,
    backgroundColor: '#1E1710',
  },
  tabFilterActive: {
    backgroundColor: theme.primary,
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#D0BCA0',
  },
  tabTextActive: {
    color: theme.bg,
    fontFamily: FONTS.bold,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    gap: 14,
  },
  loaderWrap: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 40,
    textAlign: 'center',
    fontFamily: FONTS.medium,
    color: theme.textMuted,
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radiusCard,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 14,
    backgroundColor: theme.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,208,96,0.35)',
  },
  avatarText: {
    fontFamily: FONTS.bold,
    color: theme.primary,
    fontSize: 17,
  },
  textContent: {
    flex: 1,
  },
  nameText: {
    fontFamily: FONTS.semibold,
    fontSize: 18,
    color: theme.text,
    marginBottom: 2,
  },
  typeText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: '#D0BCA0',
    marginBottom: 4,
  },
  dateText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: 'rgba(168, 144, 112, 0.8)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.radiusPill,
    borderWidth: 1,
    gap: 6,
  },
  btnReject: {
    borderColor: theme.errorBorder,
  },
  rejectText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: theme.errorText,
  },
  btnApprove: {
    borderColor: theme.successBorder,
  },
  approveText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
    color: theme.successText,
  },
});