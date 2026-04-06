import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const INITIAL_DISCIPLINES = [
  { id: 1, icon: '📞', name: 'Make 10 prospect calls', done: false, streak: 3 },
  { id: 2, icon: '🏃', name: '30-min morning workout', done: false, streak: 7 },
  { id: 3, icon: '📚', name: 'Read 20 pages', done: false, streak: 5 },
  { id: 4, icon: '💧', name: 'Drink 8 glasses of water', done: false, streak: 2 },
  { id: 5, icon: '✍️', name: 'Journal your wins', done: false, streak: 7 },
  { id: 6, icon: '🥗', name: 'Eat clean meals', done: false, streak: 4 },
];

const ICONS = ['💪','📞','🏃','📚','💧','✍️','🥗','🧘','😴','🎯','🚫','⭐','🔥','💡','🏆','✅','🎵','🧠','❤️','🙏'];
const STORAGE_KEY = '@markitdone_disciplines';
const LAST_OPEN_KEY = '@markitdone_last_open';

function todayString() {
  return new Date().toISOString().split('T')[0];
}

export default function HomeScreen() {
  const [disciplines, setDisciplines] = useState(INITIAL_DISCIPLINES);
  const [loaded, setLoaded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('💪');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (loaded) saveData(disciplines); }, [disciplines, loaded]);

  const loadData = async () => {
    try {
      const today = todayString();
      const lastOpen = await AsyncStorage.getItem(LAST_OPEN_KEY);
      await AsyncStorage.setItem(LAST_OPEN_KEY, today);
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        let parsed = JSON.parse(saved);
        if (lastOpen !== today) {
          parsed = parsed.map((d: any) => ({
            ...d,
            done: false,
            streak: d.done ? d.streak + 1 : 0,
          }));
        }
        setDisciplines(parsed);
      }
    } catch (e) {
      console.log('Load error:', e);
    }
    setLoaded(true);
  };

  const saveData = async (data: any) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.log('Save error:', e);
    }
  };

  const toggleDiscipline = (id: number) => {
    setDisciplines(prev =>
      prev.map(d => d.id === id ? { ...d, done: !d.done } : d)
    );
  };

  const addDiscipline = () => {
    if (!newName.trim()) return;
    const newDisc = {
      id: Date.now(),
      icon: selectedIcon,
      name: newName.trim(),
      done: false,
      streak: 0,
    };
    setDisciplines(prev => [...prev, newDisc]);
    setNewName('');
    setSelectedIcon('💪');
    setShowAddModal(false);
  };

  const deleteDiscipline = (id: number, name: string) => {
    Alert.alert(
      'Remove Discipline',
      `Remove "${name}" from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
          setDisciplines(prev => prev.filter(d => d.id !== id));
        }},
      ]
    );
  };

  const doneCount = disciplines.filter(d => d.done).length;
  const total = disciplines.length;
  const progress = total > 0 ? doneCount / total : 0;

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff', marginTop: 100, textAlign: 'center' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>MarkItDone</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSub}>{doneCount} of {total} complete</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.hint}>Tap to complete · Hold to remove</Text>
        {disciplines.map(d => (
          <TouchableOpacity
            key={d.id}
            style={[styles.card, d.done && styles.cardDone]}
            onPress={() => toggleDiscipline(d.id)}
            onLongPress={() => deleteDiscipline(d.id, d.name)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardIcon}>{d.icon}</Text>
            <Text style={[styles.cardName, d.done && styles.cardNameDone]}>{d.name}</Text>
            {d.done && <Text style={styles.checkmark}>✓</Text>}
            {!d.done && d.streak > 0 && (
              <Text style={styles.streak}>🔥{d.streak}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" transparent={true} onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Discipline</Text>
            <TextInput
              style={styles.input}
              placeholder="What's your discipline?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newName}
              onChangeText={setNewName}
              autoFocus={true}
            />
            <Text style={styles.iconLabel}>Pick an icon</Text>
            <View style={styles.iconGrid}>
              {ICONS.map(icon => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconBtn, selectedIcon === icon && styles.iconBtnSelected]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Text style={styles.iconText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddModal(false); setNewName(''); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, !newName.trim() && styles.saveBtnDisabled]} onPress={addDiscipline}>
                <Text style={styles.saveBtnText}>Add</Text>
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
    marginBottom: 6,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  addButton: {
    backgroundColor: '#00e5ff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: { color: '#000', fontWeight: '700', fontSize: 13 },
  headerSub: { color: '#00e5ff', fontSize: 14, marginBottom: 14 },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#00e5ff', borderRadius: 3 },
  list: { padding: 16, gap: 10 },
  hint: { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginBottom: 6 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardDone: {
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderColor: 'rgba(0,229,255,0.3)',
  },
  cardIcon: { fontSize: 24, marginRight: 12 },
  cardName: { flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  cardNameDone: { color: '#00e5ff', textDecorationLine: 'line-through' },
  checkmark: { color: '#00e5ff', fontSize: 18, fontWeight: '700' },
  streak: { color: '#ff6b35', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#1a1a2e', borderRadius: 24, padding: 24,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    padding: 14, color: '#fff', fontSize: 15, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  iconLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  iconBtnSelected: { borderColor: '#00e5ff', backgroundColor: 'rgba(0,229,255,0.12)' },
  iconText: { fontSize: 20 },
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