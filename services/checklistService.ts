// MarkItDone v2.0 — Checklists Service (local storage)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChecklistTemplate } from '../types/checklist';

const CHECKLISTS_KEY = '@markitdone_checklists';

export async function getChecklists(): Promise<ChecklistTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(CHECKLISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveChecklists(checklists: ChecklistTemplate[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CHECKLISTS_KEY, JSON.stringify(checklists));
  } catch (e) {
    console.log('Checklists save error:', e);
  }
}
