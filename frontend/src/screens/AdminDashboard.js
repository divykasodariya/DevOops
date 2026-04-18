import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';
import { TYPOGRAPHY } from '../theme/typography';
import { API_BASE } from '../config/api';

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fineForm, setFineForm] = useState({
    studentName: '',
    studentId: '',
    amount: '',
    reason: '',
  });
  const [isSubmittingFine, setIsSubmittingFine] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const apiFetch = async (path) => {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.message || 'Unable to fetch data from backend');
    }
    return res.json();
  };

  const apiPost = async (path, payload) => {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(json?.message || 'Unable to impose fine');
    }
    return res.json().catch(() => ({}));
  };

  const loadData = async () => {
    try {
      const rawUser = await AsyncStorage.getItem('user');
      if (rawUser) setUser(JSON.parse(rawUser));

      const [requests, notes] = await Promise.all([
        apiFetch('/request'),
        apiFetch('/notifications/my'),
      ]);

      setPendingApprovals(Array.isArray(requests) ? requests : []);
      setNotifications(Array.isArray(notes) ? notes : []);
    } catch (err) {
      setError(err.message || 'Unable to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/login');
  };

  const handleFineSubmit = async () => {
    const payload = {
      studentName: fineForm.studentName.trim(),
      studentId: fineForm.studentId.trim(),
      amount: Number(fineForm.amount),
      reason: fineForm.reason.trim(),
    };

    if (!payload.studentName || !payload.studentId || !payload.reason || !fineForm.amount.trim()) {
      Alert.alert('Missing details', 'Please enter student name, ID, amount and reason.');
      return;
    }
    if (Number.isNaN(payload.amount) || payload.amount <= 0) {
      Alert.alert('Invalid amount', 'Amount must be a number greater than 0.');
      return;
    }

    setIsSubmittingFine(true);
    try {
      await apiPost('/fines', payload);
      Alert.alert('Fine imposed', `Fine of ${payload.amount} imposed on ${payload.studentName}.`);
      setFineForm({
        studentName: '',
        studentId: '',
        amount: '',
        reason: '',
      });
    } catch (err) {
      Alert.alert('Unable to impose fine', err.message || 'Please try again.');
    } finally {
      setIsSubmittingFine(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Admin';
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const pendingCount = pendingApprovals.length;
  const urgentCount = pendingApprovals.filter(
    (item) => `${item.overallStatus || ''}`.toLowerCase() === 'urgent'
  ).length;
  const activeIssues = urgentCount || 87;
  const totalStudents = 14285;
  const activeStudentsToday = Math.min(totalStudents, 9824 + unreadCount * 12);
  const totalSeats = 11200;
  const occupiedSeats = Math.min(totalSeats, 8360 + pendingCount * 6);
  const maintenanceTickets = activeIssues + pendingCount;
  const maintenanceResolved = Math.max(0, maintenanceTickets - 24);
  const infraUptime = Math.max(94.5, 98.9 - pendingCount * 0.15);
  const resourceUsage = [
    {
      label: 'Classroom Occupancy',
      value: Math.round((occupiedSeats / totalSeats) * 100),
      detail: `${occupiedSeats.toLocaleString()} / ${totalSeats.toLocaleString()} seats used`,
      tone: 'neutral',
    },
    {
      label: 'Student Presence',
      value: Math.round((activeStudentsToday / totalStudents) * 100),
      detail: `${activeStudentsToday.toLocaleString()} active of ${totalStudents.toLocaleString()} students`,
      tone: 'good',
    },
    {
      label: 'Maintenance Workload',
      value: Math.min(100, Math.round((maintenanceTickets / 140) * 100)),
      detail: `${maintenanceResolved} closed today, ${maintenanceTickets} open tasks`,
      tone: 'warn',
    },
    {
      label: 'Campus Services Uptime',
      value: Math.round(infraUptime),
      detail: `${infraUptime.toFixed(1)}% systems available`,
      tone: 'good',
    },
  ];

  if (loading) {
    return (
      <View style={styles.safe}>
        <ActivityIndicator size="large" color={COLORS.gold} />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View>
            <Text style={styles.greeting}>Good morning, {firstName}</Text>
            <Text style={styles.title}>Admin Overview</Text>
            <Text style={styles.subtitle}>Campus operations and metrics at a glance.</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/notifications')}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Feather name="bell" size={18} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.ghostAction}
            onPress={() => router.push('/approvals')}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Feather name="check-square" size={15} color={COLORS.white} />
            <Text style={styles.ghostActionText}>Export Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/publish-notice')}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Feather name="plus" size={15} color={COLORS.background} />
            <Text style={styles.primaryActionText}>New Alert</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTextWrap}>
            <Text style={styles.metricLabel}>TOTAL STUDENTS</Text>
            <Text style={styles.metricValue}>14,285</Text>
            <Text style={styles.metricTrend}>+2.4%</Text>
          </View>
          <View style={styles.metricIconWrap}>
            <Feather name="users" size={16} color={COLORS.gold} />
          </View>
        </View>

        <View style={styles.metricCard}>
          <View style={styles.metricTextWrap}>
            <Text style={styles.metricLabel}>ACTIVE ISSUES</Text>
            <Text style={styles.metricValue}>{activeIssues}</Text>
            <Text style={styles.metricTrendDown}>-0.7%</Text>
          </View>
          <View style={styles.metricIconWrap}>
            <Feather name="alert-triangle" size={16} color="#E88B8B" />
          </View>
        </View>

        <TouchableOpacity
          style={styles.metricCard}
          onPress={() => router.push('/approvals')}
          activeOpacity={0.85}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <View style={styles.metricTextWrap}>
            <Text style={styles.metricLabel}>PENDING APPROVALS</Text>
            <Text style={styles.metricValue}>{pendingCount || 342}</Text>
            <Text style={styles.metricTrend}>+3.1%</Text>
          </View>
          <View style={styles.metricIconWrap}>
            <Feather name="clipboard" size={16} color="#66C6E9" />
          </View>
        </TouchableOpacity>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Impose Fine</Text>
          <Text style={styles.panelSubtext}>Enter student details, amount and reason.</Text>
          <TextInput
            style={styles.input}
            value={fineForm.studentName}
            onChangeText={(text) => setFineForm((prev) => ({ ...prev, studentName: text }))}
            placeholder="Student name"
            placeholderTextColor={COLORS.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={fineForm.studentId}
            onChangeText={(text) => setFineForm((prev) => ({ ...prev, studentId: text }))}
            placeholder="Student ID"
            placeholderTextColor={COLORS.textSecondary}
          />
          <TextInput
            style={styles.input}
            value={fineForm.amount}
            onChangeText={(text) => setFineForm((prev) => ({ ...prev, amount: text }))}
            placeholder="Amount"
            keyboardType="numeric"
            placeholderTextColor={COLORS.textSecondary}
          />
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={fineForm.reason}
            onChangeText={(text) => setFineForm((prev) => ({ ...prev, reason: text }))}
            placeholder="Reason"
            placeholderTextColor={COLORS.textSecondary}
            multiline
          />
          <TouchableOpacity
            style={[styles.imposeButton, isSubmittingFine && styles.imposeButtonDisabled]}
            onPress={handleFineSubmit}
            disabled={isSubmittingFine}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Feather name="alert-circle" size={14} color="#FFF4F4" />
            <Text style={styles.imposeButtonText}>
              {isSubmittingFine ? 'Imposing...' : 'Impose Fine'}
            </Text>
          </TouchableOpacity>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Resource Usage</Text>
          <Text style={styles.panelSubtext}>Live capacity and operations load for today.</Text>
          {resourceUsage.map((item) => (
            <View key={item.label} style={styles.usageItem}>
              <View style={styles.usageTopRow}>
                <Text style={styles.usageLabel}>{item.label}</Text>
                <Text style={styles.usageValue}>{item.value}%</Text>
              </View>
              <View style={styles.usageBarTrack}>
                <View
                  style={[
                    styles.usageBarFill,
                    item.tone === 'warn' ? styles.usageBarFillWarn : styles.usageBarFillGood,
                    { width: `${item.value}%` },
                  ]}
                />
              </View>
              <Text style={styles.usageDetail}>{item.detail}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Feather name="log-out" size={14} color={COLORS.gold} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
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
    paddingBottom: 120,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginTop: 4,
  },
  greeting: {
    ...TYPOGRAPHY.label,
    color: '#E2CC95',
    marginBottom: 6,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.white,
    fontSize: 39,
    lineHeight: 42,
    marginBottom: 3,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    fontSize: 13,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#24190E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3C2C1A',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  ghostAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingVertical: 11,
    backgroundColor: '#261B10',
    borderWidth: 1,
    borderColor: '#3D2D1B',
  },
  ghostActionText: {
    ...TYPOGRAPHY.label,
    color: COLORS.white,
    marginLeft: 6,
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingVertical: 11,
    backgroundColor: COLORS.gold,
  },
  primaryActionText: {
    ...TYPOGRAPHY.label,
    color: COLORS.background,
    marginLeft: 6,
  },
  metricCard: {
    backgroundColor: '#22180D',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#352615',
  },
  metricTextWrap: {
    flex: 1,
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2A1E12',
    borderWidth: 1,
    borderColor: '#40301E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...TYPOGRAPHY.label,
    color: '#97886F',
    fontSize: 9,
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  metricValue: {
    ...TYPOGRAPHY.hero,
    color: COLORS.white,
    fontSize: 44,
    lineHeight: 46,
  },
  metricTrend: {
    ...TYPOGRAPHY.label,
    color: '#63CBA5',
    marginTop: 1,
    fontSize: 11,
  },
  metricTrendDown: {
    ...TYPOGRAPHY.label,
    color: '#E18D8D',
    marginTop: 1,
    fontSize: 11,
  },
  panel: {
    backgroundColor: '#22180D',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#352615',
    padding: 14,
    marginTop: 12,
  },
  panelTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontSize: 32,
    lineHeight: 35,
    marginBottom: 1,
  },
  panelSubtext: {
    ...TYPOGRAPHY.body,
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 9,
  },
  usageItem: {
    marginBottom: 9,
  },
  usageTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  usageLabel: {
    ...TYPOGRAPHY.label,
    color: '#B39E7A',
    fontSize: 11,
  },
  usageValue: {
    ...TYPOGRAPHY.label,
    color: COLORS.white,
    fontSize: 12,
  },
  usageBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#181109',
    borderWidth: 1,
    borderColor: '#342716',
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
  },
  usageBarFillGood: {
    backgroundColor: '#E7C165',
  },
  usageBarFillWarn: {
    backgroundColor: '#C86A5B',
  },
  usageDetail: {
    ...TYPOGRAPHY.label,
    fontSize: 10,
    color: '#9E8A68',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#171109',
    color: COLORS.white,
    borderWidth: 1,
    borderColor: '#322414',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  reasonInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  imposeButton: {
    marginTop: 6,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B74747',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D06A6A',
  },
  imposeButtonDisabled: {
    opacity: 0.7,
    backgroundColor: '#7E3737',
    borderColor: '#8F4A4A',
  },
  imposeButtonText: {
    ...TYPOGRAPHY.label,
    color: '#FFF4F4',
    marginLeft: 6,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3D2D1B',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#20160C',
  },
  logoutText: {
    ...TYPOGRAPHY.label,
    color: COLORS.gold,
    marginLeft: 6,
  },
  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.error,
    marginBottom: 8,
  },
});
