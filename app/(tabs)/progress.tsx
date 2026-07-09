import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const STORAGE_KEY = '@markitdone_tasks';
const COMPLETIONS_KEY = '@markitdone_completions';
const ORANGE = '#FF6B35';

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function getLast7Days() {
  const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split('T')[0],
      label: labels[d.getDay()],
      isToday: i === 0,
    });
  }
  return days;
}

function getLast30Days() {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export default function ProgressScreen() {
  const [dailyPcts, setDailyPcts] = useState<Record<string, number>>({});
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalPerfect, setTotalPerfect] = useState(0);
  const [todayPct, setTodayPct] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    const interval = setInterval(loadProgress, 2000);
    loadProgress();
    return () => clearInterval(interval);
  }, []);

  const loadProgress = async () => {
    try {
      const today = todayString();
      const tasksRaw = await AsyncStorage.getItem(STORAGE_KEY);
      const completionsRaw = await AsyncStorage.getItem(COMPLETIONS_KEY);

      if (!tasksRaw) return;

      const tasks = JSON.parse(tasksRaw);
      const completions = completionsRaw ? JSON.parse(completionsRaw) : {};
      const last30 = getLast30Days();

      // Calculate % for each day
      const pcts: Record<string, number> = {};
      let points = 0;

      for (const day of last30) {
        // Count how many tasks were active that day
        const dow = new Date(day + 'T12:00:00').getDay();
        const activeTasks = tasks.filter((t: any) => {
          if (t.type === 'daily') return true;
          if (t.type === 'scheduled') return t.scheduledDays?.includes(dow);
          if (t.type === 'deadline') return t.dueDate === day;
          return false;
        });

        if (activeTasks.length === 0) {
          pcts[day] = -1; // no tasks that day
          continue;
        }

        const completed = activeTasks.filter((t: any) => completions[`${t.id}-${day}`]);
        pcts[day] = Math.round((completed.length / activeTasks.length) * 100);

        // Tally points
        for (const t of completed) {
          points += t.pointValue || 1;
        }
      }

      setDailyPcts(pcts);
      setTotalPoints(points);

      // Today's %
      const tp = pcts[today] ?? 0;
      setTodayPct(tp < 0 ? 0 : tp);

      // Streaks (consecutive 100% days, skipping days with no tasks)
      let streak = 0;
      for (let i = last30.length - 1; i >= 0; i--) {
        const p = pcts[last30[i]];
        if (p === -1) continue; // skip no-task days
        if (p === 100) streak++;
        else break;
      }
      setCurrentStreak(streak);

      let best = 0;
      let temp = 0;
      for (const day of last30) {
        const p = pcts[day];
        if (p === -1) continue;
        if (p === 100) {
          temp++;
          if (temp > best) best = temp;
        } else {
          temp = 0;
        }
      }
      setBestStreak(best);
      setTotalPerfect(last30.filter(d => pcts[d] === 100).length);
    } catch (e) {
      console.log('Progress load error:', e);
    }
  };

  const week = getLast7Days();
  const last30 = getLast30Days();

  const getColor = (pct: number) => {
    if (pct === -1) return '#f0ece8'; // no tasks
    if (pct === 100) return ORANGE;
    if (pct >= 50) return 'rgba(255,107,53,0.3)';
    if (pct > 0) return 'rgba(255,107,53,0.1)';
    return '#eee';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress</Text>
        <Text style={styles.headerSub}>Your consistency over time</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>Today</Text>
          <Text style={styles.todayPct}>{todayPct}%</Text>
          <View style={styles.todayTrack}>
            <View style={[styles.todayFill, { width: `${todayPct}%` }]} />
          </View>
        </View>

        <View style={styles.streakRow}>
          <View style={styles.streakCard}>
            <Text style={styles.streakNum}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>🔥 Current{'\n'}Streak</Text>
          </View>
          <View style={styles.streakCard}>
            <Text style={styles.streakNum}>{bestStreak}</Text>
            <Text style={styles.streakLabel}>🏆 Best{'\n'}Streak</Text>
          </View>
          <View style={styles.streakCard}>
            <Text style={styles.streakNum}>{totalPoints}</Text>
            <Text style={styles.streakLabel}>⭐ Total{'\n'}Points</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>This Week</Text>
        <View style={styles.weekRow}>
          {week.map(day => {
            const pct = dailyPcts[day.date] ?? 0;
            const display = pct < 0 ? 0 : pct;
            return (
              <View key={day.date} style={styles.dayCol}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <View style={[
                  styles.dayDot,
                  { backgroundColor: getColor(pct) },
                  day.isToday && styles.dayDotToday,
                ]}>
                  <Text style={styles.dayDotText}>
                    {pct === 100 ? '✓' : pct > 0 ? `${display}` : '–'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Last 30 Days</Text>
        <View style={styles.gridWrap}>
          {last30.map(day => {
            const pct = dailyPcts[day] ?? 0;
            return (
              <View key={day} style={[styles.gridCell, { backgroundColor: getColor(pct) }]} />
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Recent Days</Text>
        {last30.slice(-7).reverse().map(day => {
          const pct = dailyPcts[day] ?? 0;
          const display = pct < 0 ? 0 : pct;
          const date = new Date(day + 'T12:00:00');
          const label = day === todayString() ? 'Today' :
            date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <View key={day} style={styles.histRow}>
              <Text style={styles.histDate}>{label}</Text>
              <View style={styles.histTrack}>
                <View style={[styles.histFill, { width: `${display}%` }]} />
              </View>
              <Text style={styles.histPct}>{display}%</Text>
            </View>
          );
        })}

      </ScrollView>
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
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  scroll: { padding: 16, gap: 16 },

  todayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: ORANGE,
  },
  todayLabel: { color: '#aaa', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  todayPct: { color: ORANGE, fontSize: 40, fontWeight: '800', marginVertical: 4 },
  todayTrack: { height: 6, backgroundColor: '#f0ece8', borderRadius: 3, overflow: 'hidden' },
  todayFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 3 },

  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: {
    flex: 1, backgroundColor: '#fff',
    borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  streakNum: { color: '#1a1a2e', fontSize: 32, fontWeight: '800' },
  streakLabel: { color: '#aaa', fontSize: 11, textAlign: 'center', marginTop: 4 },

  sectionLabel: {
    color: '#aaa', fontSize: 10,
    textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600',
  },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  dayLabel: { color: '#aaa', fontSize: 10, fontWeight: '600' },
  dayDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dayDotToday: { borderWidth: 2, borderColor: ORANGE },
  dayDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridCell: { width: 28, height: 28, borderRadius: 6 },

  histRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12, padding: 12, gap: 10,
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  histDate: { color: '#aaa', fontSize: 12, width: 80 },
  histTrack: { flex: 1, height: 4, backgroundColor: '#f0ece8', borderRadius: 2, overflow: 'hidden' },
  histFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 2 },
  histPct: { color: ORANGE, fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
});