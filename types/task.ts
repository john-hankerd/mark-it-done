// MarkItDone v2.0 — Task & Completion Types

export type TaskType = 'daily' | 'scheduled' | 'deadline';
export type AssignedBy = 'coach' | 'self';

export interface Task {
  id: string;
  title: string;
  icon: string;
  type: TaskType;
  scheduledDays?: number[];
  dueDate?: string;
  pointValue: number;
  assignedBy: AssignedBy;
  teamDefault: boolean;
  teamId?: string;
  memberId?: string;
  createdAt: string;
}

export interface CompletionRecord {
  taskId: string;
  memberId: string;
  completedDate: string;
  scheduledDate: string;
  onTime: boolean;
  pointsEarned: number;
}

export interface MemberPoints {
  memberId: string;
  teamId: string;
  totalPoints: number;
  weeklyPoints: number;
  streakBonuses: number;
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];