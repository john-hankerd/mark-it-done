// MarkItDone v2.0 — Weekly Goals Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const PERSONAL_GOAL_KEY = '@markitdone_weekly_goal';

export interface WeeklyGoal {
  targetPoints: number;
  targetPct: number; // 0-100, completion % target
  type: 'points' | 'completion'; // which metric to track
}

// ─── Get current week identifier (Monday date string) ───
export function getCurrentWeekId(): string {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  return monday.toISOString().split('T')[0];
}

// ─── Get days remaining in the week ───
export function getDaysRemainingInWeek(): number {
  const now = new Date();
  const dow = now.getDay();
  // Sunday = 0, so days remaining = 0 on Sunday, 6 on Monday
  if (dow === 0) return 0;
  return 7 - dow;
}

// ─── Get day of week name ───
export function getWeekDayName(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

// ─── Personal weekly goal (stored locally) ───
export async function getPersonalGoal(): Promise<WeeklyGoal | null> {
  try {
    const raw = await AsyncStorage.getItem(PERSONAL_GOAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function savePersonalGoal(goal: WeeklyGoal): Promise<void> {
  try {
    await AsyncStorage.setItem(PERSONAL_GOAL_KEY, JSON.stringify(goal));
  } catch (e) {
    console.log('Goal save error:', e);
  }
}

export async function clearPersonalGoal(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PERSONAL_GOAL_KEY);
  } catch (e) {
    console.log('Goal clear error:', e);
  }
}

// ─── Team weekly goal (stored in Firestore, set by coach) ───
export async function getTeamGoal(teamId: string): Promise<WeeklyGoal | null> {
  try {
    const snap = await getDoc(doc(db, 'teams', teamId, 'settings', 'weeklyGoal'));
    if (!snap.exists()) return null;
    return snap.data() as WeeklyGoal;
  } catch (e) {
    return null;
  }
}

export async function saveTeamGoal(teamId: string, goal: WeeklyGoal): Promise<void> {
  try {
    await setDoc(doc(db, 'teams', teamId, 'settings', 'weeklyGoal'), goal);
  } catch (e) {
    console.log('Team goal save error:', e);
  }
}

// ─── Calculate weekly completion % ───
// Average of daily completion percentages for the current week so far
export function calcWeeklyCompletionPct(
  dailyPcts: Record<string, number>
): number {
  const weekStart = getCurrentWeekId();
  const today = new Date();
  let totalPct = 0;
  let dayCount = 0;

  const start = new Date(weekStart + 'T12:00:00');
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const pct = dailyPcts[dateStr];
    if (pct !== undefined && pct >= 0) {
      totalPct += pct;
      dayCount++;
    }
  }

  return dayCount > 0 ? Math.round(totalPct / dayCount) : 0;
}

// ─── Check if goal is met ───
export function isGoalMet(
  goal: WeeklyGoal,
  currentPoints: number,
  completionPct: number
): boolean {
  if (goal.type === 'points') {
    return currentPoints >= goal.targetPoints;
  }
  return completionPct >= goal.targetPct;
}

// ─── Get goal progress as percentage ───
export function goalProgress(
  goal: WeeklyGoal,
  currentPoints: number,
  completionPct: number
): number {
  if (goal.type === 'points') {
    return goal.targetPoints > 0
      ? Math.min(100, Math.round((currentPoints / goal.targetPoints) * 100))
      : 0;
  }
  return goal.targetPct > 0
    ? Math.min(100, Math.round((completionPct / goal.targetPct) * 100))
    : 0;
}