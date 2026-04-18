import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE } from '../config/api';
import { FONTS } from '../theme/typography';

const BG = '#16130c';
const CARD = '#221f18';
const BORDER = 'rgba(77,70,54,0.3)';
const T1 = '#e9e2d5';
const T2 = '#d0c6b0';
const T3 = '#99907d';
const GOLD = '#f5d060';

const formatWhen = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
};

export default function AlertsScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    const res = await fetch(`${API_BASE}/notifications/announcements`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to load announcements');
    }
    setItems(Array.isArray(data) ? data : []);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch {
      /* keep list */
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={GOLD} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcements</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <Text style={styles.empty}>No announcements yet.</Text>
          ) : (
            items.map((item) => (
              <View key={item._id} style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{formatWhen(item.createdAt)}</Text>
                <Text style={styles.cardBody}>{item.body || ''}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2d2a22',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a251d',
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 20, color: T1 },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { fontFamily: FONTS.regular, fontSize: 15, color: T3, fontStyle: 'italic', textAlign: 'center', marginTop: 32 },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 17, color: T1, marginBottom: 6 },
  cardMeta: { fontFamily: FONTS.medium, fontSize: 12, color: T3, marginBottom: 10 },
  cardBody: { fontFamily: FONTS.regular, fontSize: 15, color: T2, lineHeight: 22 },
});
