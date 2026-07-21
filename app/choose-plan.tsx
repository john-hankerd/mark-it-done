import { router, useLocalSearchParams } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { showAlert } from '../services/alert';
import { getUserProfile } from '../services/teamService';

const ORANGE = '#FF6B35';
const FUNCTIONS_ORIGIN = 'https://mark-it-done-600.netlify.app';

type Plan = 'monthly' | 'annual';

export default function ChoosePlanScreen() {
  const { canceled } = useLocalSearchParams<{ canceled?: string }>();
  const [selected, setSelected] = useState<Plan>('annual');
  const [loading, setLoading] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    getUserProfile(uid).then((profile) => {
      if (profile?.trialEndsAt) setTrialEndsAt(profile.trialEndsAt);
    });
  }, []);

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const startTrial = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user || !user.email) {
      showAlert('Not signed in', 'Please sign in again to continue.');
      router.replace('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_ORIGIN}/.netlify/functions/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, email: user.email, plan: selected, trialEndsAt }),
      });
      const data = await res.json();
      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || 'Could not start checkout');
      }
      await Linking.openURL(data.checkout_url);
    } catch (e) {
      showAlert('Error', 'Could not start checkout. Please try again.');
    }
    setLoading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Text style={styles.title}>Set up your Team plan</Text>
        <Text style={styles.subtitle}>
          Mark It Done is free for individuals. As a coach, a Team plan lets you create a
          team, assign disciplines, and track everyone's progress.
        </Text>
      </View>

      {canceled === '1' && (
        <View style={styles.canceledBanner}>
          <Text style={styles.canceledText}>Checkout canceled — pick a plan whenever you're ready.</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.planCard, selected === 'monthly' && styles.planCardActive]}
        onPress={() => setSelected('monthly')}
      >
        <View style={styles.planRow}>
          <Text style={styles.planName}>Monthly</Text>
          <Text style={styles.planPrice}>$39<Text style={styles.planPriceUnit}>/mo</Text></Text>
        </View>
        <Text style={styles.planDesc}>Billed every month. Cancel anytime.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.planCard, selected === 'annual' && styles.planCardActive]}
        onPress={() => setSelected('annual')}
      >
        <View style={styles.planRow}>
          <Text style={styles.planName}>Annual</Text>
          <Text style={styles.planPrice}>$390<Text style={styles.planPriceUnit}>/yr</Text></Text>
        </View>
        <Text style={styles.planDesc}>2 months free compared to monthly.</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>BEST VALUE</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.startBtn, loading && styles.startBtnDisabled]}
        onPress={startTrial}
        disabled={loading}
      >
        <Text style={styles.startBtnText}>
          {loading ? 'Please wait...' : 'Add Card'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.fineprint}>
        {trialDaysLeft > 0
          ? `You won't be charged until your free trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}. Cancel anytime before then.`
          : "Your free trial has ended, so you'll be charged as soon as you add a card."}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, backgroundColor: '#f7f5f2' },
  header: { marginTop: 24, marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1a2e', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', lineHeight: 20 },

  canceledBanner: {
    backgroundColor: '#fff0ea',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ORANGE,
  },
  canceledText: { color: ORANGE, fontSize: 13, fontWeight: '600' },

  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#e8e4df',
    position: 'relative',
  },
  planCardActive: { borderColor: ORANGE, backgroundColor: '#fff8f5' },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  planPrice: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  planPriceUnit: { fontSize: 13, fontWeight: '400', color: '#aaa' },
  planDesc: { fontSize: 13, color: '#888', marginTop: 6 },

  badge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: ORANGE,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  startBtn: {
    backgroundColor: ORANGE,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  fineprint: { fontSize: 12, color: '#aaa', textAlign: 'center', marginTop: 16, lineHeight: 18 },
});
