import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@markitdone_disciplines';
const HISTORY_KEY = '@markitdone_history';

function todayString() {
  return new Date().toISOString().split('T')[0];
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

function getLast7Days() {
  const days = [];
  const labels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
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

export default function ProgressScreen() {
  const [history, setHistory] = useState<Record<string, number>>({});
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalCompletions, setTotalCompletions] = useState(0);
  const [todayPct, setTodayPct] = useState(0);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      // Load today's disciplines for today's %
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const disciplines = JSON.parse(saved);
        const done = disciplines.filter((d: any) => d.done).length;
        const total = disciplines.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        setTodayPct(pct);

        // Save today's progress to history
        const histRaw = await AsyncStorage.getItem(HISTORY_KEY);
        const hist = histRaw ? JSON.parse(histRaw) : {};
        hist[todayString()] = pct;
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
        setHistory(hist);

        // Calculate streaks
        const days = getLast30Days();
        let streak = 0;
        let best = 0;
        let temp = 0;

        for (let i = days.length - 1; i >= 0; i--) {
          const pctDay = hist[days[i]] ?? 0;
          if (pctDay === 100) {
            if (i === days.length - 1 || streak > 0) streak++;
          } else {
            if (i === days.length - 1) streak = 0;
            else break;
          }
        }

        for (const day of days) {
          if ((hist[day] ?? 0) === 100) {
            temp++;
            if (temp > best) best = temp;
          } else {
            temp = 0;
          }
        }

        setCurrentStreak(streak);
        setBestStreak(best);

        // Total completions
        const total30 = days.reduce((sum, d) => {
          const p = hist[d] ?? 0;
          return sum + (p === 100 ? 1 : 0);
        }, 0);
        setTotalCompletions(total30);
      }
    } catch (e) {
      console.log('Progress load error:', e);
    }
  };

  const week = getLast7Days();
  const last30 = getLast30Days();

  const getColor = (pct: number) => {
    if (pct === 100) return '#00e5ff';
    if (pct >= 50) return 'rgba(0,229,255,0.3)';
    if (pct > 0) return 'rgba(0,229,255,0.1)';
    return 'rgba(255,255,255,0.06)';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress</Text>
        <Text style={styles.headerSub}>Your consistency over time</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Today */}
        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>Today</Text>
          <Text style={styles.todayPct}>{todayPct}%</Text>
          <View style={styles.todayTrack}>
            <View style={[styles.todayFill, { width: `${todayPct}%` }]} />
          </View>
        </View>

        {/* Streak Hero */}
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
            <Text style={styles.streakNum}>{totalCompletions}</Text>
            <Text style={styles.streakLabel}>✅ Perfect{'\n'}Days</Text>
          </View>
        </View>

        {/* This Week */}
        <Text style={styles.sectionLabel}>This Week</Text>
        <View style={styles.weekRow}>
          {week.map(day => {
            const pct = history[day.date] ?? (day.isToday ? todayPct : 0);
            return (
              <View key={day.date} style={styles.dayCol}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <View style={[
                  styles.dayDot,
                  { backgroundColor: getColor(pct) },
                  day.isToday && styles.dayDotToday,
                ]}>
                  <Text style={styles.dayDotText}>
                    {pct === 100 ? '✓' : pct > 0 ? `${pct}` : '–'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* 30 Day Grid */}
        <Text style={styles.sectionLabel}>Last 30 Days</Text>
        <View style={styles.gridWrap}>
          {last30.map(day => {
            const pct = history[day] ?? (day === todayString() ? todayPct : 0);
            return (
              <View
                key={day}
                style={[styles.gridCell, { backgroundColor: getColor(pct) }]}
              />
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          <Text style={styles.legendText}>0%</Text>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(0,229,255,0.1)' }]} />
          <Text style={styles.legendText}>Partial</Text>
          <View style={[styles.legendDot, { backgroundColor: '#00e5ff' }]} />
          <Text style={styles.legendText}>100%</Text>
        </View>

        {/* Recent History */}
        <Text style={styles.sectionLabel}>Recent Days</Text>
        {last30.slice(-7).reverse().map(day => {
          const pct = history[day] ?? (day === todayString() ? todayPct : 0);
          const date = new Date(day + 'T12:00:00');
          const label = day === todayString() ? 'Today' :
            date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <View key={day} style={styles.histRow}>
              <Text style={styles.histDate}>{label}</Text>
              <View style={styles.histTrack}>
                <View style={[styles.histFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.histPct}>{pct}%</Text>
            </View>
          );
        })}

      </ScrollView>
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
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  scroll: { padding: 16, gap: 16 },

  todayCard: {
    backgroundColor: 'rgba(0,229,255,0.07)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
  },
  todayLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  todayPct: { color: '#00e5ff', fontSize: 40, fontWeight: '800', marginVertical: 4 },
  todayTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  todayFill: { height: '100%', backgroundColor: '#00e5ff', borderRadius: 3 },

  streakRow: { flexDirection: 'row', gap: 10 },
  streakCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  streakNum: { color: '#fff', fontSize: 32, fontWeight: '800' },
  streakLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 4 },

  sectionLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '600',
  },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600' },
  dayDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  dayDotToday: { borderWidth: 2, borderColor: '#00e5ff' },
  dayDotText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridCell: { width: 28, height: 28, borderRadius: 6 },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginRight: 8 },

  histRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, padding: 12, gap: 10,
  },
  histDate: { color: 'rgba(255,255,255,0.5)', fontSize: 12, width: 80 },
  histTrack: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  histFill: { height: '100%', backgroundColor: '#00e5ff', borderRadius: 2 },
  histPct: { color: '#00e5ff', fontSize: 11, fontWeight: '700', width: 32, textAlign: 'right' },
});