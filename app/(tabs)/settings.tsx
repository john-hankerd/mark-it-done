// MarkItDone v2.0 — Settings Screen (Notifications + Account)
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from '../../firebaseConfig';
import { showAlert } from '../../services/alert';
import {
    cancelAllReminders,
    formatTime,
    getNotifSettings,
    getReminderTimes,
    getScheduledCount,
    NotifSettings,
    saveNotifSettings,
    scheduleDailyReminder,
    setupNotifications,
} from '../../services/notificationService';
import { getUserProfile, startCoachTrial } from '../../services/teamService';

const ORANGE = '#FF6B35';

const STATUS_LABELS: Record<string, string> = {
  trialing: 'Free trial',
  active: 'Active',
  past_due: 'Payment failed',
  canceled: 'Canceled',
  unpaid: 'Payment failed',
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<NotifSettings>({
    enabled: true,
    reminderHour: 20,
    reminderMinute: 0,
    streakWarning: true,
  });
  const [permissionGranted, setPermissionGranted] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [isCoach, setIsCoach] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);

  const trialActive = subscriptionStatus === 'trialing' && !!trialEndsAt && new Date(trialEndsAt) > new Date();
  const hasActiveAccess = subscriptionStatus === 'active' || trialActive;

  useEffect(() => {
    loadSettings();
    loadBillingProfile();
  }, []);

  const loadBillingProfile = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const profile = await getUserProfile(uid);
      if (profile) {
        setIsCoach(profile.isCoach || false);
        setSubscriptionStatus(profile.subscriptionStatus || null);
        setPlan(profile.plan || null);
        setTrialEndsAt(profile.trialEndsAt || null);
        setStripeCustomerId(profile.stripeCustomerId || null);
      }
    } catch (e) {
      console.log('Billing profile load error:', e);
    }
  };

  const manageBilling = async () => {
    if (stripeCustomerId) {
      try {
        const res = await fetch('https://mark-it-done-600.netlify.app/.netlify/functions/create-portal-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripeCustomerId }),
        });
        const data = await res.json();
        if (res.ok && data.portal_url) {
          await Linking.openURL(data.portal_url);
          return;
        }
      } catch (e) {}
    }
    router.push('/choose-plan');
  };

  const becomeCoach = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      const trialEndsAt = await startCoachTrial(uid);
      setIsCoach(true);
      setSubscriptionStatus('trialing');
      setTrialEndsAt(trialEndsAt);
      showAlert(
        "You're a Coach!",
        "Your 30-day free trial has started — no card needed. Head to the Team tab to create your team."
      );
    } catch (e) {
      showAlert('Error', 'Could not switch to a Team plan. Please try again.');
    }
  };

  const loadSettings = async () => {
    try {
      const s = await getNotifSettings();
      setSettings(s);
      const count = await getScheduledCount();
      setScheduledCount(count);
    } catch (e) {
      console.log('Settings load error:', e);
    }
    setLoaded(true);
  };

  const toggleEnabled = async (value: boolean) => {
    if (value) {
      const granted = await setupNotifications();
      if (!granted) {
        setPermissionGranted(false);
        showAlert(
          'Permission Required',
          'Please enable notifications in your device settings to use reminders.'
        );
        return;
      }
      setPermissionGranted(true);
    }

    const updated = { ...settings, enabled: value };
    setSettings(updated);
    await saveNotifSettings(updated);

    if (value) {
      await scheduleDailyReminder(updated.reminderHour, updated.reminderMinute, 5);
    } else {
      await cancelAllReminders();
    }

    const count = await getScheduledCount();
    setScheduledCount(count);
  };

  const toggleStreakWarning = async (value: boolean) => {
    const updated = { ...settings, streakWarning: value };
    setSettings(updated);
    await saveNotifSettings(updated);
  };

  const selectTime = async (hour: number, minute: number) => {
    const updated = { ...settings, reminderHour: hour, reminderMinute: minute };
    setSettings(updated);
    await saveNotifSettings(updated);
    setShowTimePicker(false);

    if (settings.enabled) {
      await scheduleDailyReminder(hour, minute, 5);
      const count = await getScheduledCount();
      setScheduledCount(count);
    }
  };

  const handleSignOut = () => {
    showAlert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelAllReminders();
            await signOut(auth);
            router.replace('/login');
          } catch (e) {
            showAlert('Error', 'Could not sign out.');
          }
        },
      },
    ]);
  };

  const handleTestNotification = async () => {
    const { sendInstantNotification } = await import('../../services/notificationService');
    await sendInstantNotification(
      'Test Notification',
      'MarkItDone notifications are working!'
    );
  };

  const reminderTimes = getReminderTimes();

  if (!loaded) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#aaa' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSub}>Notifications & account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Daily Reminders</Text>
              <Text style={styles.settingDesc}>
                Get reminded to complete your tasks
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: '#ddd', true: 'rgba(255,107,53,0.4)' }}
              thumbColor={settings.enabled ? ORANGE : '#f4f3f4'}
            />
          </View>

          {settings.enabled && (
            <>
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setShowTimePicker(!showTimePicker)}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Reminder Time</Text>
                  <Text style={styles.settingDesc}>
                    When to send the daily reminder
                  </Text>
                </View>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeText}>
                    {formatTime(settings.reminderHour, settings.reminderMinute)}
                  </Text>
                </View>
              </TouchableOpacity>

              {showTimePicker && (
                <View style={styles.timePickerBox}>
                  <ScrollView
                    style={{ maxHeight: 200 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {reminderTimes.map(t => (
                      <TouchableOpacity
                        key={`${t.hour}-${t.minute}`}
                        style={[
                          styles.timeOption,
                          settings.reminderHour === t.hour &&
                            settings.reminderMinute === t.minute &&
                            styles.timeOptionActive,
                        ]}
                        onPress={() => selectTime(t.hour, t.minute)}
                      >
                        <Text
                          style={[
                            styles.timeOptionText,
                            settings.reminderHour === t.hour &&
                              settings.reminderMinute === t.minute &&
                              styles.timeOptionTextActive,
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Streak Warnings</Text>
                  <Text style={styles.settingDesc}>
                    Alert at 9 PM if your streak is at risk
                  </Text>
                </View>
                <Switch
                  value={settings.streakWarning}
                  onValueChange={toggleStreakWarning}
                  trackColor={{ false: '#ddd', true: 'rgba(255,107,53,0.4)' }}
                  thumbColor={settings.streakWarning ? ORANGE : '#f4f3f4'}
                />
              </View>

              <TouchableOpacity style={styles.testBtn} onPress={handleTestNotification}>
                <Text style={styles.testBtnText}>Send Test Notification</Text>
              </TouchableOpacity>

              <Text style={styles.statusText}>
                {scheduledCount} notification{scheduledCount !== 1 ? 's' : ''} scheduled
              </Text>
            </>
          )}

          {!permissionGranted && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Notifications are blocked. Please enable them in your device settings.
              </Text>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Email</Text>
            <Text style={styles.accountValue}>
              {auth.currentUser?.email || 'Not signed in'}
            </Text>
          </View>

          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>User ID</Text>
            <Text style={styles.accountValueSmall}>
              {auth.currentUser?.uid || '—'}
            </Text>
          </View>

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Billing Section (Coaches only) */}
        {isCoach && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Plan</Text>

            <View style={styles.accountRow}>
              <Text style={styles.accountLabel}>Status</Text>
              <Text style={styles.accountValue}>
                {trialActive
                  ? 'Free trial'
                  : subscriptionStatus
                  ? (STATUS_LABELS[subscriptionStatus] || subscriptionStatus)
                  : 'Trial ended'}
              </Text>
            </View>

            {plan && stripeCustomerId && (
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Plan</Text>
                <Text style={styles.accountValue}>
                  {plan === 'annual' ? '$390/yr' : '$39/mo'}
                </Text>
              </View>
            )}

            {trialActive && trialEndsAt && (
              <View style={styles.accountRow}>
                <Text style={styles.accountLabel}>Trial ends</Text>
                <Text style={styles.accountValue}>
                  {new Date(trialEndsAt).toLocaleDateString()}
                </Text>
              </View>
            )}

            {!stripeCustomerId && (
              <Text style={styles.settingDesc}>
                {trialActive
                  ? "No card needed during your trial. Add one anytime to keep access after it ends."
                  : 'Your free trial has ended. Add a card to keep using your coach portal.'}
              </Text>
            )}

            <TouchableOpacity style={styles.testBtn} onPress={manageBilling}>
              <Text style={styles.testBtnText}>
                {stripeCustomerId ? 'Manage Billing' : 'Add Card'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Become a Coach (Individuals only) */}
        {!isCoach && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coaching a Team?</Text>
            <Text style={styles.settingDesc}>
              Switch to a Team plan to create a team, assign disciplines, and track everyone's
              progress. $39/mo or $390/yr, with a 30-day free trial — no card required to start.
              Your tasks and history stay exactly as they are.
            </Text>
            <TouchableOpacity style={styles.testBtn} onPress={becomeCoach}>
              <Text style={styles.testBtnText}>Become a Coach</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.aboutText}>MarkItDone v2.0</Text>
          <Text style={styles.aboutDesc}>
            Daily disciplines. Real results.
          </Text>
        </View>

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
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 0.5,
    borderColor: '#e8e4df',
    gap: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  settingDesc: { fontSize: 12, color: '#aaa', marginTop: 2 },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeBadge: {
    backgroundColor: '#fff0ea',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: ORANGE,
  },
  timeText: { color: ORANGE, fontSize: 14, fontWeight: '700' },

  timePickerBox: {
    backgroundColor: '#f7f5f2',
    borderRadius: 12,
    padding: 8,
  },
  timeOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  timeOptionActive: {
    backgroundColor: ORANGE,
  },
  timeOptionText: { fontSize: 14, color: '#333', textAlign: 'center' },
  timeOptionTextActive: { color: '#fff', fontWeight: '700' },

  testBtn: {
    backgroundColor: '#f7f5f2',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#e8e4df',
  },
  testBtnText: { color: ORANGE, fontWeight: '600', fontSize: 13 },

  statusText: { fontSize: 11, color: '#bbb', textAlign: 'center' },

  warningBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffe58f',
  },
  warningText: { fontSize: 12, color: '#8b7000' },

  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  accountLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  accountValue: { fontSize: 14, color: '#aaa' },
  accountValueSmall: { fontSize: 11, color: '#ccc', maxWidth: 180 },

  signOutBtn: {
    backgroundColor: '#fff0f0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  signOutText: { color: '#ff4444', fontWeight: '700', fontSize: 15 },

  aboutText: { fontSize: 14, fontWeight: '600', color: '#333' },
  aboutDesc: { fontSize: 12, color: '#aaa' },
});