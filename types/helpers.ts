// MarkItDone v2.0 — Utility helpers
import { Task } from './task';

export function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00').getDay();
}

export function isTaskActiveToday(task: Task): boolean {
  const today = todayString();
  const dow = dayOfWeek(today);

  switch (task.type) {
    case 'daily':
      return true;
    case 'scheduled':
      return task.scheduledDays?.includes(dow) ?? false;
    case 'deadline':
      return !!task.dueDate && task.dueDate >= today;
    default:
      return true;
  }
}

export function wasTaskActiveOn(task: Task, dateStr: string): boolean {
  // A task can't have been "active" — let alone missed — on a day before
  // it existed. Without this, a brand-new daily/scheduled task looks
  // active for every date in the past (its pattern matches regardless of
  // when it was created), so it shows up as "missed yesterday" the
  // instant someone creates it today.
  const createdDate = task.createdAt.split('T')[0];
  if (createdDate > dateStr) return false;

  const dow = dayOfWeek(dateStr);

  switch (task.type) {
    case 'daily':
      return true;
    case 'scheduled':
      return task.scheduledDays?.includes(dow) ?? false;
    case 'deadline':
      return task.dueDate === dateStr;
    default:
      return false;
  }
}

export function pointsForTask(task: Task, onTime: boolean): number {
  if (!onTime) return 0;
  return task.pointValue;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getDayString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDueDate(dateStr: string): string {
  const today = todayString();
  if (dateStr === today) return 'Today';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function daysUntilDue(dateStr: string): number {
  const today = new Date(todayString() + 'T12:00:00');
  const due = new Date(dateStr + 'T12:00:00');
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}