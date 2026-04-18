import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const BG = '#16130c';
const CARD_BG = '#221f18';
const CARD_BORDER = 'rgba(77,70,54,0.25)';
const TEXT_PRIMARY = '#e9e2d5';
const TEXT_SECONDARY = '#d0c6b0';
const GOLD = '#f5d060';

export default function MakeRequestScreen() {
  const router = useRouter();
  const { kind } = useLocalSearchParams();
  const [requestType, setRequestType] = useState('leave');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(true);
  const [steps, setSteps] = useState([{ approver: '', role: '', email: '', status: 'pending', remarks: '' }]);

  const config = useMemo(() => {
    if (kind === 'issue') {
      return {
        pageTitle: 'Report Issue',
        pageSubtitle: 'Submit a campus issue for support and follow-up.',
        type: 'custom',
        titlePlaceholder: 'Issue Title',
        descriptionPlaceholder: 'Describe the issue clearly (location, impact, and urgency).',
        submitText: 'Submit Issue',
      };
    }
    return {
      pageTitle: 'Make a Request',
      pageSubtitle: 'Create a formal request and track its approval.',
      type: 'leave',
      titlePlaceholder: 'Request Title',
      descriptionPlaceholder: 'Write your request details here.',
      submitText: 'Submit Request',
    };
  }, [kind]);

  React.useEffect(() => {
    if (kind === 'issue') {
      setRequestType('custom');
    }
    fetchApprovers();
  }, [kind]);

  const fetchApprovers = async () => {
    try {
      setLoadingApprovers(true);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/request/approvers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load approvers');
      setApprovers(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Unable to load approvers');
    } finally {
      setLoadingApprovers(false);
    }
  };

  const updateStep = (index, patch) => {
    setSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const addStep = () => {
    setSteps((prev) => [...prev, { approver: '', role: '', email: '', status: 'pending', remarks: '' }]);
  };

  const removeStep = (index) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Required', 'Please fill in both title and description.');
      return;
    }
    if (steps.length === 0) {
      Alert.alert('Required', 'Please add at least one approval step.');
      return;
    }

    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('token');
      const resolveApproverByEmail = async (email, role) => {
        const qp = new URLSearchParams({
          email: String(email || '').trim().toLowerCase(),
        });
        if (role) qp.set('role', role);

        const res = await fetch(`${API_BASE}/request/resolve-approver?${qp.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `Could not resolve approver for ${email}`);
        }
        return data;
      };

      const normalizedSteps = [];
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];
        let approverId = step.approver;
        let role = step.role;
        const email = step.email?.trim().toLowerCase();

        if (!approverId && email) {
          const resolved = await resolveApproverByEmail(email, role);
          approverId = resolved?._id;
          role = resolved?.role || role;
        }

        if (!approverId || !role) {
          Alert.alert('Required', `Step ${index + 1} needs a valid approver id (or email) and role.`);
          setSubmitting(false);
          return;
        }

        normalizedSteps.push({
          order: index + 1,
          approver: approverId,
          role,
          status: 'pending',
          remarks: step.remarks?.trim() || '',
        });
      }

      const res = await fetch(`${API_BASE}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: requestType || config.type,
          title: title.trim(),
          description: description.trim(),
          steps: normalizedSteps,
          meta: {
            source: kind === 'issue' ? 'report_issue' : 'make_request',
            category: kind === 'issue' ? 'issue' : 'request',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit');
      }

      Alert.alert('Success', `${config.submitText} submitted successfully.`);
      router.back();
    } catch (error) {
      Alert.alert('Error', error.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={GOLD} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{config.pageTitle}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitle}>{config.pageSubtitle}</Text>

          {kind !== 'issue' && (
            <>
              <Text style={styles.label}>REQUEST TYPE</Text>
              <View style={styles.typeRow}>
                {['leave', 'certificate', 'lor', 'research', 'room', 'event_permission'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, requestType === type && styles.typeChipActive]}
                    onPress={() => setRequestType(type)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeChipText, requestType === type && styles.typeChipTextActive]}>
                      {type.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={config.titlePlaceholder}
            placeholderTextColor="#8f846f"
            style={styles.input}
          />

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={config.descriptionPlaceholder}
            placeholderTextColor="#8f846f"
            style={[styles.input, styles.textarea]}
            multiline
            textAlignVertical="top"
          />

          <View style={styles.stepHeaderRow}>
            <Text style={styles.label}>APPROVAL STEPS</Text>
            <TouchableOpacity onPress={addStep}>
              <Text style={styles.addStepText}>+ Add Step</Text>
            </TouchableOpacity>
          </View>

          {loadingApprovers ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={GOLD} />
              <Text style={styles.loadingText}>Loading approvers...</Text>
            </View>
          ) : (
            steps.map((step, index) => (
              <View key={`${index}-${step.approver}`} style={styles.stepCard}>
                <View style={styles.stepTop}>
                  <Text style={styles.stepTitle}>Step {index + 1}</Text>
                  {steps.length > 1 && (
                    <TouchableOpacity onPress={() => removeStep(index)}>
                      <Feather name="x-circle" size={18} color="#d78686" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.stepLabel}>Approver</Text>
                <View style={styles.approverList}>
                  {approvers.slice(0, 20).map((ap) => {
                    const selected = step.approver === ap._id;
                    return (
                      <TouchableOpacity
                        key={ap._id}
                        style={[styles.approverChip, selected && styles.approverChipActive]}
                        onPress={() =>
                          updateStep(index, { approver: ap._id, role: ap.role, email: (ap.email || '').toLowerCase() })
                        }
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.approverChipText, selected && styles.approverChipTextActive]}>
                          {ap.name} ({ap.role})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  value={step.email}
                  onChangeText={(text) => updateStep(index, { email: text })}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Or enter approver email (e.g. hod@college.edu)"
                  placeholderTextColor="#8f846f"
                  style={styles.input}
                />

                <TextInput
                  value={step.remarks}
                  onChangeText={(text) => updateStep(index, { remarks: text })}
                  placeholder="Optional remarks for this step"
                  placeholderTextColor="#8f846f"
                  style={styles.input}
                />
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.82}
          >
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : config.submitText}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a251d' },
  headerTitle: { marginLeft: 12, fontFamily: FONTS.bold, fontSize: 24, color: TEXT_PRIMARY },
  card: { backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, padding: 18 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY, marginBottom: 18 },
  label: { fontFamily: FONTS.medium, fontSize: 11, letterSpacing: 1, color: TEXT_SECONDARY, marginBottom: 8 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3a342a',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1c1914',
  },
  typeChipActive: { backgroundColor: GOLD, borderColor: GOLD },
  typeChipText: { color: TEXT_SECONDARY, fontFamily: FONTS.medium, fontSize: 10 },
  typeChipTextActive: { color: BG },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a342a',
    backgroundColor: '#1c1914',
    paddingHorizontal: 14,
    color: TEXT_PRIMARY,
    fontFamily: FONTS.medium,
    fontSize: 14,
    marginBottom: 14,
  },
  textarea: {
    minHeight: 130,
    paddingTop: 12,
  },
  stepHeaderRow: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addStepText: { color: GOLD, fontFamily: FONTS.semibold, fontSize: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  loadingText: { color: TEXT_SECONDARY, fontFamily: FONTS.medium, fontSize: 13 },
  stepCard: {
    borderWidth: 1,
    borderColor: '#3a342a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#1c1914',
  },
  stepTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stepTitle: { color: TEXT_PRIMARY, fontFamily: FONTS.semibold, fontSize: 14 },
  stepLabel: { color: TEXT_SECONDARY, fontFamily: FONTS.medium, fontSize: 11, marginBottom: 7 },
  approverList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  approverChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a342a',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  approverChipActive: { borderColor: GOLD, backgroundColor: 'rgba(245,208,96,0.12)' },
  approverChipText: { color: TEXT_SECONDARY, fontFamily: FONTS.medium, fontSize: 11 },
  approverChipTextActive: { color: GOLD },
  submitBtn: {
    marginTop: 6,
    height: 48,
    borderRadius: 24,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontFamily: FONTS.semibold, fontSize: 15, color: BG },
});
