// MarkItDone v2.0 — Notification Service
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIF_SETTINGS_KEY = '@markitdone_notif_settings';

export interface NotifSettings {
  enabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  streakWarning: boolean;
}

const DEFAULT_SETTINGS: NotifSettings = {
  enabled: true,
  reminderHour: 20,
  reminderMinute: 0,
  streakWarning: true,
};

export async function setupNotifications(): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Daily Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

export async function getNotifSettings(): Promise<NotifSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
    return DEFAULT_SETTINGS;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export async function saveNotifSettings(settings: NotifSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.log('Notif settings save error:', e);
  }
}

export async function scheduleDailyReminder(
  hour: number,
  minute: number,
  taskCount: number
): Promise<void> {
  await cancelAllReminders();
  if (taskCount === 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'MarkItDone Reminder',
      body: `You have ${taskCount} task${taskCount > 1 ? 's' : ''} to complete today. Keep your streak alive!`,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'reminders' }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function scheduleStreakWarning(
  incompleteTasks: number,
  currentStreak: number
): Promise<void> {
  if (incompleteTasks === 0 || currentStreak === 0) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.title === 'Streak Warning!') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  const now = new Date();
  const ninepm = new Date();
  ninepm.setHours(21, 0, 0, 0);

  if (now < ninepm) {
    const secondsUntil = Math.floor((ninepm.getTime() - now.getTime()) / 1000);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Streak Warning!',
        body: `You have ${incompleteTasks} task${incompleteTasks > 1 ? 's' : ''} left! Your ${currentStreak}-day streak is at risk.`,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'reminders' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(secondsUntil, 1),
      },
    });
  }
}

export async function sendInstantNotification(
  title: string,
  body: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      ...(Platform.OS === 'android' && { channelId: 'reminders' }),
    },
    trigger: null,
  });
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

export function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  const m = String(minute).padStart(2, '0');
  return `${h}:${m} ${period}`;
}

export function getReminderTimes(): { hour: number; minute: number; label: string }[] {
  const times = [];
  for (let h = 6; h <= 22; h++) {
    times.push({ hour: h, minute: 0, label: formatTime(h, 0) });
    if (h < 22) {
      times.push({ hour: h, minute: 30, label: formatTime(h, 30) });
    }
  }
  return times;
}