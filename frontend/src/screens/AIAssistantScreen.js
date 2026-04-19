import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import Reanimated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FONTS } from '../theme/typography';
import { API_BASE } from '../config/api';
import PressableScale from '../components/dashboard/PressableScale';

const BG              = '#16130c';
const NAV_BG          = '#0c0a07';
const BUBBLE_ASSISTANT= '#2b2419';
const BUBBLE_USER     = '#dfbb56';
const TEXT_PRIMARY    = '#e9e2d5';
const TEXT_MUTED      = '#9e947f';
const TEXT_DARK       = '#201a10';
const GOLD            = '#f5d060';
const BORDER          = 'rgba(77,70,54,0.35)';
const TEXT_SECONDARY  = '#b5aa95';

const CHAT_STORAGE_KEY   = 'aether_chat_messages_v2';
const HISTORY_STORAGE_KEY= 'aether_chat_history_v2';
const MAX_HISTORY        = 12;

// ─── Nav height constant (used for bottom offset) ───────────────────────────
const NAV_H = Platform.OS === 'ios' ? 84 : 66;
// Extra gap above keyboard so input bar doesn't sit flush against it
const KEYBOARD_EXTRA_GAP = 10;
// Height of the composer dock itself (input row)
const COMPOSER_H = Platform.OS === 'ios' ? 62 : 58;

export default function AIAssistantScreen() {
  const router         = useRouter();
  const params         = useLocalSearchParams();
  const insets         = useSafeAreaInsets();
  const initialInput   = typeof params?.q === 'string' ? params.q : '';
  const didInitFromQuery = useRef(false);
  const scrollRef      = useRef(null);
  const recordingRef   = useRef(null);

  const [input, setInput]             = useState(initialInput);
  const [messages, setMessages]       = useState([]);
  const [llmHistory, setLlmHistory]   = useState([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // ── Typing-indicator dots ──────────────────────────────────────────────────
  const dot1 = useRef(new RNAnimated.Value(0)).current;
  const dot2 = useRef(new RNAnimated.Value(0)).current;
  const dot3 = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (!isLoading) return;
    const anim = RNAnimated.loop(
      RNAnimated.stagger(200, [
        RNAnimated.sequence([
          RNAnimated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
          RNAnimated.timing(dot1, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
          RNAnimated.timing(dot2, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
          RNAnimated.timing(dot3, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isLoading]);

  // ── Starter message ────────────────────────────────────────────────────────
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

  // ── Hydrate from AsyncStorage ──────────────────────────────────────────────
  useEffect(() => {
    const hydrate = async () => {
      try {
        const [rawMsgs, rawHistory] = await Promise.all([
          AsyncStorage.getItem(CHAT_STORAGE_KEY),
          AsyncStorage.getItem(HISTORY_STORAGE_KEY),
        ]);
        if (rawMsgs) {
          const parsed = JSON.parse(rawMsgs);
          setMessages(Array.isArray(parsed) && parsed.length > 0 ? parsed : starterMessages);
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

  useEffect(() => {
    if (!messages.length) return;
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  useEffect(() => {
    AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(llmHistory)).catch(() => {});
  }, [llmHistory]);

  // ── Deep-link initial query ────────────────────────────────────────────────
  useEffect(() => {
    const fromQuery = initialInput.trim();
    if (!fromQuery || !messages.length || didInitFromQuery.current) return;
    didInitFromQuery.current = true;
    sendMessage(fromQuery);
    setInput('');
  }, [initialInput, messages.length]);

  // ── Keyboard listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event?.endCoordinates?.height ?? 0);
    };
    const onHide = () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Cleanup recording on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    };
  }, []);

  // ── Input focus animation ──────────────────────────────────────────────────
  const inputFocus = useSharedValue(0);
  useEffect(() => {
    inputFocus.value = withTiming(isInputFocused ? 1 : 0, { duration: 180 });
  }, [isInputFocused, inputFocus]);

  const inputWrapAnimatedStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: 1 + inputFocus.value * 0.01 }],
    shadowOpacity: 0.08 + inputFocus.value * 0.12,
    shadowRadius:  2    + inputFocus.value * 6,
    elevation:     1    + inputFocus.value * 2,
  }));

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
  }, []);

  // ── Send ───────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() && attachments.length === 0) return;
    const now    = new Date();
    const currentAttachments = [...attachments];
    const userMsg = {
      id:   `u-${now.getTime()}`,
      role: 'user',
      text: (text || '').trim(),
      time: formatTime(now),
      attachments: currentAttachments,
    };
    setMessages((prev) => [...prev, userMsg]);
    setAttachments([]);
    setInput('');
    setIsLoading(true);
    scrollToEnd();

    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${API_BASE}/ai/chat`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: (text || '').trim(),
          history: llmHistory.slice(-MAX_HISTORY),
          attachments: currentAttachments,
        }),
      });

      const data      = await res.json();
      const replyText = data.reply || "Sorry, I couldn't process that. Please try again.";
      const botMsg    = {
        id:        `a-${Date.now()}`,
        role:      'assistant',
        text:      replyText,
        time:      formatTime(new Date()),
        toolCalls: data.tool_calls || [],
      };

      setMessages((prev) => [...prev, botMsg]);
      setLlmHistory((prev) => {
        const updated = [
          ...prev,
          { role: 'user',      content: (text || '').trim() },
          { role: 'assistant', content: replyText   },
        ];
        return updated.slice(-MAX_HISTORY);
      });
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id:      `e-${Date.now()}`,
          role:    'assistant',
          text:    "I'm having trouble connecting right now. Please check your network and try again.",
          time:    formatTime(new Date()),
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToEnd();
    }
  }, [llmHistory, scrollToEnd]);

  const handleSend = () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isLoading) return;
    sendMessage(text);
  };

  // ── Document Upload ────────────────────────────────────────────────────────
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      
      const file = result.assets[0];
      
      setIsUploadingDoc(true);
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('document', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });
      
      const res = await fetch(`${API_BASE}/ai/upload-doc`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      
      setAttachments((prev) => [...prev, data]);
    } catch (err) {
      console.error('Doc upload error:', err);
      Alert.alert('Upload Error', err.message || 'Failed to upload document.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleClearChat = () => {
    setMessages(starterMessages);
    setLlmHistory([]);
    AsyncStorage.removeItem(CHAT_STORAGE_KEY).catch(() => {});
    AsyncStorage.removeItem(HISTORY_STORAGE_KEY).catch(() => {});
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const stopRecordingAndUpload = useCallback(async () => {
    const rec          = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!rec) return;

    try {
      setIsTranscribing(true);
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) { Alert.alert('Recording', 'Could not read the recording file.'); return; }

      const token  = await AsyncStorage.getItem('token');
      const result = await FileSystem.uploadAsync(`${API_BASE}/ai/transcribe`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName:  'audio',
        mimeType:   Platform.OS === 'android' ? 'audio/mp4' : 'audio/m4a',
        headers:    token ? { Authorization: `Bearer ${token}` } : {},
      });

      let data = {};
      try { data = result.body ? JSON.parse(result.body) : {}; } catch (_) {}
      if (result.status < 200 || result.status >= 300) {
        throw new Error(data.message || `Transcription failed (${result.status})`);
      }
      const text = (data.text || '').trim();
      if (text) {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
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
    if (isRecording) { await stopRecordingAndUpload(); return; }
    if (isLoading) return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone', 'Allow microphone access to use voice input.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:      true,
        playsInSilentModeIOS:    true,
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

  // ── Derived layout values ──────────────────────────────────────────────────
  //
  // When keyboard is visible:
  //   • composer sits at  keyboardHeight + KEYBOARD_EXTRA_GAP  above the screen bottom
  //   • KAV bottom margin = 0  (no nav shown)
  //
  // When keyboard is hidden:
  //   • composer sits at  NAV_H  (above the nav bar)
  //   • KAV bottom margin = NAV_H
  //
  // The KAV keyboardVerticalOffset compensates for the fixed header so that
  // 'padding' mode on iOS lifts the content by exactly the right amount.

  const HEADER_H = Platform.OS === 'ios' ? 56 : 52; // visual header height (no safe-area)
  // iOS KAV offset = header + top safe-area inset (already consumed by SafeAreaView edges=['top'])
  // We pass edges={['top']} so the SafeAreaView pads the top; the KAV sits below that.
  const kavOffset = Platform.OS === 'ios' ? HEADER_H : 0;

  // Bottom of the scroll thread must clear the composer dock.
  // When keyboard is hidden the doc sits above the nav bar.
  const threadPaddingBottom = COMPOSER_H + 8;

  // Composer absolute bottom position:
  //   keyboard visible → float above keyboard
  //   keyboard hidden  → sit above nav bar
  const composerBottom = keyboardVisible
    ? keyboardHeight + KEYBOARD_EXTRA_GAP
    : NAV_H;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // edges={['top']} — let the component handle its own bottom spacing.
    // This prevents the built-in SafeAreaView from adding bottom padding that
    // fights with our manual composer positioning.
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.avatarWrap}>
            <MaterialCommunityIcons name="robot-outline" size={16} color={GOLD} />
          </View>
          <Text style={styles.brandTitle}>Aether AI</Text>
          <View style={styles.onlineDot} />
        </View>
        <PressableScale
          style={styles.bellBtn}
          onPress={handleClearChat}
          scaleTo={0.95}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="trash-2" size={18} color={GOLD} />
        </PressableScale>
      </View>

      {/* ── Chat area + composer ── */}
      {/*
        KeyboardAvoidingView strategy:
          iOS   → 'padding': adds padding to the bottom of the KAV equal to the
                  keyboard height, pushing content up smoothly.
          Android → 'height': shrinks the KAV height. On most Android devices
                  the window is resized by the OS anyway (adjustResize), so
                  'height' or 'padding' both work; 'height' is safer.
      */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={kavOffset}
      >
        {/* Scroll thread */}
        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={[
            styles.threadContent,
            { paddingBottom: threadPaddingBottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={scrollToEnd}
        >
          <View style={styles.dayPill}>
            <Text style={styles.dayPillText}>Today</Text>
          </View>

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <Reanimated.View
                key={msg.id}
                entering={FadeInDown.duration(220)}
                style={[
                  styles.messageWrap,
                  isUser ? styles.userWrap : styles.assistantWrap,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                    msg.isError && styles.errorBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      isUser ? styles.userBubbleText : styles.assistantBubbleText,
                    ]}
                  >
                    {msg.text}
                  </Text>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <View style={styles.msgAttachments}>
                      {msg.attachments.map((att, i) => (
                        <View key={i} style={styles.msgAttachmentBadge}>
                          <Feather name="file-text" size={12} color={TEXT_DARK} />
                          <Text style={styles.msgAttachmentText} numberOfLines={1}>{att.fileName}</Text>
                        </View>
                      ))}
                    </View>
                  )}
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
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <View style={styles.toolRow}>
                      {msg.toolCalls.map((tc, i) => (
                        <PressableScale key={i} style={styles.toolBadge} scaleTo={0.97}>
                          <Feather name="zap" size={10} color={GOLD} />
                          <Text style={styles.toolBadgeText}>{tc.tool}</Text>
                        </PressableScale>
                      ))}
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.timeLabel,
                    isUser ? styles.timeLabelUser : null,
                  ]}
                >
                  {msg.time}
                </Text>
              </Reanimated.View>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <View style={[styles.messageWrap, styles.assistantWrap]}>
              <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
                <View style={styles.typingRow}>
                  {[dot1, dot2, dot3].map((dot, i) => (
                    <RNAnimated.View
                      key={i}
                      style={[
                        styles.typingDot,
                        {
                          transform: [
                            {
                              translateY: dot.interpolate({
                                inputRange:  [0, 1],
                                outputRange: [0, -6],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Composer dock — lives INSIDE KAV so it rides above the keyboard ── */}
        <View style={styles.composerDock}>
          {attachments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentPreviewScroll}>
              {attachments.map((att, i) => (
                <View key={i} style={styles.attachmentPreview}>
                  <Feather name="file" size={14} color={TEXT_PRIMARY} />
                  <Text style={styles.attachmentPreviewText} numberOfLines={1}>{att.fileName}</Text>
                  <PressableScale onPress={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                    <Feather name="x" size={16} color="#d78686" />
                  </PressableScale>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={styles.composerRow}>
            <PressableScale style={styles.plusBtn} scaleTo={0.95} onPress={pickDocument} disabled={isUploadingDoc}>
              {isUploadingDoc ? (
                 <ActivityIndicator size="small" color={TEXT_PRIMARY} />
              ) : (
                 <Feather name="plus-circle" size={21} color={TEXT_PRIMARY} />
              )}
            </PressableScale>

            <Reanimated.View
              style={[
                styles.inputWrap,
                inputWrapAnimatedStyle,
                isInputFocused && styles.inputWrapFocused,
              ]}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask Aether"
                placeholderTextColor={TEXT_MUTED}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                editable={!isLoading}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
              />
              <PressableScale
                style={[styles.micBtn, isRecording && styles.micBtnRecording]}
                onPress={toggleMic}
                disabled={micDisabled}
                scaleTo={0.95}
              >
                {isTranscribing ? (
                  <ActivityIndicator size="small" color={GOLD} />
                ) : (
                  <Feather
                    name={isRecording ? 'square' : 'mic'}
                    size={18}
                    color={GOLD}
                  />
                )}
              </PressableScale>
            </Reanimated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Bottom navigation — only shown when keyboard is hidden ── */}
      {!keyboardVisible && (
        <View style={[styles.nav, { height: NAV_H, paddingBottom: insets.bottom || (Platform.OS === 'ios' ? 18 : 0) }]}>
          <PressableScale
            style={styles.navItem}
            onPress={() => router.push('/dashboard')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="home" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>HOME</Text>
          </PressableScale>
          <PressableScale
            style={styles.navItem}
            onPress={() => router.push('/schedule')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="calendar" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>SCHEDULE</Text>
          </PressableScale>
          <PressableScale
            style={styles.navItem}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="robot-outline" size={20} color={GOLD} />
            <Text style={[styles.navLabel, styles.navLabelActive]}>AI ASSISTANT</Text>
          </PressableScale>
          <PressableScale
            style={styles.navItem}
            onPress={() => router.push('/alerts')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="bell" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>ALERTS</Text>
          </PressableScale>
          <PressableScale
            style={styles.navItem}
            onPress={() => router.push('/profile')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="user" size={20} color={TEXT_MUTED} />
            <Text style={styles.navLabel}>PROFILE</Text>
          </PressableScale>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date) {
  let h      = date.getHours();
  const m    = date.getMinutes();
  const ap   = h >= 12 ? 'PM' : 'AM';
  h          = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Root ──
  safe: {
    flex: 1,
    backgroundColor: BG,
    // ✅ FIX 1: Removed the hard-coded paddingTop that was adding a large blank
    // gap above the header on both platforms. SafeAreaView with edges={['top']}
    // already insets for the status bar / notch; no extra padding is needed.
  },

  // KeyboardAvoidingView fills the remaining space below the header.
  // ✅ FIX 2: No static marginBottom here — the composer is now INSIDE the KAV
  // so it automatically moves with the keyboard. The nav sits outside and is
  // conditionally rendered, so there is no clash.
  kav: {
    flex: 1,
  },

  // ── Header ──
  header: {
    // ✅ FIX 3: Replaced the over-sized fixed heights (108/76px) with a compact,
    // symmetric value. paddingTop:10 gives breathing room without wasting screen.
    height:              Platform.OS === 'ios' ? 56 : 52,
    paddingTop:          Platform.OS === 'ios' ? 6 : 4,
    paddingHorizontal:   16,
    backgroundColor:     '#0f0d09',
    borderBottomWidth:   1,
    borderBottomColor:   '#201c15',
    flexDirection:       'row',
    alignItems:          'center',
    justifyContent:      'space-between',
  },
  brandRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarWrap: {
    width:           28,
    height:          28,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     BORDER,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: '#1d1912',
  },
  brandTitle: { color: GOLD, fontFamily: FONTS.bold, fontSize: 23 },
  onlineDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  bellBtn:    { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },

  // ── Message thread ──
  thread:        { flex: 1 },
  threadContent: {
    paddingHorizontal: 14,
    // ✅ FIX 4: paddingTop reduced from 16 → 10 so messages start closer to
    // the header for a tighter, more immersive feel.
    paddingTop:        10,
    // paddingBottom is set dynamically above the composer height so the last
    // message is never hidden behind the input bar.
  },

  dayPill: {
    alignSelf:        'center',
    backgroundColor:  '#2a251d',
    borderRadius:     10,
    paddingHorizontal: 12,
    paddingVertical:  3,
    marginBottom:     10,
  },
  dayPillText: { color: TEXT_MUTED, fontFamily: FONTS.medium, fontSize: 11 },

  messageWrap:   { marginBottom: 12, maxWidth: '80%' },
  assistantWrap: { alignSelf: 'flex-start' },
  userWrap:      { alignSelf: 'flex-end' },

  bubble:          { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 },
  assistantBubble: {
    backgroundColor: BUBBLE_ASSISTANT,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.14,
    shadowRadius:    4,
    elevation:       1,
  },
  userBubble:  { backgroundColor: BUBBLE_USER },
  errorBubble: { borderWidth: 1, borderColor: 'rgba(239,83,80,0.4)' },

  bubbleText:          { fontFamily: FONTS.medium, fontSize: 15, lineHeight: 24 },
  assistantBubbleText: { color: TEXT_PRIMARY },
  userBubbleText:      { color: TEXT_DARK },

  timeLabel:     { marginTop: 4, marginLeft: 6, fontFamily: FONTS.medium, fontSize: 10, color: '#8f8570' },
  timeLabelUser: { textAlign: 'right', marginRight: 4, marginLeft: 0 },

  // ── Inline card ──
  inlineCard: {
    marginTop:       12,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     BORDER,
    backgroundColor: '#201b13',
    padding:         10,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
  },
  inlineCardIcon: {
    width:           34,
    height:          34,
    borderRadius:    8,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: 'rgba(245,208,96,0.14)',
  },
  inlineCardTitle:    { color: TEXT_PRIMARY,   fontFamily: FONTS.bold,   fontSize: 11, letterSpacing: 0.8 },
  inlineCardSubtitle: { color: TEXT_SECONDARY, fontFamily: FONTS.medium, fontSize: 12, marginTop: 2 },

  // ── Tool call badges ──
  toolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  toolBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             5,
    backgroundColor: 'rgba(245,208,96,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius:    999,
    borderWidth:     1,
    borderColor:     'rgba(245,208,96,0.24)',
    marginRight:     4,
  },
  toolBadgeText: {
    fontFamily:     FONTS.semibold,
    fontSize:       11,
    color:          GOLD,
    textTransform:  'lowercase',
  },

  // ── Typing indicator ──
  typingBubble: { paddingVertical: 16, paddingHorizontal: 20 },
  typingRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typingDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: TEXT_MUTED,
  },

  // ── Attachments ──
  msgAttachments: { marginTop: 8, gap: 6 },
  msgAttachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(32, 26, 16, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  msgAttachmentText: { color: TEXT_DARK, fontFamily: FONTS.medium, fontSize: 11, maxWidth: 180 },
  attachmentPreviewScroll: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
    maxHeight: 50,
  },
  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#221f18',
    borderWidth: 1,
    borderColor: '#3b3428',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    gap: 8,
  },
  attachmentPreviewText: { color: TEXT_PRIMARY, fontFamily: FONTS.medium, fontSize: 12, maxWidth: 140 },

  // ── Composer dock ──
  // ✅ FIX 5: Composer is now a regular in-flow child of the KAV (not absolutely
  // positioned). This is the key change that makes the keyboard push it up
  // correctly on both platforms without any manual bottom-offset arithmetic.
  composerDock: {
    backgroundColor: '#15120d',
    borderTopWidth:  1,
    borderTopColor:  '#201c15',
  },
  composerRow: {
    paddingHorizontal: 12,
    // ✅ FIX 6: Symmetric vertical padding — same top and bottom — keeps the
    // input bar vertically centred and prevents it feeling bottom-heavy.
    paddingTop:        10,
    paddingBottom:     10,
    backgroundColor:   '#15120d',
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
  },

  plusBtn: {
    width:         34,
    height:        34,
    justifyContent: 'center',
    alignItems:    'center',
    borderRadius:  17,
  },
  inputWrap: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    borderWidth:   1,
    borderColor:   '#3b3428',
    backgroundColor: '#1a1610',
    borderRadius:  20,
    minHeight:     42,
    paddingLeft:   12,
    paddingRight:  4,
    shadowColor:   GOLD,
  },
  inputWrapFocused: { borderColor: 'rgba(245,208,96,0.55)' },
  input: {
    flex:          1,
    color:         TEXT_PRIMARY,
    fontFamily:    FONTS.medium,
    fontSize:      14,
    paddingVertical: 9,
  },
  micBtn: {
    width:         34,
    height:        34,
    justifyContent: 'center',
    alignItems:    'center',
    borderRadius:  17,
  },
  micBtnRecording: {
    opacity:         0.95,
    borderRadius:    8,
    backgroundColor: 'rgba(239,83,80,0.2)',
  },

  // ── Bottom navigation ──
  nav: {
    // ✅ FIX 7: Not absolutely positioned anymore — it's naturally at the bottom
    // of the SafeAreaView stack. When the keyboard is open this whole View is
    // conditionally removed, so there is zero interference.
    backgroundColor: NAV_BG,
    borderTopWidth:  StyleSheet.hairlineWidth,
    borderTopColor:  '#1e1b14',
    flexDirection:   'row',
    justifyContent:  'space-around',
    alignItems:      'center',
  },
  navItem: {
    alignItems:    'center',
    gap:           2,
    minWidth:      48,
    paddingVertical: 6,
  },
  navLabel: {
    fontFamily:    FONTS.medium,
    fontSize:      9,
    color:         TEXT_MUTED,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  navLabelActive: { color: GOLD },
});