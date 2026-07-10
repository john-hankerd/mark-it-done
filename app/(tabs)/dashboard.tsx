// MarkItDone v2.0 — Phase 4: Coach Dashboard
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../../firebaseConfig';
import {
    Team,
    TeamMember,
    getTeamCompletions,
    getTeamMembers,
    getTeamTasks,
    getUserProfile,
    getUserTeamId,
} from '../../services/teamService';
import { formatDueDate, todayString } from '../../types/helpers';
import { DAY_LABELS, Task } from '../../types/task';

const ORANGE = '#FF6B35';

interface MemberScore {
  userId: string;
  name: string;
  totalPoints: number;
  todayCompleted: number;
  todayTotal: number;
  streak: number;
}

interface CompletionEntry {
  memberId: string;
  taskId: string;
  date: string;
  pointsEarned: number;
  completedAt: string;
}

export default function DashboardScreen() {
  const auth = getAuth();
  const userId = auth.currentUser?.uid || '';

  const [isCoach, setIsCoach] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<CompletionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [view, setView] = useState<'leaderboard' | 'completion' | 'member'>('leaderboard');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Date filter
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('today');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      if (!userId) { setLoading(false); return; }

      const profile = await getUserProfile(userId);
      if (!profile) { setLoading(false); return; }

      setIsCoach(profile.isCoach || false);

      const teamId = await getUserTeamId(userId);
      if (!teamId) { setLoading(false); return; }

      const teamSnap = await getDoc(doc(db, 'teams', teamId));
      if (!teamSnap.exists()) { setLoading(false); return; }

      const teamData = { id: teamSnap.id, ...teamSnap.data() } as Team;
      setTeam(teamData);

      const [m, t, c] = await Promise.all([
        getTeamMembers(teamId),
        getTeamTasks(teamId),
        getTeamCompletions(teamId),
      ]);

      setMembers(m);
      setTeamTasks(t);
      setCompletions(c as CompletionEntry[]);
    } catch (e) {
      console.log('Dashboard load error:', e);
    }
    setLoading(false);
  };

  const refresh = () => {
    setLoading(true);
    loadDashboard();
  };

  // ─── Calculate scores ───
  const today = todayString();

  const getWeekStart = () => {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    return monday.toISOString().split('T')[0];
  };

  const filteredCompletions = completions.filter(c => {
    if (dateFilter === 'today') return c.date === today;
    if (dateFilter === 'week') return c.date >= getWeekStart();
    return true;
  });

  const memberScores: MemberScore[] = members
    .filter(m => m.userId !== team?.coachId)
    .map(m => {
      const memberCompletions = filteredCompletions.filter(c => c.memberId === m.userId);
      const totalPoints = memberCompletions.reduce((sum, c) => sum + (c.pointsEarned || 0), 0);

      // Today's completion count
      const todayCompletions = completions.filter(c => c.memberId === m.userId && c.date === today);
      const todayDow = new Date().getDay();
      const todayActiveTasks = teamTasks.filter(t => {
        if (t.type === 'daily') return true;
        if (t.type === 'scheduled') return t.scheduledDays?.includes(todayDow);
        if (t.type === 'deadline') return t.dueDate === today;
        return false;
      });

      // Simple streak calc: consecutive days with at least 1 completion
      let streak = 0;
      for (let i = 0; i < 60; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const hasCompletion = completions.some(c => c.memberId === m.userId && c.date === dateStr);
        if (hasCompletion) streak++;
        else if (i > 0) break; // allow today to be incomplete
      }

      return {
        userId: m.userId,
        name: m.name || 'Unknown',
        totalPoints,
        todayCompleted: todayCompletions.length,
        todayTotal: todayActiveTasks.length,
        streak,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // ─── Completion grid data ───
  const getCompletionGrid = () => {
    const todayDow = new Date().getDay();
    const activeTasks = teamTasks.filter(t => {
      if (dateFilter === 'today') {
        if (t.type === 'daily') return true;
        if (t.type === 'scheduled') return t.scheduledDays?.includes(todayDow);
        if (t.type === 'deadline') return t.dueDate === today;
        return false;
      }
      return true; // show all for week/all
    });

    return activeTasks.map(task => {
      const memberStatuses = members
        .filter(m => m.userId !== team?.coachId)
        .map(m => {
          const completed = filteredCompletions.some(
            c => c.memberId === m.userId && c.taskId === task.id
          );
          return { name: m.name, completed };
        });

      const completedCount = memberStatuses.filter(s => s.completed).length;
      const totalMembers = memberStatuses.length;

      return {
        task,
        memberStatuses,
        completedCount,
        totalMembers,
        pct: totalMembers > 0 ? Math.round((completedCount / totalMembers) * 100) : 0,
      };
    });
  };

  // ─── Member detail data ───
  const getMemberDetail = () => {
    if (!selectedMember) return [];

    return teamTasks.map(task => {
      const memberCompletionsForTask = completions
        .filter(c => c.memberId === selectedMember.userId && c.taskId === task.id)
        .sort((a, b) => b.date.localeCompare(a.date));

      const completedToday = completions.some(
        c => c.memberId === selectedMember.userId && c.taskId === task.id && c.date === today
      );

      const totalPts = memberCompletionsForTask.reduce((sum, c) => sum + (c.pointsEarned || 0), 0);

      return {
        task,
        completedToday,
        recentCompletions: memberCompletionsForTask.slice(0, 7),
        totalPts,
        totalCompletions: memberCompletionsForTask.length,
      };
    });
  };

  // ─── Rank badge ───
  const rankBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#aaa' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>Team dashboard</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🏆</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 8 }}>
            No team yet
          </Text>
          <Text style={{ fontSize: 14, color: '#aaa', textAlign: 'center' }}>
            {isCoach
              ? 'Create a team in the Team tab to see your dashboard.'
              : 'Join a team in the Team tab to see your progress.'}
          </Text>
        </View>
      </View>
    );
  }

  if (!isCoach) {
    // Member view — show own stats only
    const myScore = memberScores.find(m => m.userId === userId);
    const myRank = memberScores.findIndex(m => m.userId === userId) + 1;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Standing</Text>
          <Text style={styles.headerSub}>{team.name}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.myStatsCard}>
            <Text style={styles.myRank}>#{myRank || '–'}</Text>
            <Text style={styles.myRankLabel}>Your Rank</Text>
          </View>

          <View style={styles.myStatsRow}>
            <View style={styles.myStatBox}>
              <Text style={styles.myStatVal}>{myScore?.totalPoints || 0}</Text>
              <Text style={styles.myStatLbl}>Points</Text>
            </View>
            <View style={styles.myStatBox}>
              <Text style={styles.myStatVal}>{myScore?.todayCompleted || 0}/{myScore?.todayTotal || 0}</Text>
              <Text style={styles.myStatLbl}>Today</Text>
            </View>
            <View style={styles.myStatBox}>
              <Text style={styles.myStatVal}>{myScore?.streak || 0}</Text>
              <Text style={styles.myStatLbl}>Streak</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            {memberScores.map((m, i) => (
              <View
                key={m.userId}
                style={[styles.leaderRow, m.userId === userId && styles.leaderRowMe]}
              >
                <Text style={styles.leaderRank}>{rankBadge(i)}</Text>
                <View style={styles.leaderInfo}>
                  <Text style={[styles.leaderName, m.userId === userId && styles.leaderNameMe]}>
                    {m.name} {m.userId === userId ? '(You)' : ''}
                  </Text>
                </View>
                <Text style={styles.leaderPts}>{m.totalPoints} pts</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Coach view ───
  const completionGrid = getCompletionGrid();
  const memberDetail = getMemberDetail();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSub}>{team.name} · {members.length} members</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
            <Text style={styles.refreshBtnText}>↻</Text>
          </TouchableOpacity>
        </View>

        {/* View tabs */}
        <View style={styles.viewTabs}>
          {(['leaderboard', 'completion', 'member'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.viewTab, view === v && styles.viewTabActive]}
              onPress={() => { setView(v); setSelectedMember(null); }}
            >
              <Text style={[styles.viewTabText, view === v && styles.viewTabTextActive]}>
                {v === 'leaderboard' ? '🏆 Rankings' : v === 'completion' ? '📋 Tasks' : '👤 Members'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date filter */}
        <View style={styles.dateFilters}>
          {(['today', 'week', 'all'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.dateFilter, dateFilter === f && styles.dateFilterActive]}
              onPress={() => setDateFilter(f)}
            >
              <Text style={[styles.dateFilterText, dateFilter === f && styles.dateFilterTextActive]}>
                {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Leaderboard View ── */}
        {view === 'leaderboard' && (
          <>
            {memberScores.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>👥</Text>
                <Text style={styles.emptyText}>No members yet. Share your team code!</Text>
              </View>
            ) : (
              <>
                {/* Top 3 podium */}
                {memberScores.length >= 1 && (
                  <View style={styles.podium}>
                    {memberScores.slice(0, 3).map((m, i) => (
                      <View key={m.userId} style={[styles.podiumSpot, i === 0 && styles.podiumFirst]}>
                        <Text style={styles.podiumBadge}>{rankBadge(i)}</Text>
                        <View style={[styles.podiumAvatar, i === 0 && styles.podiumAvatarFirst]}>
                          <Text style={styles.podiumAvatarText}>
                            {m.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.podiumName} numberOfLines={1}>{m.name}</Text>
                        <Text style={styles.podiumPts}>{m.totalPoints} pts</Text>
                        <Text style={styles.podiumStreak}>🔥{m.streak}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Full list */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Full Rankings</Text>
                  {memberScores.map((m, i) => (
                    <TouchableOpacity
                      key={m.userId}
                      style={styles.leaderRow}
                      onPress={() => {
                        const member = members.find(mem => mem.userId === m.userId);
                        if (member) { setSelectedMember(member); setView('member'); }
                      }}
                    >
                      <Text style={styles.leaderRank}>{rankBadge(i)}</Text>
                      <View style={styles.leaderAvatar}>
                        <Text style={styles.leaderAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.leaderInfo}>
                        <Text style={styles.leaderName}>{m.name}</Text>
                        <Text style={styles.leaderMeta}>
                          {m.todayCompleted}/{m.todayTotal} today · 🔥{m.streak}
                        </Text>
                      </View>
                      <Text style={styles.leaderPts}>{m.totalPoints} pts</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* ── Completion View ── */}
        {view === 'completion' && (
          <>
            {completionGrid.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No tasks assigned yet.</Text>
              </View>
            ) : (
              completionGrid.map(({ task, memberStatuses, completedCount, totalMembers, pct }) => (
                <View key={task.id} style={styles.completionCard}>
                  <View style={styles.completionHeader}>
                    <Text style={{ fontSize: 18 }}>{task.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.completionTitle}>{task.title}</Text>
                      <Text style={styles.completionMeta}>
                        {task.type === 'daily' ? '🔄 Daily' :
                         task.type === 'scheduled' ? `📅 ${task.scheduledDays?.map(d => DAY_LABELS[d]).join(', ')}` :
                         `🎯 Due ${formatDueDate(task.dueDate!)}`}
                      </Text>
                    </View>
                    <View style={[styles.pctBadge, pct === 100 && styles.pctBadgeFull]}>
                      <Text style={[styles.pctText, pct === 100 && styles.pctTextFull]}>{pct}%</Text>
                    </View>
                  </View>

                  <View style={styles.completionBar}>
                    <View style={[styles.completionFill, { width: `${pct}%` }]} />
                  </View>

                  <Text style={styles.completionCount}>
                    {completedCount}/{totalMembers} completed
                  </Text>

                  <View style={styles.memberDots}>
                    {memberStatuses.map((s, i) => (
                      <View key={i} style={styles.memberDot}>
                        <View style={[styles.dotCircle, s.completed && styles.dotCircleDone]}>
                          <Text style={styles.dotText}>{s.name.charAt(0)}</Text>
                        </View>
                        <Text style={styles.dotName} numberOfLines={1}>{s.name.split(' ')[0]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* ── Member Detail View ── */}
        {view === 'member' && !selectedMember && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select a Member</Text>
            {members
              .filter(m => m.userId !== team.coachId)
              .map(m => {
                const score = memberScores.find(s => s.userId === m.userId);
                return (
                  <TouchableOpacity
                    key={m.userId}
                    style={styles.memberSelectRow}
                    onPress={() => setSelectedMember(m)}
                  >
                    <View style={styles.memberSelectAvatar}>
                      <Text style={styles.memberSelectAvatarText}>
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberSelectName}>{m.name}</Text>
                      <Text style={styles.memberSelectMeta}>
                        {score?.totalPoints || 0} pts · 🔥{score?.streak || 0}
                      </Text>
                    </View>
                    <Text style={{ color: '#ccc', fontSize: 18 }}>›</Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {view === 'member' && selectedMember && (
          <>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setSelectedMember(null)}
            >
              <Text style={styles.backBtnText}>‹ Back to members</Text>
            </TouchableOpacity>

            <View style={styles.memberHeader}>
              <View style={styles.memberHeaderAvatar}>
                <Text style={styles.memberHeaderAvatarText}>
                  {selectedMember.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.memberHeaderName}>{selectedMember.name}</Text>
              {(() => {
                const score = memberScores.find(s => s.userId === selectedMember.userId);
                return (
                  <View style={styles.memberHeaderStats}>
                    <View style={styles.memberHeaderStat}>
                      <Text style={styles.memberHeaderStatVal}>{score?.totalPoints || 0}</Text>
                      <Text style={styles.memberHeaderStatLbl}>Points</Text>
                    </View>
                    <View style={styles.memberHeaderStat}>
                      <Text style={styles.memberHeaderStatVal}>{score?.todayCompleted || 0}/{score?.todayTotal || 0}</Text>
                      <Text style={styles.memberHeaderStatLbl}>Today</Text>
                    </View>
                    <View style={styles.memberHeaderStat}>
                      <Text style={styles.memberHeaderStatVal}>{score?.streak || 0}</Text>
                      <Text style={styles.memberHeaderStatLbl}>Streak</Text>
                    </View>
                  </View>
                );
              })()}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Task Breakdown</Text>
              {memberDetail.map(({ task, completedToday, totalPts, totalCompletions }) => (
                <View key={task.id} style={styles.detailRow}>
                  <View style={[styles.detailStatus, completedToday && styles.detailStatusDone]}>
                    <Text style={{ fontSize: 14 }}>{completedToday ? '✓' : task.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailName, completedToday && styles.detailNameDone]}>
                      {task.title}
                    </Text>
                    <Text style={styles.detailMeta}>
                      {totalCompletions} completions · {totalPts} pts earned
                    </Text>
                  </View>
                  <Text style={styles.detailToday}>
                    {completedToday ? '✅' : '⬜'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

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
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  refreshBtnText: { color: '#fff', fontSize: 20 },

  viewTabs: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  viewTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  viewTabActive: { backgroundColor: ORANGE },
  viewTabText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  viewTabTextActive: { color: '#fff' },

  dateFilters: { flexDirection: 'row', gap: 6 },
  dateFilter: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dateFilterActive: { backgroundColor: 'rgba(255,107,53,0.3)' },
  dateFilterText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' },
  dateFilterTextActive: { color: ORANGE },

  scroll: { padding: 16, gap: 16, paddingBottom: 32 },

  // Podium
  podium: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  podiumSpot: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  podiumFirst: { borderColor: ORANGE, borderWidth: 1 },
  podiumBadge: { fontSize: 24, marginBottom: 4 },
  podiumAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#e0d5cc',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  podiumAvatarFirst: { backgroundColor: ORANGE },
  podiumAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  podiumName: { fontSize: 12, fontWeight: '600', color: '#333', marginBottom: 2 },
  podiumPts: { fontSize: 16, fontWeight: '800', color: ORANGE },
  podiumStreak: { fontSize: 11, color: '#aaa', marginTop: 2 },

  // Section
  section: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    borderWidth: 0.5, borderColor: '#e8e4df', gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },

  // Leaderboard rows
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#f0ece8',
  },
  leaderRowMe: { backgroundColor: '#fff8f5', borderRadius: 10, paddingHorizontal: 8 },
  leaderRank: { fontSize: 18, width: 30, textAlign: 'center' },
  leaderAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#e0d5cc',
    alignItems: 'center', justifyContent: 'center',
  },
  leaderAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 14, fontWeight: '600', color: '#333' },
  leaderNameMe: { color: ORANGE },
  leaderMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },
  leaderPts: { fontSize: 14, fontWeight: '800', color: ORANGE },

  // Completion cards
  completionCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 0.5, borderColor: '#e8e4df', gap: 10,
  },
  completionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  completionTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  completionMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },
  pctBadge: {
    backgroundColor: '#fff0ea', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  pctBadgeFull: { backgroundColor: ORANGE },
  pctText: { fontSize: 13, fontWeight: '700', color: ORANGE },
  pctTextFull: { color: '#fff' },
  completionBar: {
    height: 6, backgroundColor: '#f0ece8', borderRadius: 3, overflow: 'hidden',
  },
  completionFill: { height: '100%', backgroundColor: ORANGE, borderRadius: 3 },
  completionCount: { fontSize: 11, color: '#aaa' },
  memberDots: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  memberDot: { alignItems: 'center', gap: 3 },
  dotCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f0ece8',
    alignItems: 'center', justifyContent: 'center',
  },
  dotCircleDone: { backgroundColor: ORANGE },
  dotText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dotName: { fontSize: 9, color: '#aaa', maxWidth: 50, textAlign: 'center' },

  // Member select
  memberSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 0.5, borderColor: '#f0ece8',
  },
  memberSelectAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#e0d5cc',
    alignItems: 'center', justifyContent: 'center',
  },
  memberSelectAvatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  memberSelectName: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberSelectMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },

  // Member detail
  backBtn: { marginBottom: 4 },
  backBtnText: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  memberHeader: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#e8e4df', gap: 8,
  },
  memberHeaderAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },
  memberHeaderAvatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  memberHeaderName: { fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  memberHeaderStats: { flexDirection: 'row', gap: 16, marginTop: 4 },
  memberHeaderStat: { alignItems: 'center' },
  memberHeaderStatVal: { fontSize: 20, fontWeight: '800', color: '#333' },
  memberHeaderStatLbl: { fontSize: 10, color: '#aaa', marginTop: 2 },

  detailRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#f0ece8',
  },
  detailStatus: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#fff0ea',
    alignItems: 'center', justifyContent: 'center',
  },
  detailStatusDone: { backgroundColor: ORANGE },
  detailName: { fontSize: 14, fontWeight: '500', color: '#333' },
  detailNameDone: { color: ORANGE },
  detailMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },
  detailToday: { fontSize: 18 },

  // Empty
  emptyBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center' },

  // Member-only view
  myStatsCard: {
    backgroundColor: ORANGE, borderRadius: 20, padding: 24,
    alignItems: 'center',
  },
  myRank: { color: '#fff', fontSize: 48, fontWeight: '800' },
  myRankLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
  myStatsRow: { flexDirection: 'row', gap: 10 },
  myStatBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  myStatVal: { fontSize: 22, fontWeight: '800', color: '#333' },
  myStatLbl: { fontSize: 10, color: '#aaa', marginTop: 2 },
});