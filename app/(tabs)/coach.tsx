import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const STORAGE_KEY = '@markitdone_disciplines';
const NAME_KEY = '@markitdone_name';

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CoachScreen() {
  const [userName, setUserName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [myCode, setMyCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const name = await AsyncStorage.getItem(NAME_KEY);
      if (name) setUserName(name);
      else setShowNameModal(true);

      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) setDisciplines(JSON.parse(saved));
    } catch (e) {
      console.log('Load error:', e);
    }
  };

  const saveName = async () => {
    if (!nameInput.trim()) return;
    await AsyncStorage.setItem(NAME_KEY, nameInput.trim());
    setUserName(nameInput.trim());
    setShowNameModal(false);
  };

  const createCode = async () => {
    if (disciplines.length === 0) {
      Alert.alert('No disciplines', 'Add some disciplines first before sharing.');
      return;
    }
    setLoading(true);
    try {
      const code = generateCode();
      const shareList = disciplines.map(d => ({
        icon: d.icon,
        name: d.name,
      }));
      await setDoc(doc(db, 'codes', code), {
        createdBy: userName,
        disciplines: shareList,
        createdAt: new Date().toISOString(),
      });
      setMyCode(code);
    } catch (e) {
      Alert.alert('Error', 'Could not create code. Check your internet connection.');
      console.log(e);
    }
    setLoading(false);
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join my MarkItDone discipline list! Enter code: ${myCode} in the Coach tab.`,
      });
    } catch (e) {
      console.log(e);
    }
  };

  const joinWithCode = async () => {
    if (joinCode.trim().length < 6) {
      Alert.alert('Invalid code', 'Please enter a valid 6-character code.');
      return;
    }
    setLoading(true);
    try {
      const docRef = doc(db, 'codes', joinCode.trim().toUpperCase());
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        Alert.alert('Code not found', 'That code does not exist. Check with your coach.');
        setLoading(false);
        return;
      }

      const data = docSnap.data();
      const incoming = data.disciplines.map((d: any) => ({
        id: Date.now() + Math.random(),
        icon: d.icon,
        name: d.name,
        done: false,
        streak: 0,
      }));

      // Merge with existing disciplines, avoid duplicates
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = saved ? JSON.parse(saved) : [];
      const existingNames = existing.map((d: any) => d.name);
      const newOnes = incoming.filter((d: any) => !existingNames.includes(d.name));

      if (newOnes.length === 0) {
        Alert.alert('Already added', 'You already have all of these disciplines.');
        setLoading(false);
        return;
      }

      const merged = [...existing, ...newOnes];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      setDisciplines(merged);
      setShowJoinModal(false);
      setJoinCode('');
      Alert.alert('✅ Success!', `Added ${newOnes.length} discipline${newOnes.length > 1 ? 's' : ''} from ${data.createdBy}! Check your Today tab.`);
    } catch (e) {
      Alert.alert('Error', 'Could not load that code. Check your internet connection.');
      console.log(e);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Coach Mode</Text>
          <TouchableOpacity onPress={() => setShowNameModal(true)}>
            <View style={styles.nameChip}>
              <Text style={styles.nameChipText}>{userName || 'Set name'}</Text>
            </View>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>Share your disciplines or join a coach</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Share Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📤 Share Your List</Text>
          <Text style={styles.sectionDesc}>
            Create a code and share it with your clients or team. They enter the code to instantly get your discipline list.
          </Text>

          {myCode ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Your share code</Text>
              <Text style={styles.codeText}>{myCode}</Text>
              <TouchableOpacity style={styles.shareBtn} onPress={shareCode}>
                <Text style={styles.shareBtnText}>Share Code 🚀</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createCode}>
                <Text style={styles.newCodeText}>Generate new code</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
              onPress={createCode}
              disabled={loading}
            >
              <Text style={styles.actionBtnText}>
                {loading ? 'Creating...' : 'Create Share Code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Join Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📥 Join a Coach</Text>
          <Text style={styles.sectionDesc}>
            Has your coach or advisor shared a code with you? Enter it below to add their disciplines to your list.
          </Text>
          <TouchableOpacity
            style={styles.actionBtnOutline}
            onPress={() => setShowJoinModal(true)}
          >
            <Text style={styles.actionBtnOutlineText}>Enter a Code</Text>
          </TouchableOpacity>
        </View>

        {/* Current disciplines preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Current Disciplines</Text>
          {disciplines.length === 0 ? (
            <Text style={styles.emptyText}>No disciplines yet — add some on the Today tab!</Text>
          ) : (
            disciplines.map((d, i) => (
              <View key={i} style={styles.discRow}>
                <Text style={styles.discIcon}>{d.icon}</Text>
                <Text style={styles.discName}>{d.name}</Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      {/* Name Modal */}
      <Modal visible={showNameModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>What's your name? 👋</Text>
            <Text style={styles.modalSub}>This shows when you share your discipline list with others.</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus={true}
            />
            <TouchableOpacity
              style={[styles.saveBtn, !nameInput.trim() && styles.saveBtnDisabled]}
              onPress={saveName}
            >
              <Text style={styles.saveBtnText}>Save Name</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Join Code Modal */}
      <Modal visible={showJoinModal} animationType="slide" transparent={true} onRequestClose={() => setShowJoinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Enter Coach Code</Text>
            <Text style={styles.modalSub}>Ask your coach or advisor for their 6-character share code.</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="e.g. ABC123"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={joinCode}
              onChangeText={text => setJoinCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus={true}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowJoinModal(false); setJoinCode(''); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (loading || joinCode.length < 6) && styles.saveBtnDisabled]}
                onPress={joinWithCode}
                disabled={loading || joinCode.length < 6}
              >
                <Text style={styles.saveBtnText}>{loading ? 'Loading...' : 'Join'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131a' },
  header: {
    backgroundColor: '#1a1a2e',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  nameChip: {
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
  },
  nameChipText: { color: '#00e5ff', fontSize: 13, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  scroll: { padding: 16, gap: 16 },

  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 20 },

  actionBtn: {
    backgroundColor: '#00e5ff',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.4)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnOutlineText: { color: '#00e5ff', fontWeight: '700', fontSize: 15 },

  codeBox: {
    backgroundColor: 'rgba(0,229,255,0.06)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
  },
  codeLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  codeText: { color: '#00e5ff', fontSize: 42, fontWeight: '800', letterSpacing: 6 },
  shareBtn: {
    backgroundColor: '#00e5ff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  shareBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  newCodeText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 },

  discRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discIcon: { fontSize: 20 },
  discName: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#1a1a2e', borderRadius: 24, padding: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 12,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  modalSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    padding: 14, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  codeInput: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 6 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center',
  },
  cancelBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#00e5ff', alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});