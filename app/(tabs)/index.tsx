// MarkItDone v2.0 — Home Screen with Notifications
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../services/alert';
import {
  getNotifSettings,
  scheduleDailyReminder,
  scheduleStreakWarning,
  setupNotifications,
} from '../../services/notificationService';
import {
  calcStreakBonus,
  calcTodayPoints,
  getAllTimePoints,
  getWeeklyPoints,
  saveDayPoints,
} from '../../services/pointsEngine';
import {
  WeeklyGoal,
  clearPersonalGoal,
  getDaysRemainingInWeek,
  getPersonalGoal,
  goalProgress,
  isGoalMet,
  savePersonalGoal,
} from '../../services/weeklyGoals';
import {
  daysUntilDue,
  formatDueDate,
  getDayString,
  getGreeting,
  isTaskActiveToday,
  todayString,
  wasTaskActiveOn,
  yesterdayString,
} from '../../types/helpers';
import { DAY_LABELS, Task, TaskType } from '../../types/task';

const STORAGE_KEY = '@markitdone_tasks';
const COMPLETIONS_KEY = '@markitdone_completions';
const STREAK_KEY = '@markitdone_streaks';
const NAME_KEY = '@markitdone_name';
const ORANGE = '#FF6B35';

const ICONS = [
  '💪','📞','🏃','📚','💧','✍️','🥗','🧘','😴','🎯',
  '🚫','⭐','🔥','💡','🏆','✅','🎵','🧠','❤️','🙏',
];

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [userName, setUserName] = useState('');
  const [weeklyPts, setWeeklyPts] = useState(0);
  const [allTimePts, setAllTimePts] = useState(0);

  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoal | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalType, setGoalType] = useState<'points' | 'completion'>('points');
  const [goalTargetPoints, setGoalTargetPoints] = useState('30');
  const [goalTargetPct, setGoalTargetPct] = useState('80');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<TaskType>('daily');
  const [newIcon, setNewIcon] = useState('💪');
  const [newScheduledDays, setNewScheduledDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newDueDate, setNewDueDate] = useState('');
  const [newPointValue, setNewPointValue] = useState(5);
  const [newAssignedBy, setNewAssignedBy] = useState<'coach' | 'self'>('self');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (loaded) {
      saveData();
      updatePointsLog();
    }
  }, [tasks, completions, streaks, loaded]);

  // Notifications: schedule reminders when tasks/completions change
  useEffect(() => {
    if (!loaded) return;
    const updateNotifications = async () => {
      try {
        await setupNotifications();
        const settings = await getNotifSettings();
        if (!settings.enabled) return;

        const today = todayString();
        const incompleteCount = tasks.filter(t => {
          if (t.type === 'deadline') {
            return t.dueDate && t.dueDate >= today && !completions[`${t.id}-${today}`];
          }
          return isTaskActiveToday(t) && !completions[`${t.id}-${today}`];
        }).length;

        await scheduleDailyReminder(
          settings.reminderHour,
          settings.reminderMinute,
          incompleteCount
        );

        if (settings.streakWarning) {
          const currentBestStreak = Math.max(...Object.values(streaks), 0);
          await scheduleStreakWarning(incompleteCount, currentBestStreak);
        }
      } catch (e) {
        console.log('Notification schedule error:', e);
      }
    };
    updateNotifications();
  }, [tasks, completions, streaks, loaded]);

  const loadData = async () => {
    try {
      const name = await AsyncStorage.getItem(NAME_KEY);
      if (name) setUserName(name);

      const savedTasks = await AsyncStorage.getItem(STORAGE_KEY);
      const savedCompletions = await AsyncStorage.getItem(COMPLETIONS_KEY);
      const savedStreaks = await AsyncStorage.getItem(STREAK_KEY);

      if (savedTasks) setTasks(JSON.parse(savedTasks));
      if (savedCompletions) setCompletions(JSON.parse(savedCompletions));
      if (savedStreaks) setStreaks(JSON.parse(savedStreaks));

      const wp = await getWeeklyPoints();
      const ap = await getAllTimePoints();
      setWeeklyPts(wp);
      setAllTimePts(ap);

      const goal = await getPersonalGoal();
      setWeeklyGoal(goal);
    } catch (e) {
      console.log('Load error:', e);
    }
    setLoaded(true);
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      await AsyncStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
      await AsyncStorage.setItem(STREAK_KEY, JSON.stringify(streaks));
    } catch (e) {
      console.log('Save error:', e);
    }
  };

  const updatePointsLog = async () => {
    const today = todayString();
    const { points, bonuses } = calcTodayPoints(tasks, completions, streaks);
    await saveDayPoints(today, points, bonuses);
    const wp = await getWeeklyPoints();
    const ap = await getAllTimePoints();
    setWeeklyPts(wp);
    setAllTimePts(ap);
  };

  const handleSaveGoal = async () => {
    const goal: WeeklyGoal = {
      type: goalType,
      targetPoints: parseInt(goalTargetPoints) || 30,
      targetPct: parseInt(goalTargetPct) || 80,
    };
    await savePersonalGoal(goal);
    setWeeklyGoal(goal);
    setShowGoalModal(false);
  };

  const handleClearGoal = async () => {
    showAlert('Remove Goal', 'Remove your weekly goal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await clearPersonalGoal();
          setWeeklyGoal(null);
          setShowGoalModal(false);
        },
      },
    ]);
  };

  const today = todayString();
  const yesterday = yesterdayString();

  const isCompletedToday = (taskId: string) => completions[`${taskId}-${today}`] === true;
  const isCompletedYesterday = (taskId: string) => completions[`${taskId}-${yesterday}`] === true;

  const toggleCompletion = (task: Task) => {
    const key = `${task.id}-${today}`;
    const wasDone = completions[key];

    setCompletions(prev => {
      const next = { ...prev };
      if (wasDone) delete next[key];
      else next[key] = true;
      return next;
    });

    if (task.type !== 'deadline') {
      setStreaks(prev => {
        const current = prev[task.id] || 0;
        if (wasDone) {
          return { ...prev, [task.id]: Math.max(0, current - 1) };
        } else {
          const newStreak = current + 1;
          const bonus = calcStreakBonus(newStreak);
          if (bonus > 0) {
            let msg = '';
            if (newStreak % 30 === 0) {
              msg = `🏆 30-day streak on "${task.title}"! +${bonus} bonus pts!`;
            } else if (newStreak % 7 === 0) {
              msg = `🔥 7-day streak on "${task.title}"! +${bonus} bonus pts!`;
            }
            if (msg) setTimeout(() => showAlert('Streak Bonus!', msg), 300);
          }
          return { ...prev, [task.id]: newStreak };
        }
      });
    }
  };

  const catchUpTask = (task: Task) => {
    const key = `${task.id}-${yesterday}`;
    setCompletions(prev => ({ ...prev, [key]: true }));
    if (task.type !== 'deadline') {
      setStreaks(prev => ({ ...prev, [task.id]: 0 }));
    }
    showAlert('Caught up!', `"${task.title}" marked done for yesterday (0 pts, streak reset).`);
  };

  const todayTasks = tasks.filter(t => {
    if (t.type === 'deadline') {
      const completed = isCompletedToday(t.id);
      if (completed) return true;
      return t.dueDate ? t.dueDate >= today : false;
    }
    return isTaskActiveToday(t);
  });

  const catchUpTasks = tasks.filter(t => {
    if (t.type === 'deadline') return false;
    const wasActive = wasTaskActiveOn(t, yesterday);
    const wasCompleted = isCompletedYesterday(t.id);
    return wasActive && !wasCompleted;
  });

  const activeTodayCount = todayTasks.length;
  const completedTodayCount = todayTasks.filter(t => isCompletedToday(t.id)).length;
  const progress = activeTodayCount > 0 ? completedTodayCount / activeTodayCount : 0;
  const todayCompletionPct = Math.round(progress * 100);

  const { points: todayPoints, bonuses: todayBonuses } = calcTodayPoints(tasks, completions, streaks);
  const todayTotal = todayPoints + todayBonuses;
  const bestStreak = Math.max(...Object.values(streaks), 0);

  const daysLeft = getDaysRemainingInWeek();
  const goalProg = weeklyGoal ? goalProgress(weeklyGoal, weeklyPts, todayCompletionPct) : 0;
  const goalMet = weeklyGoal ? isGoalMet(weeklyGoal, weeklyPts, todayCompletionPct) : false;

  const addTask = () => {
    if (!newTitle.trim()) return;
    if (newType === 'deadline' && !newDueDate) {
      showAlert('Missing due date', 'Please pick a due date for deadline tasks.');
      return;
    }
    if (newType === 'scheduled' && newScheduledDays.length === 0) {
      showAlert('No days selected', 'Please pick at least one day for scheduled tasks.');
      return;
    }

    const task: Task = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      title: newTitle.trim(),
      icon: newIcon,
      type: newType,
      pointValue: newType === 'deadline' ? newPointValue : 1,
      assignedBy: newAssignedBy,
      teamDefault: false,
      createdAt: new Date().toISOString(),
      ...(newType === 'scheduled' && { scheduledDays: newScheduledDays }),
      ...(newType === 'deadline' && { dueDate: newDueDate }),
    };

    setTasks(prev => [...prev, task]);
    resetAddModal();
  };

  const resetAddModal = () => {
    setNewTitle('');
    setNewType('daily');
    setNewIcon('💪');
    setNewScheduledDays([1, 2, 3, 4, 5]);
    setNewDueDate('');
    setNewPointValue(5);
    setNewAssignedBy('self');
    setShowAddModal(false);
    setShowDatePicker(false);
  };

  const deleteTask = (task: Task) => {
    showAlert('Remove Task', `Remove "${task.title}" from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => setTasks(prev => prev.filter(t => t.id !== task.id)),
      },
    ]);
  };

  const toggleScheduledDay = (day: number) => {
    setNewScheduledDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

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
      showAlert('Invalid date', 'Due date must be today or later.');
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

  const typeLabel = (t: Task) => {
    switch (t.type) {
      case 'daily': return '🔄 Daily · 1pt';
      case 'scheduled': return `📅 ${t.scheduledDays?.map(d => DAY_LABELS[d]).join(', ')} · 1pt`;
      case 'deadline': return `🎯 Due ${formatDueDate(t.dueDate!)} · ${t.pointValue}pt`;
    }
  };

  const renderTask = (task: Task) => {
    const done = isCompletedToday(task.id);
    const streak = streaks[task.id] || 0;
    const isDeadline = task.type === 'deadline';
    const daysLeftTask = isDeadline ? daysUntilDue(task.dueDate!) : null;
    const isUrgent = isDeadline && daysLeftTask !== null && daysLeftTask <= 1 && !done;

    const nextMilestone = task.type !== 'deadline' && streak > 0
      ? (Math.floor(streak / 7) + 1) * 7
      : null;

    return (
      <TouchableOpacity
        key={task.id}
        style={[styles.card, done && styles.cardDone, isUrgent && styles.cardUrgent]}
        onPress={() => toggleCompletion(task)}
        onLongPress={() => deleteTask(task)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
          <Text style={styles.cardIcon}>{task.icon}</Text>
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardName, done && styles.cardNameDone]}>{task.title}</Text>
          <Text style={styles.cardMeta}>
            {typeLabel(task)}
            {task.assignedBy === 'coach' ? '  ·  🎯 Coach' : '  ·  👤 Personal'}
          </Text>
        </View>
        <View style={styles.cardRight}>
          {done ? (
            <View style={styles.checkCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          ) : (
            <>
              {isDeadline && (
                <View style={[styles.pointsBadge, isUrgent && styles.pointsBadgeUrgent]}>
                  <Text style={[styles.pointsText, isUrgent && styles.pointsTextUrgent]}>
                    {task.pointValue}pt
                  </Text>
                </View>
              )}
              {!isDeadline && streak > 0 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streak}>🔥{streak}</Text>
                  {nextMilestone && (
                    <Text style={styles.streakNext}>{nextMilestone - streak} to bonus</Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#333', marginTop: 100, textAlign: 'center' }}>Loading...</Text>
      </View>
    );
  }

  const coachTasks = todayTasks.filter(t => t.assignedBy === 'coach');
  const selfTasks = todayTasks.filter(t => t.assignedBy === 'self');

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}{userName ? `, ${userName}` : ''}!
            </Text>
            <Text style={styles.dateText}>{getDayString()}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{todayCompletionPct}%</Text>
            <Text style={styles.statLbl}>Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{todayTotal}</Text>
            <Text style={styles.statLbl}>Today pts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{weeklyPts}</Text>
            <Text style={styles.statLbl}>This week</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{bestStreak}</Text>
            <Text style={styles.statLbl}>Best streak</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${todayCompletionPct}%` }]} />
        </View>

        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>🔥 {bestStreak} day streak</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>⭐ {todayTotal} pts{todayBonuses > 0 ? ` (+${todayBonuses})` : ''}</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{completedTodayCount}/{activeTodayCount} done</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list} style={styles.scrollView}>

        {weeklyGoal ? (
          <TouchableOpacity style={[styles.goalCard, goalMet && styles.goalCardMet]} onPress={() => {
            setGoalType(weeklyGoal.type);
            setGoalTargetPoints(String(weeklyGoal.targetPoints));
            setGoalTargetPct(String(weeklyGoal.targetPct));
            setShowGoalModal(true);
          }}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalTitle}>
                {goalMet ? '🎉 Weekly Goal Met!' : '🎯 Weekly Goal'}
              </Text>
              <Text style={styles.goalDaysLeft}>{daysLeft}d left</Text>
            </View>
            <View style={styles.goalProgressTrack}>
              <View style={[
                styles.goalProgressFill,
                { width: `${goalProg}%` },
                goalMet && styles.goalProgressFillMet,
              ]} />
            </View>
            <Text style={styles.goalProgressText}>
              {weeklyGoal.type === 'points'
                ? `${weeklyPts} / ${weeklyGoal.targetPoints} pts (${goalProg}%)`
                : `${todayCompletionPct}% / ${weeklyGoal.targetPct}% completion (${goalProg}%)`
              }
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.setGoalBtn} onPress={() => setShowGoalModal(true)}>
            <Text style={styles.setGoalIcon}>🎯</Text>
            <View>
              <Text style={styles.setGoalTitle}>Set a Weekly Goal</Text>
              <Text style={styles.setGoalDesc}>Target points or completion % each week</Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>Tap to complete · Hold to remove</Text>

        {catchUpTasks.length > 0 && (
          <View style={styles.catchUpBanner}>
            <Text style={styles.catchUpTitle}>⏰ Yesterday's Missed</Text>
            <Text style={styles.catchUpDesc}>Catch up for 0 pts — streak resets</Text>
            {catchUpTasks.map(task => (
              <TouchableOpacity
                key={`catchup-${task.id}`}
                style={styles.catchUpRow}
                onPress={() => catchUpTask(task)}
              >
                <Text style={styles.catchUpIcon}>{task.icon}</Text>
                <Text style={styles.catchUpName}>{task.title}</Text>
                <Text style={styles.catchUpAction}>Catch up</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {coachTasks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>🎯 Coach Assigned</Text>
            {coachTasks.map(renderTask)}
          </>
        )}

        {selfTasks.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>👤 Personal</Text>
            {selfTasks.map(renderTask)}
          </>
        )}

        {todayTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No tasks for today</Text>
            <Text style={styles.emptyDesc}>Tap "+ Add" to create your first discipline</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showGoalModal} animationType="slide" transparent onRequestClose={() => setShowGoalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Weekly Goal</Text>
            <Text style={styles.modalSub}>Set a target to hit each week. Resets every Monday.</Text>

            <Text style={styles.fieldLabel}>Goal Type</Text>
            <View style={styles.goalTypeRow}>
              <TouchableOpacity
                style={[styles.goalTypeBtn, goalType === 'points' && styles.goalTypeBtnActive]}
                onPress={() => setGoalType('points')}
              >
                <Text style={styles.goalTypeIcon}>⭐</Text>
                <Text style={[styles.goalTypeLabel, goalType === 'points' && styles.goalTypeLabelActive]}>Points</Text>
                <Text style={styles.goalTypeDesc}>Earn X pts this week</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.goalTypeBtn, goalType === 'completion' && styles.goalTypeBtnActive]}
                onPress={() => setGoalType('completion')}
              >
                <Text style={styles.goalTypeIcon}>📊</Text>
                <Text style={[styles.goalTypeLabel, goalType === 'completion' && styles.goalTypeLabelActive]}>Completion %</Text>
                <Text style={styles.goalTypeDesc}>Avg X% daily</Text>
              </TouchableOpacity>
            </View>

            {goalType === 'points' ? (
              <>
                <Text style={styles.fieldLabel}>Target Points Per Week</Text>
                <TextInput
                  style={styles.input}
                  value={goalTargetPoints}
                  onChangeText={setGoalTargetPoints}
                  keyboardType="number-pad"
                  placeholder="e.g. 30"
                  placeholderTextColor="#aaa"
                />
                <View style={styles.presetRow}>
                  {[15, 25, 35, 50, 75].map(v => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.presetBtn, goalTargetPoints === String(v) && styles.presetBtnActive]}
                      onPress={() => setGoalTargetPoints(String(v))}
                    >
                      <Text style={[styles.presetText, goalTargetPoints === String(v) && styles.presetTextActive]}>
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Target Completion % (daily avg)</Text>
                <TextInput
                  style={styles.input}
                  value={goalTargetPct}
                  onChangeText={setGoalTargetPct}
                  keyboardType="number-pad"
                  placeholder="e.g. 80"
                  placeholderTextColor="#aaa"
                />
                <View style={styles.presetRow}>
                  {[60, 70, 80, 90, 100].map(v => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.presetBtn, goalTargetPct === String(v) && styles.presetBtnActive]}
                      onPress={() => setGoalTargetPct(String(v))}
                    >
                      <Text style={[styles.presetText, goalTargetPct === String(v) && styles.presetTextActive]}>
                        {v}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.modalBtns}>
              {weeklyGoal && (
                <TouchableOpacity style={styles.clearGoalBtn} onPress={handleClearGoal}>
                  <Text style={styles.clearGoalText}>Remove</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowGoalModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGoal}>
                <Text style={styles.saveBtnText}>Save Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={resetAddModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              <Text style={styles.modalTitle}>New Task</Text>

              <TextInput
                style={styles.input}
                placeholder="What's your discipline?"
                placeholderTextColor="#aaa"
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Task Type</Text>
              <View style={styles.typeRow}>
                {([
                  { key: 'daily', label: '🔄 Daily', desc: 'Every day · 1pt' },
                  { key: 'scheduled', label: '📅 Scheduled', desc: 'Set days · 1pt' },
                  { key: 'deadline', label: '🎯 Deadline', desc: 'One-time · 2-10pt' },
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

              <Text style={styles.fieldLabel}>Assigned by</Text>
              <View style={styles.assignRow}>
                <TouchableOpacity
                  style={[styles.assignBtn, newAssignedBy === 'self' && styles.assignBtnActive]}
                  onPress={() => setNewAssignedBy('self')}
                >
                  <Text style={[styles.assignBtnText, newAssignedBy === 'self' && styles.assignBtnTextActive]}>
                    👤 Personal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.assignBtn, newAssignedBy === 'coach' && styles.assignBtnActive]}
                  onPress={() => setNewAssignedBy('coach')}
                >
                  <Text style={[styles.assignBtnText, newAssignedBy === 'coach' && styles.assignBtnTextActive]}>
                    🎯 Coach
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {ICONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconBtn, newIcon === icon && styles.iconBtnSelected]}
                    onPress={() => setNewIcon(icon)}
                  >
                    <Text style={styles.iconText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <Text style={styles.summaryText}>
                  {newIcon} {newTitle || '(untitled)'}  ·  {newType}
                  {newType === 'scheduled' && newScheduledDays.length > 0 ? ` on ${newScheduledDays.map(d => DAY_LABELS[d]).join(', ')}` : ''}
                  {newType === 'deadline' && newDueDate ? ` due ${formatDueDate(newDueDate)}` : ''}
                  {' '}·  {newType === 'deadline' ? `${newPointValue} pts` : '1 pt'}
                  {newType !== 'deadline' ? '  ·  +3 bonus every 7 days' : ''}
                </Text>
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetAddModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !newTitle.trim() && styles.saveBtnDisabled]}
                  onPress={addTask}
                >
                  <Text style={styles.saveBtnText}>Add Task</Text>
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
  scrollView: { flex: 1 },

  header: {
    backgroundColor: '#1a1a2e',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '800' },
  dateText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  addButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  statLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2 },

  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 3 },

  chipsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: 'rgba(255,107,53,0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: ORANGE, fontSize: 11, fontWeight: '600' },

  list: { padding: 16, gap: 8, paddingBottom: 32 },
  hint: { color: '#bbb', fontSize: 11, textAlign: 'center', marginBottom: 4 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#999',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: 8, marginBottom: 4,
  },

  goalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: ORANGE,
    gap: 8,
  },
  goalCardMet: {
    backgroundColor: '#fff8f5',
    borderColor: '#4CAF50',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  goalDaysLeft: { fontSize: 11, fontWeight: '600', color: '#aaa' },
  goalProgressTrack: {
    height: 8, backgroundColor: '#f0ece8',
    borderRadius: 4, overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%', backgroundColor: ORANGE, borderRadius: 4,
  },
  goalProgressFillMet: { backgroundColor: '#4CAF50' },
  goalProgressText: { fontSize: 12, color: '#666' },

  setGoalBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e8e4df',
    borderStyle: 'dashed',
  },
  setGoalIcon: { fontSize: 28 },
  setGoalTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  setGoalDesc: { fontSize: 12, color: '#aaa', marginTop: 1 },

  goalTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  goalTypeBtn: {
    flex: 1, padding: 14, borderRadius: 14,
    backgroundColor: '#f7f5f2', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  goalTypeBtnActive: { backgroundColor: '#fff0ea', borderColor: ORANGE },
  goalTypeIcon: { fontSize: 24, marginBottom: 4 },
  goalTypeLabel: { fontSize: 13, fontWeight: '700', color: '#aaa' },
  goalTypeLabelActive: { color: ORANGE },
  goalTypeDesc: { fontSize: 10, color: '#bbb', marginTop: 2 },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  presetBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#f7f5f2', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  presetBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  presetText: { fontSize: 13, fontWeight: '700', color: '#aaa' },
  presetTextActive: { color: '#fff' },

  clearGoalBtn: {
    padding: 14, borderRadius: 12,
    backgroundColor: '#fff0f0', alignItems: 'center',
  },
  clearGoalText: { color: '#ff4444', fontWeight: '600', fontSize: 13 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#e8e4df',
  },
  cardDone: { backgroundColor: '#fff8f5', borderColor: ORANGE },
  cardUrgent: { borderColor: '#ff4444', borderWidth: 1 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#fff0ea',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconWrapDone: { backgroundColor: ORANGE },
  cardIcon: { fontSize: 20 },
  cardText: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '500', color: '#2d2d2d' },
  cardNameDone: { color: ORANGE, textDecorationLine: 'line-through' },
  cardMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  checkCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 16, fontWeight: '700' },
  streakBadge: { alignItems: 'flex-end' },
  streak: { color: ORANGE, fontSize: 12, fontWeight: '700' },
  streakNext: { color: '#ccc', fontSize: 9, marginTop: 1 },
  pointsBadge: {
    backgroundColor: '#fff0ea', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pointsBadgeUrgent: { backgroundColor: '#fff0f0' },
  pointsText: { color: ORANGE, fontSize: 11, fontWeight: '700' },
  pointsTextUrgent: { color: '#ff4444' },

  catchUpBanner: {
    backgroundColor: '#fffbe6', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#ffe58f', gap: 8, marginBottom: 4,
  },
  catchUpTitle: { fontSize: 14, fontWeight: '700', color: '#8b7000' },
  catchUpDesc: { fontSize: 12, color: '#b8a000' },
  catchUpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 10, padding: 10,
  },
  catchUpIcon: { fontSize: 18 },
  catchUpName: { flex: 1, fontSize: 13, color: '#333', fontWeight: '500' },
  catchUpAction: { color: ORANGE, fontSize: 12, fontWeight: '700' },

  emptyState: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  emptyDesc: { fontSize: 14, color: '#aaa', textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    maxHeight: '90%', borderTopWidth: 0.5, borderColor: '#e8e4df',
  },
  modalTitle: { color: '#1a1a2e', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: '#aaa', fontSize: 13, marginBottom: 16 },
  input: {
    backgroundColor: '#f7f5f2', borderRadius: 12,
    padding: 14, color: '#1a1a2e', fontSize: 15,
    marginBottom: 12, borderWidth: 0.5, borderColor: '#e8e4df',
  },
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

  assignRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  assignBtn: {
    flex: 1, padding: 10, borderRadius: 12,
    borderWidth: 0.5, borderColor: '#e8e4df',
    alignItems: 'center', backgroundColor: '#f7f5f2',
  },
  assignBtnActive: { backgroundColor: '#fff0ea', borderColor: ORANGE },
  assignBtnText: { fontSize: 12, fontWeight: '600', color: '#aaa' },
  assignBtnTextActive: { color: ORANGE },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#f7f5f2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  iconBtnSelected: { borderColor: ORANGE, backgroundColor: '#fff0ea' },
  iconText: { fontSize: 20 },

  summaryBox: {
    backgroundColor: '#f7f5f2', borderRadius: 12,
    padding: 12, marginBottom: 16,
  },
  summaryTitle: { fontSize: 10, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  summaryText: { fontSize: 13, color: '#333', lineHeight: 18 },

  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#f7f5f2', alignItems: 'center',
  },
  cancelBtnText: { color: '#999', fontWeight: '600' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});