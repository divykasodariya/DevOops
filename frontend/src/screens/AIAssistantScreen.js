import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FONTS } from '../theme/typography';

const BG = '#16130c';
const NAV_BG = '#0c0a07';
const BUBBLE_ASSISTANT = '#2b2419';
const BUBBLE_USER = '#f5d060';
const TEXT_PRIMARY = '#e9e2d5';
const TEXT_MUTED = '#9e947f';
const TEXT_DARK = '#201a10';
const GOLD = '#f5d060';
const BORDER = 'rgba(77,70,54,0.35)';
const CHAT_STORAGE_KEY = 'aether_chat_messages_v1';
const TEXT_SECONDARY = '#b5aa95';   // subtitles, supporting text

const quickReply = (message) => {
  const q = message.toLowerCase();
  if (q.includes('balance') || q.includes('card')) {
    return 'Your current campus card balance is $142.50. You spent $12.00 yesterday at the coffee shop.';
  }
  if (q.includes('chapter') || q.includes('read')) {
    return "You need to read Chapter 4: Market Forces of Supply and Demand. I've highlighted the key formulas in your notebook.";
  }
  if (q.includes('schedule') || q.includes('class')) {
    return 'Your next class starts in 45 minutes at Building C. I can set a reminder 10 minutes before it begins.';
  }
  return 'I can help with your classes, notes, schedule, and campus services. Tell me what you want to do next.';
};

export default function AIAssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialInput = typeof params?.q === 'string' ? params.q : '';
  const didInitFromQuery = useRef(false);
  const [input, setInput] = useState(initialInput);
  const [messages, setMessages] = useState([]);

  const starterMessages = useMemo(
    () => [
      {
        id: '1',
        role: 'assistant',
        text: 'Good morning, Julian. Your first class, Microeconomics, starts in 45 minutes at Building C. Would you like me to pull up your recent notes?',
        time: '08:15 AM',
      },
      {
        id: '2',
        role: 'user',
        text: "Yes, please. And remind me what chapter we're supposed to have read.",
        time: '08:17 AM',
      },
      {
        id: '3',
        role: 'assistant',
        text: "You need to have read Chapter 4: Market Forces of Supply and Demand. I've highlighted the key formulas in your notebook.",
        time: '08:18 AM',
        card: {
          title: 'STUDY MATERIAL',
          subtitle: 'Chapter 4 Summary & Formulas',
        },
      },
      {
        id: '4',
        role: 'user',
        text: "Perfect. What's my balance on my campus card?",
        time: '08:20 AM',
      },
      {
        id: '5',
        role: 'assistant',
        text: 'Your current campus card balance is $142.50. You spent $12.00 at the coffee shop yesterday.',
        time: '08:21 AM',
      },
    ],
    []
  );

  useEffect(() => {
    const hydrate = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (!raw) {
          setMessages(starterMessages);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        } else {
          setMessages(starterMessages);
        }
      } catch (_) {
        setMessages(starterMessages);
      }
    };
    hydrate();
  }, [starterMessages]);

  useEffect(() => {
    if (!messages.length) return;
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  useEffect(() => {
    const fromQuery = initialInput.trim();
    if (!fromQuery || !messages.length || didInitFromQuery.current) return;
    didInitFromQuery.current = true;
    setMessages((prev) => [
      ...prev,
      { id: `seed-user-${Date.now()}`, role: 'user', text: fromQuery, time: 'Now' },
      { id: `seed-assistant-${Date.now()}`, role: 'assistant', text: quickReply(fromQuery), time: 'Now' },
    ]);
    setInput('');
  }, [initialInput, messages.length]);

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const now = new Date();
    const userMessage = {
      id: `u-${now.getTime()}`,
      role: 'user',
      text,
      time: 'Now',
    };
    const botMessage = {
      id: `a-${now.getTime()}`,
      role: 'assistant',
      text: quickReply(text),
      time: 'Now',
    };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInput('');
  };

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="robot-outline" size={16} color={GOLD} />
          </View>
          <Text style={styles.brandTitle}>Aether AI</Text>
          <View style={styles.onlineDot} />
        </View>
        <TouchableOpacity style={styles.bellBtn} activeOpacity={0.75}>
          <Feather name="bell" size={18} color={GOLD} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dayPill}>
          <Text style={styles.dayPillText}>Today</Text>
        </View>

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <View key={msg.id} style={[styles.messageWrap, isUser ? styles.userWrap : styles.assistantWrap]}>
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : styles.assistantBubbleText]}>{msg.text}</Text>
                {!!msg.card && (
                  <View style={styles.inlineCard}>
                    <View style={styles.inlineCardIcon}>
                      <Feather name="book-open" size={16} color={GOLD} />
                    </View>
                    <View>
                      <Text style={styles.inlineCardTitle}>{msg.card.title}</Text>
                      <Text style={styles.inlineCardSubtitle}>{msg.card.subtitle}</Text>
                    </View>
                  </View>
                )}
              </View>
              <Text style={[styles.timeLabel, isUser ? styles.timeLabelUser : null]}>{msg.time}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.composerRow}>
        <TouchableOpacity style={styles.plusBtn} activeOpacity={0.75}>
          <Feather name="plus-circle" size={21} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Aether"
            placeholderTextColor={TEXT_MUTED}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.micBtn} activeOpacity={0.75}>
            <Feather name="mic" size={18} color={GOLD} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.85}
        >
          <Feather name="arrow-up" size={18} color={BG} />
        </TouchableOpacity>
      </View>

      <View style={styles.nav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/dashboard')}>
          <Feather name="home" size={20} color={TEXT_MUTED} />
          <Text style={styles.navLabel}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/schedule')}>
          <Feather name="calendar" size={20} color={TEXT_MUTED} />
          <Text style={styles.navLabel}>SCHEDULE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.85}>
          <MaterialCommunityIcons name="robot-outline" size={20} color={GOLD} />
          <Text style={[styles.navLabel, styles.navLabelActive]}>AI ASSISTANT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="bell" size={20} color={TEXT_MUTED} />
          <Text style={styles.navLabel}>ALERTS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Feather name="user" size={20} color={TEXT_MUTED} />
          <Text style={styles.navLabel}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const NAV_H = Platform.OS === 'ios' ? 84 : 66;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 22,
    paddingHorizontal: 16,
    height: Platform.OS === 'ios' ? 108 : 76,
    backgroundColor: '#0f0d09',
    borderBottomWidth: 1,
    borderBottomColor: '#201c15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1d1912',
  },
  brandTitle: { color: GOLD, fontFamily: FONTS.bold, fontSize: 23 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  bellBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },

  thread: { flex: 1 },
  threadContent: { paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 30 },
  dayPill: {
    alignSelf: 'center',
    backgroundColor: '#2a251d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 12,
  },
  dayPillText: { color: TEXT_MUTED, fontFamily: FONTS.medium, fontSize: 11 },
  messageWrap: { marginBottom: 12, maxWidth: '86%' },
  assistantWrap: { alignSelf: 'flex-start' },
  userWrap: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  assistantBubble: { backgroundColor: BUBBLE_ASSISTANT },
  userBubble: { backgroundColor: BUBBLE_USER },
  bubbleText: { fontFamily: FONTS.medium, fontSize: 22, lineHeight: 31 },
  assistantBubbleText: { color: TEXT_PRIMARY },
  userBubbleText: { color: TEXT_DARK },
  timeLabel: { marginTop: 4, marginLeft: 4, fontFamily: FONTS.medium, fontSize: 10, color: TEXT_MUTED },
  timeLabelUser: { textAlign: 'right', marginRight: 4, marginLeft: 0 },

  inlineCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#201b13',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245,208,96,0.14)',
  },
  inlineCardTitle: { color: TEXT_PRIMARY, fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 0.8 },
  inlineCardSubtitle: { color: TEXT_SECONDARY, fontFamily: FONTS.medium, fontSize: 12, marginTop: 2 },

  composerRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#15120d',
    borderTopWidth: 1,
    borderTopColor: '#201c15',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plusBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3b3428',
    backgroundColor: '#1a1610',
    borderRadius: 18,
    height: 40,
    paddingLeft: 12,
    paddingRight: 4,
  },
  input: { flex: 1, color: TEXT_PRIMARY, fontFamily: FONTS.medium, fontSize: 14 },
  micBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },

  nav: {
    height: NAV_H,
    backgroundColor: NAV_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1e1b14',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 18 : 0,
  },
  navItem: { alignItems: 'center', gap: 2, minWidth: 48 },
  navLabel: {
    fontFamily: FONTS.medium,
    fontSize: 9,
    color: TEXT_MUTED,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  navLabelActive: { color: GOLD },
});
