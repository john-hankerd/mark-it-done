// MarkItDone v2.0 — Phase 2: Coach Screen with Teams
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Team,
  TeamMember,
  createTeam,
  getTeamMembers,
  getUserProfile,
  getUserTeamId,
  joinTeam,
  onTeamTasksChange,
  removeTeamTask,
  saveTeamTask,
  saveUserTeamId
} from '../../services/teamService';
import { formatDueDate } from '../../types/helpers';
import { DAY_LABELS, Task, TaskType } from '../../types/task';

const ORANGE = '#FF6B35';
const TASKS_KEY = '@markitdone_tasks';

const ICONS = [
  '💪','📞','🏃','📚','💧','✍️','🥗','🧘','😴','🎯',
  '🚫','⭐','🔥','💡','🏆','✅','🎵','🧠','❤️','🙏',
];

export default function CoachScreen() {
  const auth = getAuth();
  const userId = auth.currentUser?.uid || '';

  const [isCoach, setIsCoach] = useState(false);
  const [userName, setUserName] = useState('');
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Create team modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');

  // Join team modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');

  // Add task modal (coach only)
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<TaskType>('daily');
  const [newIcon, setNewIcon] = useState('💪');
  const [newScheduledDays, setNewScheduledDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newDueDate, setNewDueDate] = useState('');
  const [newPointValue, setNewPointValue] = useState(5);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!team) return;
    // Listen for real-time task updates
    const unsub = onTeamTasksChange(team.id, (tasks) => {
      setTeamTasks(tasks);
      // Sync team tasks to local storage for the Today screen
      syncTeamTasksLocally(tasks);
    });
    loadMembers(team.id);
    return unsub;
  }, [team]);

  const loadProfile = async () => {
    try {
      if (!userId) return;
      const profile = await getUserProfile(userId);
      if (profile) {
        setUserName(profile.name || '');
        setIsCoach(profile.isCoach || false);
      }

      const teamId = await getUserTeamId(userId);
      if (teamId) {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../../firebaseConfig');
        const teamSnap = await getDoc(doc(db, 'teams', teamId));
        if (teamSnap.exists()) {
          setTeam({ id: teamSnap.id, ...teamSnap.data() } as Team);
        }
      }
    } catch (e) {
      console.log('Profile load error:', e);
    }
    setLoading(false);
  };

  const loadMembers = async (teamId: string) => {
    try {
      const m = await getTeamMembers(teamId);
      setMembers(m.filter(m => m.userId !== team?.coachId));
    } catch (e) {
      console.log('Members load error:', e);
    }
  };

  const syncTeamTasksLocally = async (tasks: Task[]) => {
    try {
      const savedRaw = await AsyncStorage.getItem(TASKS_KEY);
      const localTasks: Task[] = savedRaw ? JSON.parse(savedRaw) : [];

      // Remove old team tasks, keep self-assigned
      const selfTasks = localTasks.filter(t => t.assignedBy === 'self');

      // Add current team tasks with coach assignment
      const coachTasks = tasks.map(t => ({
        ...t,
        assignedBy: 'coach' as const,
      }));

      const merged = [...selfTasks, ...coachTasks];
      await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(merged));
    } catch (e) {
      console.log('Sync error:', e);
    }
  };

  // ─── Create team (coach) ───
  const handleCreateTeam = async () => {
    if (!teamNameInput.trim()) return;
    setLoading(true);
    try {
      const newTeam = await createTeam(userId, userName, teamNameInput.trim());
      await saveUserTeamId(userId, newTeam.id);
      setTeam(newTeam);
      setShowCreateModal(false);
      setTeamNameInput('');
      Alert.alert('Team Created!', `Share code: ${newTeam.joinCode}`);
    } catch (e) {
      Alert.alert('Error', 'Could not create team. Check your connection.');
    }
    setLoading(false);
  };

  // ─── Join team (member) ───
  const handleJoinTeam = async () => {
    if (joinCodeInput.trim().length < 6) {
      Alert.alert('Invalid code', 'Enter a 6-character team code.');
      return;
    }
    setLoading(true);
    try {
      const joined = await joinTeam(joinCodeInput.trim().toUpperCase(), userId, userName);
      if (!joined) {
        Alert.alert('Not found', 'That code doesn\'t match any team.');
        setLoading(false);
        return;
      }
      await saveUserTeamId(userId, joined.id);
      setTeam(joined);
      setShowJoinModal(false);
      setJoinCodeInput('');
      Alert.alert('Joined!', `You're now on ${joined.name}`);
    } catch (e) {
      Alert.alert('Error', 'Could not join team. Check your connection.');
    }
    setLoading(false);
  };

  // ─── Share code ───
  const shareCode = async () => {
    if (!team) return;
    try {
      await Share.share({
        message: `Join my MarkItDone team "${team.name}"! Enter code: ${team.joinCode}`,
      });
    } catch (e) {}
  };

  // ─── Add team task (coach) ───
  const handleAddTeamTask = async () => {
    if (!newTitle.trim() || !team) return;

    if (newType === 'deadline' && !newDueDate) {
      Alert.alert('Missing due date', 'Pick a due date for deadline tasks.');
      return;
    }
    if (newType === 'scheduled' && newScheduledDays.length === 0) {
      Alert.alert('No days', 'Pick at least one day.');
      return;
    }

    const task: Task = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      title: newTitle.trim(),
      icon: newIcon,
      type: newType,
      pointValue: newType === 'deadline' ? newPointValue : 1,
      assignedBy: 'coach',
      teamDefault: true,
      teamId: team.id,
      createdAt: new Date().toISOString(),
      ...(newType === 'scheduled' && { scheduledDays: newScheduledDays }),
      ...(newType === 'deadline' && { dueDate: newDueDate }),
    };

    try {
      await saveTeamTask(team.id, task);
      resetAddModal();
      Alert.alert('Task Added', `"${task.title}" pushed to all team members.`);
    } catch (e) {
      Alert.alert('Error', 'Could not save task.');
    }
  };

  const handleRemoveTeamTask = (task: Task) => {
    if (!team) return;
    Alert.alert('Remove Task', `Remove "${task.title}" from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await removeTeamTask(team.id, task.id);
          } catch (e) {
            Alert.alert('Error', 'Could not remove task.');
          }
        },
      },
    ]);
  };

  const resetAddModal = () => {
    setNewTitle('');
    setNewType('daily');
    setNewIcon('💪');
    setNewScheduledDays([1, 2, 3, 4, 5]);
    setNewDueDate('');
    setNewPointValue(5);
    setShowAddTaskModal(false);
    setShowDatePicker(false);
  };

  const toggleScheduledDay = (day: number) => {
    setNewScheduledDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  // ─── Date picker ───
  const today = new Date().toISOString().split('T')[0];

  const getCalendarDays = () => {
    const year = datePickerMonth.getFullYear();
    const month = datePickerMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const selectDate = (day: number) => {
    const year = datePickerMonth.getFullYear();
    const month = datePickerMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr < today) {
      Alert.alert('Invalid', 'Due date must be today or later.');
      return;
    }
    setNewDueDate(dateStr);
    setShowDatePicker(false);
  };

  const shiftMonth = (dir: number) => {
    const d = new Date(datePickerMonth);
    d.setMonth(d.getMonth() + dir);
    setDatePickerMonth(d);
  };

  const taskTypeLabel = (t: Task) => {
    switch (t.type) {
      case 'daily': return '🔄 Daily · 1pt';
      case 'scheduled': return `📅 ${t.scheduledDays?.map(d => DAY_LABELS[d]).join(', ')} · 1pt`;
      case 'deadline': return `🎯 Due ${formatDueDate(t.dueDate!)} · ${t.pointValue}pt`;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Team</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#aaa' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  // ─── No team yet ───
  if (!team) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Team</Text>
          <Text style={styles.headerSub}>Create or join a team</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {isCoach && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏆 Create Your Team</Text>
              <Text style={styles.sectionDesc}>
                Set up a team and assign disciplines to your members. They'll see your tasks automatically.
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.actionBtnText}>Create Team</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📥 Join a Team</Text>
            <Text style={styles.sectionDesc}>
              Got a team code from your coach? Enter it to join their team and get their assigned tasks.
            </Text>
            <TouchableOpacity
              style={styles.actionBtnOutline}
              onPress={() => setShowJoinModal(true)}
            >
              <Text style={styles.actionBtnOutlineText}>Enter Team Code</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Create Team Modal */}
        <Modal visible={showCreateModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Create Team</Text>
              <Text style={styles.modalSub}>Give your team a name. You can change it later.</Text>
              <TextInput
                style={styles.input}
                placeholder="Team name (e.g. Sales Team)"
                placeholderTextColor="#aaa"
                value={teamNameInput}
                onChangeText={setTeamNameInput}
                autoFocus
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowCreateModal(false); setTeamNameInput(''); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !teamNameInput.trim() && styles.saveBtnDisabled]}
                  onPress={handleCreateTeam}
                >
                  <Text style={styles.saveBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Join Team Modal */}
        <Modal visible={showJoinModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Join Team</Text>
              <Text style={styles.modalSub}>Enter the 6-character code from your coach.</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="ABC123"
                placeholderTextColor="#aaa"
                value={joinCodeInput}
                onChangeText={t => setJoinCodeInput(t.toUpperCase())}
                autoCapitalize="characters"
                maxLength={6}
                autoFocus
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setShowJoinModal(false); setJoinCodeInput(''); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, joinCodeInput.length < 6 && styles.saveBtnDisabled]}
                  onPress={handleJoinTeam}
                >
                  <Text style={styles.saveBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─── Has a team ───
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{team.name}</Text>
            <Text style={styles.headerSub}>
              {isCoach ? 'You\'re the coach' : `Coach: ${team.coachName}`}
            </Text>
          </View>
          {isCoach && (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddTaskModal(true)}>
              <Text style={styles.addButtonText}>+ Task</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Team code */}
        <TouchableOpacity style={styles.codeChip} onPress={shareCode}>
          <Text style={styles.codeChipText}>Code: {team.joinCode}  ·  Tap to share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            👥 Members ({members.length + 1})
          </Text>
          <View style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {team.coachName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{team.coachName}</Text>
              <Text style={styles.memberRole}>Coach</Text>
            </View>
          </View>
          {members.map(m => (
            <View key={m.id} style={styles.memberRow}>
              <View style={[styles.memberAvatar, styles.memberAvatarMember]}>
                <Text style={styles.memberAvatarText}>
                  {(m.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{m.name}</Text>
                <Text style={styles.memberRole}>Member</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Team Tasks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            📋 Team Tasks ({teamTasks.length})
          </Text>
          {teamTasks.length === 0 ? (
            <Text style={styles.emptyText}>
              {isCoach
                ? 'No tasks yet. Tap "+ Task" to assign disciplines to your team.'
                : 'Your coach hasn\'t assigned any tasks yet.'}
            </Text>
          ) : (
            teamTasks.map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskRow}
                onLongPress={() => isCoach && handleRemoveTeamTask(task)}
                activeOpacity={isCoach ? 0.7 : 1}
              >
                <View style={styles.taskIcon}>
                  <Text style={{ fontSize: 18 }}>{task.icon}</Text>
                </View>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskName}>{task.title}</Text>
                  <Text style={styles.taskMeta}>{taskTypeLabel(task)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          {isCoach && teamTasks.length > 0 && (
            <Text style={styles.hintText}>Hold a task to remove it</Text>
          )}
        </View>

      </ScrollView>

      {/* ── Add Team Task Modal (Coach) ── */}
      <Modal visible={showAddTaskModal} animationType="slide" transparent onRequestClose={resetAddModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              <Text style={styles.modalTitle}>Assign Team Task</Text>
              <Text style={styles.modalSub}>This task will appear for all team members.</Text>

              <TextInput
                style={styles.input}
                placeholder="Task name"
                placeholderTextColor="#aaa"
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />

              {/* Task Type */}
              <Text style={styles.fieldLabel}>Task Type</Text>
              <View style={styles.typeRow}>
                {([
                  { key: 'daily', label: '🔄 Daily', desc: 'Every day' },
                  { key: 'scheduled', label: '📅 Scheduled', desc: 'Specific days' },
                  { key: 'deadline', label: '🎯 Deadline', desc: 'One-time' },
                ] as const).map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.typeBtn, newType === opt.key && styles.typeBtnActive]}
                    onPress={() => setNewType(opt.key)}
                  >
                    <Text style={[styles.typeBtnLabel, newType === opt.key && styles.typeBtnLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.typeBtnDesc}>{opt.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Scheduled days */}
              {newType === 'scheduled' && (
                <>
                  <Text style={styles.fieldLabel}>Which days?</Text>
                  <View style={styles.dayPickerRow}>
                    {DAY_LABELS.map((label, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.dayBtn, newScheduledDays.includes(idx) && styles.dayBtnActive]}
                        onPress={() => toggleScheduledDay(idx)}
                      >
                        <Text style={[styles.dayBtnText, newScheduledDays.includes(idx) && styles.dayBtnTextActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Deadline options */}
              {newType === 'deadline' && (
                <>
                  <Text style={styles.fieldLabel}>Due Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker(!showDatePicker)}
                  >
                    <Text style={[styles.dateButtonText, !newDueDate && { color: '#aaa' }]}>
                      {newDueDate ? formatDueDate(newDueDate) + ` (${newDueDate})` : 'Pick a date...'}
                    </Text>
                  </TouchableOpacity>

                  {showDatePicker && (
                    <View style={styles.calendarBox}>
                      <View style={styles.calNavRow}>
                        <TouchableOpacity onPress={() => shiftMonth(-1)}>
                          <Text style={styles.calNav}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.calMonthLabel}>
                          {datePickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </Text>
                        <TouchableOpacity onPress={() => shiftMonth(1)}>
                          <Text style={styles.calNav}>›</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.calDayHeaders}>
                        {DAY_LABELS.map(l => (
                          <Text key={l} style={styles.calDayHeader}>{l}</Text>
                        ))}
                      </View>
                      <View style={styles.calGrid}>
                        {getCalendarDays().map((day, i) => (
                          <TouchableOpacity
                            key={i}
                            style={[
                              styles.calCell,
                              day && newDueDate === `${datePickerMonth.getFullYear()}-${String(datePickerMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` && styles.calCellSelected,
                            ]}
                            onPress={() => day && selectDate(day)}
                            disabled={!day}
                          >
                            <Text style={[
                              styles.calCellText,
                              day && newDueDate === `${datePickerMonth.getFullYear()}-${String(datePickerMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` && styles.calCellTextSelected,
                            ]}>
                              {day || ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Point Value ({newPointValue} pts)</Text>
                  <View style={styles.pointSlider}>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.pointBtn, newPointValue === v && styles.pointBtnActive]}
                        onPress={() => setNewPointValue(v)}
                      >
                        <Text style={[styles.pointBtnText, newPointValue === v && styles.pointBtnTextActive]}>
                          {v}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Icon */}
              <Text style={styles.fieldLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {ICONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconBtn, newIcon === icon && styles.iconBtnSelected]}
                    onPress={() => setNewIcon(icon)}
                  >
                    <Text style={{ fontSize: 20 }}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetAddModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !newTitle.trim() && styles.saveBtnDisabled]}
                  onPress={handleAddTeamTask}
                >
                  <Text style={styles.saveBtnText}>Assign Task</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  header: {
    backgroundColor: '#1a1a2e',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  addButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  codeChip: {
    backgroundColor: 'rgba(255,107,53,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
  },
  codeChipText: { color: ORANGE, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  scroll: { padding: 16, gap: 16 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 0.5,
    borderColor: '#e8e4df',
    gap: 12,
  },
  sectionTitle: { color: '#1a1a2e', fontSize: 16, fontWeight: '700' },
  sectionDesc: { color: '#aaa', fontSize: 13, lineHeight: 20 },
  emptyText: { color: '#aaa', fontSize: 13 },
  hintText: { color: '#ccc', fontSize: 11, textAlign: 'center', marginTop: 4 },

  // Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarMember: { backgroundColor: '#e0d5cc' },
  memberAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  memberInfo: { flex: 1 },
  memberName: { color: '#1a1a2e', fontSize: 14, fontWeight: '600' },
  memberRole: { color: '#aaa', fontSize: 11 },

  // Tasks
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderColor: '#f0ece8',
  },
  taskIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff0ea',
    alignItems: 'center', justifyContent: 'center',
  },
  taskInfo: { flex: 1 },
  taskName: { color: '#1a1a2e', fontSize: 14, fontWeight: '500' },
  taskMeta: { color: '#aaa', fontSize: 11, marginTop: 2 },

  // Buttons
  actionBtn: {
    backgroundColor: ORANGE,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: ORANGE,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionBtnOutlineText: { color: ORANGE, fontWeight: '700', fontSize: 15 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    maxHeight: '90%',
    borderTopWidth: 0.5,
    borderColor: '#e8e4df',
  },
  modalTitle: { color: '#1a1a2e', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: '#aaa', fontSize: 13, marginBottom: 16 },
  input: {
    backgroundColor: '#f7f5f2',
    borderRadius: 12,
    padding: 14,
    color: '#1a1a2e',
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: '#e8e4df',
  },
  codeInput: { fontSize: 24, fontWeight: '800', textAlign: 'center', letterSpacing: 6 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#f7f5f2', alignItems: 'center',
  },
  cancelBtnText: { color: '#aaa', fontWeight: '600' },
  saveBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: ORANGE, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Task type selector
  fieldLabel: {
    color: '#aaa', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, fontWeight: '600',
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, padding: 10, borderRadius: 12,
    borderWidth: 0.5, borderColor: '#e8e4df',
    alignItems: 'center', backgroundColor: '#f7f5f2',
  },
  typeBtnActive: { backgroundColor: '#fff0ea', borderColor: ORANGE },
  typeBtnLabel: { fontSize: 12, fontWeight: '700', color: '#aaa' },
  typeBtnLabelActive: { color: ORANGE },
  typeBtnDesc: { fontSize: 10, color: '#bbb', marginTop: 2 },

  dayPickerRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  dayBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#f7f5f2', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  dayBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  dayBtnText: { fontSize: 11, fontWeight: '600', color: '#aaa' },
  dayBtnTextActive: { color: '#fff' },

  dateButton: {
    backgroundColor: '#f7f5f2', borderRadius: 12,
    padding: 14, marginBottom: 12,
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  dateButtonText: { fontSize: 15, color: '#1a1a2e' },

  calendarBox: {
    backgroundColor: '#f7f5f2', borderRadius: 12,
    padding: 12, marginBottom: 16,
  },
  calNavRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  calNav: { fontSize: 24, color: ORANGE, fontWeight: '700', paddingHorizontal: 12 },
  calMonthLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  calDayHeaders: { flexDirection: 'row', marginBottom: 4 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: '#aaa' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%', aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  calCellSelected: { backgroundColor: ORANGE, borderRadius: 20 },
  calCellText: { fontSize: 13, color: '#333' },
  calCellTextSelected: { color: '#fff', fontWeight: '700' },

  pointSlider: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  pointBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f7f5f2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  pointBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  pointBtnText: { fontSize: 13, fontWeight: '700', color: '#aaa' },
  pointBtnTextActive: { color: '#fff' },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#f7f5f2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  iconBtnSelected: { borderColor: ORANGE, backgroundColor: '#fff0ea' },
});