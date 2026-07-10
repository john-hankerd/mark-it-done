import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: "markitdone-27f82.firebaseapp.com",
  projectId: "markitdone-27f82",
  storageBucket: "markitdone-27f82.firebasestorage.app",
  messagingSenderId: "136123472736",
  appId: "1:136123472736:web:78fb03853bbc97a9359c05",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export default app;