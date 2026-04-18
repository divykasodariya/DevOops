import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../src/theme/typography';
import { API_BASE } from '../src/config/api';

const BG = '#16130c';
const CARD = '#221f18';
const CARD_B = 'rgba(77,70,54,0.25)';
const T1 = '#e9e2d5';
const T2 = '#d0c6b0';
const T3 = '#99907d';
const GOLD = '#f5d060';
const GOLD_D = '#e7c355';
const NAV_BG = '#0c0a07';

// ── Initials Avatar ──
const Avatar = ({ name, size = 40 }) => {
  const ini = (name || 'F').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(245,208,96,0.15)', borderWidth: 1.5, borderColor: GOLD_D, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontFamily: FONTS.bold, fontSize: size * 0.38, color: GOLD }}>{ini}</Text>
    </View>
  );
};

export default function PublishNoticeScreen() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [activeTab, setActiveTab] = useState('Edit');
  const [audience, setAudience] = useState('All Students');
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) setUser(JSON.parse(raw));
    });
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const firstName = user ? user.name.split(' ')[0] : 'Professor';

  const handlePublish = async () => {
    if (!title || !body) return alert("Title and body are required.");

    const audienceToTarget = {
      'All Students': 'student',
      'All Faculty': 'faculty',
      'Everyone': 'all',
    };

    try {
      setPublishing(true);
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_BASE}/notifications/announce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          targetAudience: audienceToTarget[audience] || 'student',
        })
      });
      if (res.ok) {
        alert('Notice Published!');
        router.back();
      } else {
        const d = await res.json();
        alert(d.message || 'Failed to publish notice');
      }
    } catch (e) {
      alert('Error publishing notice');
    } finally {
      setPublishing(false);
    }
  };

  const handleDiscard = () => {
    setTitle('');
    setBody('');
  };

  return (
    <KeyboardAvoidingView
      style={st.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
        
        {/* ── HEADER ── */}
        <View style={st.header}>
          <View style={st.headerL}>
            <Avatar name={user?.name} size={40} />
            <Text style={st.greet}>{greeting}, {firstName}</Text>
          </View>
          <TouchableOpacity style={st.bellBtn}>
            <Feather name="bell" size={20} color={GOLD} />
          </TouchableOpacity>
        </View>

        {/* ── TITLE SECTION ── */}
        <View style={st.titleSec}>
          <Text style={st.pageTitle}>Publish Notice</Text>
          <Text style={st.pageSub}>Create and broadcast announcements to students and staff.</Text>
        </View>

        {/* ── EDITOR CARD ── */}
        <View style={[st.card, st.shadowSoft]}>
          
          {/* Top Tabs & Audience */}
          <View style={st.cardHeaderRow}>
            <View style={st.tabsRow}>
              <TouchableOpacity onPress={() => setActiveTab('Edit')} style={st.tabWrap}>
                <Text style={[st.tabT, activeTab === 'Edit' && st.tabTActive]}>Edit</Text>
                {activeTab === 'Edit' && <View style={st.activeLine} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('Preview')} style={st.tabWrap}>
                <Text style={[st.tabT, activeTab === 'Preview' && st.tabTActive]}>Preview</Text>
                {activeTab === 'Preview' && <View style={st.activeLine} />}
              </TouchableOpacity>
            </View>

            <View style={st.audienceWrap}>
              <Text style={st.audLabel}>Target{'\n'}Audience:</Text>
              <TouchableOpacity
                style={st.audBtn}
                onPress={() => setAudienceOpen((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Text style={st.audBtnT}>{audience}</Text>
                <Feather name="chevron-down" size={14} color={T1} />
              </TouchableOpacity>
            </View>
          </View>

          {audienceOpen && (
            <View style={st.audMenu}>
              {['All Students', 'All Faculty', 'Everyone'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={st.audMenuItem}
                  onPress={() => {
                    setAudience(option);
                    setAudienceOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[st.audMenuText, audience === option && st.audMenuTextActive]}>
                    {option}
                  </Text>
                  {audience === option && <Feather name="check" size={14} color={GOLD} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={st.divider} />

          {activeTab === 'Edit' ? (
            <>
              {/* Title Input */}
              <View style={st.inputWrap}>
                <TextInput
                  style={st.titleInput}
                  placeholder="Notice Title..."
                  placeholderTextColor={T3}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              {/* Rich Text Toolbar */}
              <View style={st.toolbar}>
                <View style={st.toolGrp}>
                  <TouchableOpacity style={st.toolBtn}><Text style={[st.toolT, { fontWeight: 'bold' }]}>B</Text></TouchableOpacity>
                  <TouchableOpacity style={st.toolBtn}><Text style={[st.toolT, { fontStyle: 'italic' }]}>I</Text></TouchableOpacity>
                  <TouchableOpacity style={st.toolBtn}><Text style={[st.toolT, { textDecorationLine: 'underline' }]}>U</Text></TouchableOpacity>
                </View>
                <View style={st.toolDiv} />
                <View style={st.toolGrp}>
                  <TouchableOpacity style={st.toolBtn}><Feather name="list" size={16} color={T2} /></TouchableOpacity>
                  <TouchableOpacity style={st.toolBtn}><Feather name="align-left" size={16} color={T2} /></TouchableOpacity>
                </View>
                <View style={st.toolDiv} />
                <TouchableOpacity style={st.attachBtn}>
                  <Feather name="paperclip" size={14} color={T2} style={{ marginRight: 6 }} />
                  <Text style={st.attachT}>Attach</Text>
                </TouchableOpacity>
              </View>

              {/* Body Input */}
              <View style={st.bodyWrap}>
                <TextInput
                  style={st.bodyInput}
                  placeholder="Write your announcement here..."
                  placeholderTextColor={T3}
                  multiline
                  textAlignVertical="top"
                  value={body}
                  onChangeText={setBody}
                />
              </View>
            </>
          ) : (
            <View style={st.previewWrap}>
              <Text style={st.prevTitle}>{title || 'Notice Title'}</Text>
              <Text style={st.prevBody}>{body || 'Notice content will appear here...'}</Text>
            </View>
          )}

          <View style={st.divider} />

          {/* Action Footer */}
          <View style={st.footerActions}>
            <TouchableOpacity style={st.discardBtn} onPress={handleDiscard}>
              <Feather name="trash-2" size={16} color={T3} style={{ marginRight: 6 }} />
              <Text style={st.discardT}>Discard</Text>
            </TouchableOpacity>

            <View style={st.rightActions}>
              <TouchableOpacity style={st.draftBtn}>
                <Text style={st.draftT}>Save{'\n'}Draft</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePublish}
                disabled={publishing}
              >
                <LinearGradient
                  colors={['#f5d060', '#d8b240']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[st.publishBtn, publishing && { opacity: 0.7 }]}
                >
                  <Feather name="send" size={16} color="#16130c" style={{ marginRight: 8 }} />
                  <Text style={st.publishT}>{publishing ? 'Publishing...' : 'Publish\nNow'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── BOTTOM NAV ── */}
      <View style={st.nav}>
        <TouchableOpacity style={st.navItem} onPress={() => router.push('/faculty-dashboard')}><Feather name="home" size={23} color={GOLD} /><Text style={[st.navLbl, { color: GOLD }]}>HOME</Text></TouchableOpacity>
        <TouchableOpacity style={st.navItem}><Feather name="calendar" size={23} color="#78716c" /><Text style={st.navLbl}>SCHEDULE</Text></TouchableOpacity>
        <View style={st.fabWrap}>
          <LinearGradient colors={['#f5d060', '#d8b240']} style={st.fab}>
            <MaterialCommunityIcons name="robot-outline" size={26} color="#16130c" />
          </LinearGradient>
        </View>
        <TouchableOpacity style={st.navItem}><Feather name="bell" size={23} color="#78716c" /><Text style={st.navLbl}>ALERTS</Text></TouchableOpacity>
        <TouchableOpacity style={st.navItem}><Feather name="user" size={23} color="#78716c" /><Text style={st.navLbl}>PROFILE</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const NAV_H = Platform.OS === 'ios' ? 84 : 64;

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 64 : 24 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2d2a22', paddingBottom: 16 },
  headerL: { flexDirection: 'row', alignItems: 'center' },
  greet: { fontFamily: FONTS.semibold, fontSize: 16, color: T1, marginLeft: 12 },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },

  titleSec: { marginBottom: 24 },
  pageTitle: { fontFamily: FONTS.bold, fontSize: 32, color: T1, marginBottom: 8 },
  pageSub: { fontFamily: FONTS.regular, fontSize: 14, color: T2, lineHeight: 20 },

  card: { backgroundColor: '#1A1813', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#2d2a22' },
  shadowSoft: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6 },

  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tabsRow: { flexDirection: 'row', gap: 20 },
  tabWrap: { alignItems: 'center', paddingVertical: 4 },
  tabT: { fontFamily: FONTS.semibold, fontSize: 14, color: T3 },
  tabTActive: { color: T1 },
  activeLine: { width: '100%', height: 2, backgroundColor: GOLD, marginTop: 6, borderRadius: 1 },

  audienceWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  audLabel: { fontFamily: FONTS.medium, fontSize: 10, color: T3, textAlign: 'right' },
  audBtn: { backgroundColor: '#221f18', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#2d2a22' },
  audBtnT: { fontFamily: FONTS.medium, fontSize: 12, color: T1 },
  audMenu: {
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: '#221f18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d2a22',
    overflow: 'hidden',
  },
  audMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#38342c',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  audMenuText: { fontFamily: FONTS.medium, fontSize: 13, color: T2 },
  audMenuTextActive: { color: GOLD },

  divider: { height: 1, backgroundColor: '#2d2a22', marginVertical: 18 },

  inputWrap: { backgroundColor: '#221f18', borderRadius: 12, borderWidth: 1, borderColor: '#2d2a22', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  titleInput: { fontFamily: FONTS.semibold, fontSize: 18, color: T1 },

  toolbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#221f18', borderRadius: 12, borderWidth: 1, borderColor: '#2d2a22', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 14 },
  toolGrp: { flexDirection: 'row', gap: 18 },
  toolBtn: { justifyContent: 'center', alignItems: 'center' },
  toolT: { fontFamily: FONTS.bold, fontSize: 16, color: T2 },
  toolDiv: { width: 1, height: 20, backgroundColor: '#38342c', marginHorizontal: 18 },
  attachBtn: { flexDirection: 'row', alignItems: 'center' },
  attachT: { fontFamily: FONTS.medium, fontSize: 13, color: T2 },

  bodyWrap: { backgroundColor: '#221f18', borderRadius: 12, borderWidth: 1, borderColor: '#2d2a22', paddingHorizontal: 16, paddingVertical: 16, minHeight: 180 },
  bodyInput: { flex: 1, fontFamily: FONTS.regular, fontSize: 15, color: T1, lineHeight: 22 },

  previewWrap: { minHeight: 280, backgroundColor: '#221f18', borderRadius: 12, padding: 20 },
  prevTitle: { fontFamily: FONTS.bold, fontSize: 20, color: T1, marginBottom: 12 },
  prevBody: { fontFamily: FONTS.regular, fontSize: 15, color: T2, lineHeight: 24 },

  footerActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  discardBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  discardT: { fontFamily: FONTS.medium, fontSize: 13, color: T3 },
  
  rightActions: { flexDirection: 'row', gap: 12 },
  draftBtn: { backgroundColor: '#2d2613', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, justifyContent: 'center' },
  draftT: { fontFamily: FONTS.semibold, fontSize: 12, color: GOLD, textAlign: 'center' },
  
  publishBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  publishT: { fontFamily: FONTS.bold, fontSize: 12, color: '#16130c', textAlign: 'center' },

  // nav
  nav: { position: 'absolute', bottom: 0, left: 0, right: 0, height: NAV_H, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: NAV_BG, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1e1b14', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  navItem: { alignItems: 'center', gap: 3 },
  navLbl: { fontFamily: FONTS.medium, fontSize: 9, color: '#78716c', letterSpacing: 0.6, textTransform: 'uppercase' },
  fabWrap: { marginTop: -28 },
  fab: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#16130c' },
});
