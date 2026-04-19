import { SafeAreaView } from "react-native-safe-area-context";
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
  Linking,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const theme = {
  bg:            '#1A1008',
  surface:       '#2A1F0F',
  surface2:      '#3D2E18',
  primary:       '#F5D060',
  text:          '#FFFFFF',
  textMuted:     '#A89070',
  successText:   '#4CAF50',
  successBorder: 'rgba(76, 175, 80, 0.4)',
  errorText:     '#EF5350',
  errorBorder:   'rgba(239, 83, 80, 0.4)',
  cardBorder:    'rgba(255,255,255,0.06)',
  radiusCard:    16,
  radiusPill:    100,
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
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return 'Date unavailable';
  }
};

// Normalise ids from API: string hex, { $oid }, populated { _id, name }, or odd RN JSON shapes.

const HEX24 = /^[a-f0-9]{24}$/i;

/**
 * Extract a plain 24-char hex id from any wire shape (populate, BSON EJSON, RN quirks).
 */
const toIdString = (value) => {
  if (value == null || value === '') return null;

  if (typeof value === 'string') return HEX24.test(value) ? value : null;

  if (typeof value === 'object') {
    if (typeof value.$oid === 'string' && HEX24.test(value.$oid)) return value.$oid;

    if (value._id !== undefined) return toIdString(value._id);

    // Rare: ObjectId bytes as numeric keys "0".."11" after JSON round-trips
    const keys = Object.keys(value).filter((k) => /^\d+$/.test(k));
    if (keys.length === 12) {
      const hex = keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => (Number(value[k]) & 0xff).toString(16).padStart(2, '0'))
        .join('');
      if (HEX24.test(hex)) return hex;
    }

    if (typeof value.toString === 'function') {
      const t = value.toString();
      if (HEX24.test(t)) return t;
    }
  }

  const s = String(value);
  return HEX24.test(s) ? s : null;
};

const isOverallPending = (s) => String(s || '').toLowerCase() === 'pending';

const toStepIndex = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return -1;
  return n;
};

/** Safe equality check between any two ID-like values */
const idsMatch = (a, b) => {
  const sa = toIdString(a);
  const sb = toIdString(b);
  return !!sa && !!sb && sa === sb;
};

// ─────────────────────────────────────────────────────────────────────────────

const InitialAvatar = ({ name }) => {
  const initials = (name || 'U')
    .split(' ')
    .map((p) => p[0])
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

  const [activeTab, setActiveTab]         = useState('All');
  const [requests, setRequests]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [actioningId, setActioningId]     = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    // Load both in parallel — filteredRequests gates on both being ready
    loadCurrentUser();
    fetchRequests();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // Normalise immediately so all comparisons stay in plain-string land
      const id = toIdString(parsed?._id);
      setCurrentUserId(id);
    } catch {
      setCurrentUserId(null);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${API_BASE}/request`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load approvals');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to fetch approvals.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    // Backend already scopes results to what this user may see / act on
    const actionable = requests.filter((req) => {
      if (!req || !isOverallPending(req.overallStatus)) return false;
      if (!Array.isArray(req.steps) || req.steps.length === 0) return false;
      const idx = toStepIndex(req.currentStep);
      return idx >= 0 && idx < req.steps.length;
    });

    if (activeTab === 'All') return actionable;
    return actionable.filter((req) => toTabType(req.type) === activeTab);
  }, [activeTab, requests]);

  const pendingCount = filteredRequests.length;

  const handleAction = async (id, action) => {
    try {
      setActioningId(id);
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${API_BASE}/request/action`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ requestId: id, action, remarks: '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${action} request`);
      await fetchRequests();
    } catch (err) {
      Alert.alert('Error', err.message || 'Action failed.');
    } finally {
      setActioningId(null);
    }
  };

  const isReady = !loading;

  return (
    <View style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Pending Approvals · {isReady ? pendingCount : '…'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabFilter, activeTab === tab && styles.tabFilterActive]}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Show spinner while loading OR while user ID is still resolving */}
        {!isReady ? (
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
                  <Text style={styles.nameText}>
                    {req.requestedBy?.name || 'Unknown User'}
                  </Text>
                  <Text style={styles.typeText}>
                    {formatType(req.type)} Request
                    {req.title ? ` · ${req.title}` : ''}
                  </Text>
                  <Text style={styles.dateText}>
                    Submitted {formatDate(req.createdAt)}
                  </Text>
                </View>
              </View>

              {req.attachments && req.attachments.length > 0 && (
                <View style={styles.attachmentsContainer}>
                  {req.attachments.map((att, i) => {
                    const isImage = att.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.fileName);
                    return (
                      <TouchableOpacity 
                        key={i} 
                        style={styles.attachmentItem} 
                        onPress={() => Linking.openURL(att.url).catch(() => Alert.alert('Error', 'Could not open attachment.'))}
                        activeOpacity={0.8}
                      >
                        {isImage ? (
                           <Image source={{ uri: att.url }} style={styles.attachmentImage} resizeMode="cover" />
                        ) : (
                           <View style={styles.attachmentIconWrap}>
                             <Ionicons name="document-text" size={24} color={theme.primary} />
                           </View>
                        )}
                        <Text style={styles.attachmentText} numberOfLines={1}>{att.fileName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnReject]}
                  onPress={() => handleAction(req._id, 'reject')}
                  disabled={actioningId === req._id}
                  activeOpacity={0.8}
                >
                  {actioningId === req._id ? (
                    <ActivityIndicator size="small" color={theme.errorText} />
                  ) : (
                    <>
                      <Ionicons name="close-outline" size={18} color={theme.errorText} />
                      <Text style={styles.rejectText}>Reject</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.btnApprove]}
                  onPress={() => handleAction(req._id, 'approve')}
                  disabled={actioningId === req._id}
                  activeOpacity={0.8}
                >
                  {actioningId === req._id ? (
                    <ActivityIndicator size="small" color={theme.successText} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-outline" size={18} color={theme.successText} />
                      <Text style={styles.approveText}>Approve</Text>
                    </>
                  )}
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
    paddingTop: Platform.OS === 'android' ? 64 : 88,
  },
  header: {
    flexDirection:       'row',
    alignItems:          'center',
    paddingHorizontal:   20,
    paddingVertical:     16,
    borderBottomWidth:   StyleSheet.hairlineWidth,
    borderBottomColor:   'rgba(255,255,255,0.08)',
  },
  backButton:  { marginRight: 12, padding: 2 },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 24, color: theme.primary },

  tabContainer: {
    flexDirection:    'row',
    paddingHorizontal: 20,
    paddingVertical:  14,
    gap:              12,
  },
  tabFilter: {
    paddingHorizontal: 18,
    paddingVertical:   8,
    borderRadius:      theme.radiusPill,
    backgroundColor:   '#1E1710',
  },
  tabFilterActive: { backgroundColor: theme.primary },
  tabText:         { fontFamily: FONTS.medium, fontSize: 14, color: '#D0BCA0' },
  tabTextActive:   { color: theme.bg, fontFamily: FONTS.bold },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 36, gap: 14 },
  loaderWrap:    { marginTop: 40, alignItems: 'center' },
  emptyText:     {
    marginTop: 40, textAlign: 'center',
    fontFamily: FONTS.medium, color: theme.textMuted, fontSize: 14,
  },

  card: {
    backgroundColor: theme.surface,
    borderRadius:    theme.radiusCard,
    padding:         18,
    borderWidth:     1,
    borderColor:     theme.cardBorder,
  },
  cardInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatar: {
    width:           52,
    height:          52,
    borderRadius:    26,
    marginRight:     14,
    backgroundColor: theme.surface2,
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     1,
    borderColor:     'rgba(245,208,96,0.35)',
  },
  avatarText:  { fontFamily: FONTS.bold, color: theme.primary, fontSize: 17 },
  textContent: { flex: 1 },
  nameText:    { fontFamily: FONTS.semibold, fontSize: 18, color: theme.text, marginBottom: 2 },
  typeText:    { fontFamily: FONTS.medium,   fontSize: 14, color: '#D0BCA0',  marginBottom: 4 },
  dateText:    { fontFamily: FONTS.regular,  fontSize: 12, color: 'rgba(168,144,112,0.8)' },

  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.15)',
    padding: 12,
    borderRadius: 12,
  },
  attachmentItem: {
    width: 80,
    alignItems: 'center',
    gap: 6,
  },
  attachmentImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,208,96,0.3)',
  },
  attachmentIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,208,96,0.2)',
  },
  attachmentText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: '#D0BCA0',
    textAlign: 'center',
  },

  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius:   theme.radiusPill,
    borderWidth:    1,
    gap:            6,
  },
  btnReject:   { borderColor: theme.errorBorder },
  rejectText:  { fontFamily: FONTS.semibold, fontSize: 14, color: theme.errorText },
  btnApprove:  { borderColor: theme.successBorder },
  approveText: { fontFamily: FONTS.semibold, fontSize: 14, color: theme.successText },
});