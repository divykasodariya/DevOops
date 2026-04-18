import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const BG = '#16130c';
const CARD_BG = '#221f18';
const CARD_BORDER = 'rgba(77,70,54,0.25)';
const TEXT_PRIMARY = '#e9e2d5';
const TEXT_SECONDARY = '#d0c6b0';
const GOLD = '#f5d060';

const CATEGORIES = ['it', 'facility', 'electrical', 'plumbing', 'safety', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export default function ReportIssueScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('facility');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !location.trim()) {
      Alert.alert('Required', 'Please add title and location.');
      return;
    }

    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/issues`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          location: location.trim(),
          priority,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit issue');
      }

      Alert.alert('Success', 'Issue reported successfully.');
      router.back();
    } catch (error) {
      Alert.alert('Error', error.message || 'Issue submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Feather name="arrow-left" size={20} color={GOLD} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Issue</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitle}>Log a campus issue for technical or facility support.</Text>

          <Text style={styles.label}>TITLE</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Issue title"
            placeholderTextColor="#8f846f"
            style={styles.input}
          />

          <Text style={styles.label}>LOCATION</Text>
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Building, floor, room"
            placeholderTextColor="#8f846f"
            style={styles.input}
          />

          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, category === item && styles.chipActive]}
                onPress={() => setCategory(item)}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10
                }}>
                <Text style={[styles.chipText, category === item && styles.chipTextActive]}>
                  {item.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>PRIORITY</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, priority === item && styles.chipActive]}
                onPress={() => setPriority(item)}
                hitSlop={{
                  top: 10,
                  bottom: 10,
                  left: 10,
                  right: 10
                }}>
                <Text style={[styles.chipText, priority === item && styles.chipTextActive]}>
                  {item.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what happened and when"
            placeholderTextColor="#8f846f"
            style={[styles.input, styles.textarea]}
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.82}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10
            }}>
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit Issue'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG , paddingTop: Platform.OS === 'android' ? 64 : 88 },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2a251d' },
  headerTitle: { marginLeft: 12, fontFamily: FONTS.bold, fontSize: 24, color: TEXT_PRIMARY },
  card: { backgroundColor: CARD_BG, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, padding: 18 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: TEXT_SECONDARY, marginBottom: 18 },
  label: { fontFamily: FONTS.medium, fontSize: 11, letterSpacing: 1, color: TEXT_SECONDARY, marginBottom: 8 },
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
  textarea: { minHeight: 120, paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3a342a',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1c1914',
  },
  chipActive: { backgroundColor: GOLD, borderColor: GOLD },
  chipText: { color: TEXT_SECONDARY, fontFamily: FONTS.medium, fontSize: 10 },
  chipTextActive: { color: BG },
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
