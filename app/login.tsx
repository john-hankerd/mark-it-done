import { router } from 'expo-router';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../firebaseConfig';

const ORANGE = '#FF6B35';
const auth = getAuth();

export default function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isCoach, setIsCoach] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter your email and password.');
      return;
    }
    if (isSignUp && !name.trim()) {
      Alert.alert('Missing info', 'Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', result.user.uid), {
          name: name.trim(),
          email: email.trim(),
          isCoach: isCoach,
          isPro: false,
          createdAt: new Date().toISOString(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      let message = 'Something went wrong. Please try again.';
      if (e.code === 'auth/email-already-in-use') message = 'That email is already registered. Try signing in.';
      if (e.code === 'auth/invalid-email') message = 'Please enter a valid email address.';
      if (e.code === 'auth/wrong-password') message = 'Incorrect password. Please try again.';
      if (e.code === 'auth/user-not-found') message = 'No account found with that email.';
      if (e.code === 'auth/weak-password') message = 'Password must be at least 6 characters.';
      Alert.alert('Error', message);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo area */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>✅</Text>
          </View>
          <Text style={styles.logoTitle}>MarkItDone</Text>
          <Text style={styles.logoSub}>Daily disciplines. Real results.</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{isSignUp ? 'Create account' : 'Welcome back'}</Text>
          <Text style={styles.cardSub}>{isSignUp ? 'Start tracking your disciplines' : 'Sign in to continue'}</Text>

          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#aaa"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#aaa"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />

          {isSignUp && (
            <View style={styles.roleSection}>
              <Text style={styles.roleLabel}>I am a...</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity
                  style={[styles.roleBtn, !isCoach && styles.roleBtnActive]}
                  onPress={() => setIsCoach(false)}
                >
                  <Text style={styles.roleIcon}>👤</Text>
                  <Text style={[styles.roleBtnText, !isCoach && styles.roleBtnTextActive]}>Individual</Text>
                  <Text style={styles.roleBtnDesc}>Personal tracking</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleBtn, isCoach && styles.roleBtnActive]}
                  onPress={() => setIsCoach(true)}
                >
                  <Text style={styles.roleIcon}>🎯</Text>
                  <Text style={[styles.roleBtnText, isCoach && styles.roleBtnTextActive]}>Coach</Text>
                  <Text style={styles.roleBtnDesc}>Manage a team</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.authBtn, loading && styles.authBtnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.authBtnText}>
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchRow}>
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.switchLink}>{isSignUp ? 'Sign in' : 'Sign up free'}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.terms}>
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },

  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: ORANGE, alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  logoIcon: { fontSize: 36 },
  logoTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a2e' },
  logoSub: { fontSize: 14, color: '#aaa', marginTop: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 0.5,
    borderColor: '#e8e4df',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a2e', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#aaa', marginBottom: 20 },

  input: {
    backgroundColor: '#f7f5f2',
    borderRadius: 12,
    padding: 14,
    color: '#1a1a2e',
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: '#e8e4df',
  },

  roleSection: { marginBottom: 16 },
  roleLabel: { fontSize: 13, color: '#aaa', marginBottom: 8, fontWeight: '600' },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#f7f5f2', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  roleBtnActive: { backgroundColor: '#fff8f5', borderColor: ORANGE },
  roleIcon: { fontSize: 24, marginBottom: 4 },
  roleBtnText: { fontSize: 14, fontWeight: '700', color: '#aaa' },
  roleBtnTextActive: { color: ORANGE },
  roleBtnDesc: { fontSize: 11, color: '#bbb', marginTop: 2 },

  authBtn: {
    backgroundColor: ORANGE,
    padding: 16, borderRadius: 12,
    alignItems: 'center', marginBottom: 16,
  },
  authBtnDisabled: { opacity: 0.6 },
  authBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  switchRow: { alignItems: 'center' },
  switchText: { fontSize: 14, color: '#aaa' },
  switchLink: { color: ORANGE, fontWeight: '700' },

  terms: { fontSize: 11, color: '#ccc', textAlign: 'center' },
});