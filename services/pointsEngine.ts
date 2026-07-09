// MarkItDone v2.0 — Phase 3: Points Engine
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayString } from '../types/helpers';
import { Task } from '../types/task';

const COMPLETIONS_KEY = '@markitdone_completions';
const STREAK_KEY = '@markitdone_streaks';
const POINTS_KEY = '@markitdone_points_log'; // { [date]: { earned, bonus } }

export interface DayPoints {
  earned: number;    // base points from completions
  bonus: number;     // streak bonus points
  total: number;     // earned + bonus
}

export interface StreakInfo {
  taskId: string;
  current: number;
  bonusAwarded: number;
}

// ─── Streak bonus tiers ───
// Every 7 consecutive days = +3 bonus pts
// Every 30 consecutive days = +10 bonus pts
export function calcStreakBonus(streakCount: number): number {
  let bonus = 0;

  // +3 for every 7-day milestone hit on this exact day
  if (streakCount > 0 && streakCount % 7 === 0) {
    bonus += 3;
  }

  // +10 for every 30-day milestone hit on this exact day
  if (streakCount > 0 && streakCount % 30 === 0) {
    bonus += 10;
  }

  return bonus;
}

// ─── Calculate points for completing a task ───
export function calcTaskPoints(
  task: Task,
  onTime: boolean,
  currentStreak: number
): { basePoints: number; streakBonus: number; newStreak: number } {
  // Catch-up = 0 points, no streak increment
  if (!onTime) {
    return { basePoints: 0, streakBonus: 0, newStreak: 0 };
  }

  // Base points
  const basePoints = task.pointValue;

  // Streak only applies to daily/scheduled
  let newStreak = currentStreak;
  let streakBonus = 0;

  if (task.type !== 'deadline') {
    newStreak = currentStreak + 1;
    streakBonus = calcStreakBonus(newStreak);
  }

  return { basePoints, streakBonus, newStreak };
}

// ─── Get total points for a date range ───
export async function getPointsForRange(
  tasks: Task[],
  completions: Record<string, boolean>,
  startDate: string,
  endDate: string
): Promise<{ total: number; earned: number; bonuses: number }> {
  const streaks: Record<string, number> = {};
  let earned = 0;
  let bonuses = 0;

  // Walk through each date
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dow = d.getDay();

    for (const task of tasks) {
      const key = `${task.id}-${dateStr}`;
      const wasCompleted = completions[key] === true;

      if (!wasCompleted) {
        // Reset streak for daily/scheduled if missed
        if (task.type === 'daily' || 
            (task.type === 'scheduled' && task.scheduledDays?.includes(dow))) {
          streaks[task.id] = 0;
        }
        continue;
      }

      // Was this task active on this date?
      let wasActive = false;
      if (task.type === 'daily') wasActive = true;
      if (task.type === 'scheduled') wasActive = task.scheduledDays?.includes(dow) ?? false;
      if (task.type === 'deadline') wasActive = task.dueDate === dateStr;

      if (!wasActive) continue;

      // Calculate points
      const currentStreak = streaks[task.id] || 0;
      const result = calcTaskPoints(task, true, currentStreak);
      earned += result.basePoints;
      bonuses += result.streakBonus;
      streaks[task.id] = result.newStreak;
    }
  }

  return { total: earned + bonuses, earned, bonuses };
}

// ─── Calculate today's points (quick) ───
export function calcTodayPoints(
  tasks: Task[],
  completions: Record<string, boolean>,
  streaks: Record<string, number>
): { points: number; bonuses: number } {
  const today = todayString();
  let points = 0;
  let bonuses = 0;

  for (const task of tasks) {
    const key = `${task.id}-${today}`;
    if (completions[key] !== true) continue;

    points += task.pointValue;

    // Check for streak bonus on daily/scheduled
    if (task.type !== 'deadline') {
      const streak = streaks[task.id] || 0;
      bonuses += calcStreakBonus(streak);
    }
  }

  return { points, bonuses };
}

// ─── Get all-time total points from stored log ───
export async function getAllTimePoints(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(POINTS_KEY);
    if (!raw) return 0;
    const log: Record<string, DayPoints> = JSON.parse(raw);
    return Object.values(log).reduce((sum, day) => sum + day.total, 0);
  } catch (e) {
    return 0;
  }
}

// ─── Save today's points to the log ───
export async function saveDayPoints(date: string, earned: number, bonus: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(POINTS_KEY);
    const log: Record<string, DayPoints> = raw ? JSON.parse(raw) : {};
    log[date] = { earned, bonus, total: earned + bonus };
    await AsyncStorage.setItem(POINTS_KEY, JSON.stringify(log));
  } catch (e) {
    console.log('Points save error:', e);
  }
}

// ─── Get points log ───
export async function getPointsLog(): Promise<Record<string, DayPoints>> {
  try {
    const raw = await AsyncStorage.getItem(POINTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

// ─── Get this week's points ───
export async function getWeeklyPoints(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(POINTS_KEY);
    if (!raw) return 0;
    const log: Record<string, DayPoints> = JSON.parse(raw);

    // Get Monday of current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const mondayStr = monday.toISOString().split('T')[0];

    let total = 0;
    for (const [date, pts] of Object.entries(log)) {
      if (date >= mondayStr) {
        total += pts.total;
      }
    }
    return total;
  } catch (e) {
    return 0;
  }
}