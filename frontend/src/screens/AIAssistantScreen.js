import { SafeAreaView } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FONTS } from '../theme/typography';
import { API_BASE } from '../config/api';

const BG = '#16130c';
const NAV_BG = '#0c0a07';
const BUBBLE_ASSISTANT = '#2b2419';
const BUBBLE_USER = '#f5d060';
const TEXT_PRIMARY = '#e9e2d5';
const TEXT_MUTED = '#9e947f';
const TEXT_DARK = '#201a10';
const GOLD = '#f5d060';
const BORDER = 'rgba(77,70,54,0.35)';
const CHAT_STORAGE_KEY = 'aether_chat_messages_v2';
const HISTORY_STORAGE_KEY = 'aether_chat_history_v2';
const TEXT_SECONDARY = '#b5aa95';

const MAX_HISTORY = 12; // keep last N turns for LLM context

export default function AIAssistantScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialInput = typeof params?.q === 'string' ? params.q : '';
  const didInitFromQuery = useRef(false);
  const scrollRef = useRef(null);
  const recordingRef = useRef(null);
  const [input, setInput] = useState(initialInput);
  const [messages, setMessages] = useState([]);
  const [llmHistory, setLlmHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Dot animation for typing indicator
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isLoading) return;
    const anim = Animated.loop(
      Animated.stagger(200, [
        Animated.sequence([
          Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot1, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot2, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot3, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isLoading]);

  const starterMessages = useMemo(
    () => [
      {
        id: 'welcome-1',
        role: 'assistant',
        text: "Hi! I'm Aether AI — your campus assistant. Ask me about attendance, schedules, requests, notices, or anything else!",
        time: formatTime(new Date()),
      },
    ],
    []
  );

  // Hydrate messages from storage
  useEffect(() => {
    const hydrate = async () => {
      try {
        const [rawMsgs, rawHistory] = await Promise.all([
          AsyncStorage.getItem(CHAT_STORAGE_KEY),
          AsyncStorage.getItem(HISTORY_STORAGE_KEY),
        ]);

        if (rawMsgs) {
          const parsed = JSON.parse(rawMsgs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          } else {
            setMessages(starterMessages);
          }
        } else {
          setMessages(starterMessages);
        }

        if (rawHistory) {
          const parsed = JSON.parse(rawHistory);
          if (Array.isArray(parsed)) setLlmHistory(parsed);
        }
      } catch (_) {
        setMessages(starterMessages);
      }
    };
    hydrate();
  }, [starterMessages]);

  // Persist messages
  useEffect(() => {
    if (!messages.length) return;
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  // Persist LLM history
  useEffect(() => {
    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(llmHistory)).catch(() => {});
  }, [llmHistory]);

  // Handle initial query from deep link
  useEffect(() => {
    const fromQuery = initialInput.trim();
    if (!fromQuery || !messages.length || didInitFromQuery.current) return;
    didInitFromQuery.current = true;
    sendMessage(fromQuery);
    setInput('');
  }, [initialInput, messages.length]);

  // Keyboard listeners
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height || 0);
    };
    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim()) return;

    const now = new Date();
    const userMsg = {
      id: `u-${now.getTime()}`,
      role: 'user',
      text: text.trim(),
      time: formatTime(now),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    scrollToEnd();

    try {
      const token = await AsyncStorage.getItem('token');

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text.trim(),
          history: llmHistory.slice(-MAX_HISTORY),
        }),
      });

      const data = await res.json();
      const replyText = data.reply || "Sorry, I couldn't process that. Please try again.";

      const botMsg = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        time: formatTime(new Date()),
        toolCalls: data.tool_calls || [],
      };

      setMessages((prev) => [...prev, botMsg]);

      // Update LLM history for context
      setLlmHistory((prev) => {
        const updated = [
          ...prev,
          { role: 'user', content: text.trim() },
          { role: 'assistant', content: replyText },
        ];
        return updated.slice(-MAX_HISTORY);
      });

    } catch (err) {
      console.error('AI chat error:', err);
      const errorMsg = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        text: "I'm having trouble connecting right now. Please check your network and try again.",
        time: formatTime(new Date()),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      scrollToEnd();
    }
  }, [llmHistory, scrollToEnd]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    sendMessage(text);
  };

  const handleClearChat = () => {
    setMessages(starterMessages);
    setLlmHistory([]);
    AsyncStorage.removeItem(CHAT_STORAGE_KEY).catch(() => {});
    AsyncStorage.removeItem(HISTORY_STORAGE_KEY).catch(() => {});
  };

  const stopRecordingAndUpload = useCallback(async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!rec) return;

    try {
      setIsTranscribing(true);
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) {
        Alert.alert('Recording', 'Could not read the recording file.');
        return;
      }

      const token = await AsyncStorage.getItem('token');
      // Native multipart upload — fetch()+FormData often throws "Network request failed" on Android.
      const result = await FileSystem.uploadAsync(`${API_BASE}/ai/transcribe`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName:  'audio',
        mimeType:   Platform.OS === 'android' ? 'audio/mp4' : 'audio/m4a',
        headers:    token ? { Authorization: `Bearer ${token}` } : {},
      });

      let data = {};
      try {
        data = result.body ? JSON.parse(result.body) : {};
      } catch (_) {
        data = {};
      }
      if (result.status < 200 || result.status >= 300) {
        throw new Error(data.message || `Transcription failed (${result.status})`);
      }
      const text = (data.text || '').trim();
      if (text) {
        setInput((prev) => {
          const next = prev.trim() ? `${prev.trim()} ${text}` : text;
          return next;
        });
      }
    } catch (err) {
      console.error('Transcribe error:', err);
      Alert.alert('Transcription', err?.message || 'Could not transcribe audio. Try again.');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const toggleMic = useCallback(async () => {
    if (isTranscribing) return;
    if (isRecording) {
      await stopRecordingAndUpload();
      return;
    }
    if (isLoading) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone', 'Allow microphone access to use voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS:     true,
        playsInSilentModeIOS:   true,
        staysActiveInBackground: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.error('Recording start error:', err);
      Alert.alert('Recording', err?.message || 'Could not start recording.');
    }
  }, [isRecording, isTranscribing, isLoading, stopRecordingAndUpload]);

  const micDisabled = isTranscribing || (!isRecording && isLoading);

  return (
    <View style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="robot-outline" size={16} color={GOLD} />
          </View>
          <Text style={styles.brandTitle}>Aether AI</Text>
          <View style={styles.onlineDot} />
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          activeOpacity={0.75}
          onPress={handleClearChat}
          hitSlop={{
            top: 10,
            bottom: 10,
            left: 10,
            right: 10
          }}>
          <Feather name="trash-2" size={18} color={GOLD} />
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        style={[styles.kav, { marginBottom: isKeyboardVisible ? 0 : NAV_H }]}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'android' ? 64 : 88}>
        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollToEnd()}
        >
        <View style={styles.dayPill}>
          <Text style={styles.dayPillText}>Today</Text>
        </View>

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <View key={msg.id} style={[styles.messageWrap, isUser ? styles.userWrap : styles.assistantWrap]}>
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble,
                msg.isError && styles.errorBubble]}>
                <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : styles.assistantBubbleText]}>
                  {msg.text}
                </Text>
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
                {/* Show tool call badges */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <View style={styles.toolRow}>
                    {msg.toolCalls.map((tc, i) => (
                      <View key={i} style={styles.toolBadge}>
                        <Feather name="zap" size={10} color={GOLD} />
                        <Text style={styles.toolBadgeText}>{tc.tool}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <Text style={[styles.timeLabel, isUser ? styles.timeLabelUser : null]}>{msg.time}</Text>
            </View>
          );
        })}

        {/* Typing indicator */}
        {isLoading && (
          <View style={[styles.messageWrap, styles.assistantWrap]}>
            <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
              <View style={styles.typingRow}>
                {[dot1, dot2, dot3].map((dot, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.typingDot,
                      { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.composerDock,
          { bottom: keyboardVisible ? keyboardHeight : NAV_H },
        ]}
      >
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
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.micBtn, isRecording && styles.micBtnRecording]}
              onPress={toggleMic}
              disabled={micDisabled}
              activeOpacity={0.75}
            >
              {isTranscribing ? (
                <ActivityIndicator size="small" color={GOLD} />
              ) : (
                <Feather name={isRecording ? 'square' : 'mic'} size={18} color={GOLD} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      {!isKeyboardVisible && (
        <View style={styles.nav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/dashboard')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="home" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>HOME</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/schedule')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="calendar" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>SCHEDULE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="robot-outline" size={20} color={GOLD} />
            <Text style={[styles.navLabel, styles.navLabelActive]}>AI ASSISTANT</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => router.push('/alerts')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="bell" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>ALERTS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navItem}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="user" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>PROFILE</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function formatTime(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
}

const NAV_H = Platform.OS === 'ios' ? 84 : 66;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG , paddingTop: Platform.OS === 'android' ? 64 : 88 },
  kav: { flex: 1, marginBottom: NAV_H },
  header: {
    paddingTop: 10,
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
  threadContent: { paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 20 },
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
  errorBubble: { borderWidth: 1, borderColor: 'rgba(239,83,80,0.4)' },
  bubbleText: { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 22 },
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

  // Tool call badges
  toolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,208,96,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,208,96,0.2)',
  },
  toolBadgeText: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: GOLD,
    textTransform: 'lowercase',
  },

  // Typing indicator
  typingBubble: { paddingVertical: 16, paddingHorizontal: 20 },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TEXT_MUTED,
  },

  composerDock: {
    backgroundColor: '#15120d',
    borderTopWidth: 1,
    borderTopColor: '#201c15',
  },
  composerRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#15120d',
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
  micBtnRecording: {
    opacity: 0.95,
    borderRadius: 8,
    backgroundColor: 'rgba(239,83,80,0.2)',
  },
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
