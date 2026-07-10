// MarkItDone v2.0 — Team Service (Firestore)
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Task } from '../types/task';

export interface Team {
  id: string;
  name: string;
  coachId: string;
  coachName: string;
  joinCode: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  joinedAt: string;
}

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createTeam(
  coachId: string,
  coachName: string,
  teamName: string
): Promise<Team> {
  const joinCode = generateCode();
  const teamData = {
    name: teamName,
    coachId,
    coachName,
    joinCode,
    createdAt: new Date().toISOString(),
  };
  const docRef = await addDoc(collection(db, 'teams'), teamData);

  await setDoc(doc(db, 'teams', docRef.id, 'members', coachId), {
    userId: coachId,
    name: coachName,
    role: 'coach',
    joinedAt: new Date().toISOString(),
  });

  return { id: docRef.id, ...teamData };
}

export async function joinTeam(
  joinCode: string,
  userId: string,
  userName: string
): Promise<Team | null> {
  const q = query(collection(db, 'teams'), where('joinCode', '==', joinCode));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  const teamDoc = snap.docs[0];
  const teamData = teamDoc.data();

  const memberDoc = await getDoc(doc(db, 'teams', teamDoc.id, 'members', userId));
  if (memberDoc.exists()) {
    return { id: teamDoc.id, ...teamData } as Team;
  }

  await setDoc(doc(db, 'teams', teamDoc.id, 'members', userId), {
    userId,
    name: userName,
    role: 'member',
    joinedAt: new Date().toISOString(),
  });

  return { id: teamDoc.id, ...teamData } as Team;
}

export async function getUserTeams(userId: string): Promise<Team[]> {
  const teams: Team[] = [];
  const coachQuery = query(collection(db, 'teams'), where('coachId', '==', userId));
  const coachSnap = await getDocs(coachQuery);
  coachSnap.forEach(d => {
    teams.push({ id: d.id, ...d.data() } as Team);
  });
  return teams;
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const snap = await getDocs(collection(db, 'teams', teamId, 'members'));
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
  })) as TeamMember[];
}

export async function saveTeamTask(teamId: string, task: Task): Promise<void> {
  await setDoc(doc(db, 'teams', teamId, 'tasks', task.id), {
    ...task,
    teamId,
    teamDefault: true,
  });
}

export async function removeTeamTask(teamId: string, taskId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'tasks', taskId));
}

export async function getTeamTasks(teamId: string): Promise<Task[]> {
  const snap = await getDocs(collection(db, 'teams', teamId, 'tasks'));
  return snap.docs.map(d => d.data() as Task);
}

export function onTeamTasksChange(
  teamId: string,
  callback: (tasks: Task[]) => void
): () => void {
  return onSnapshot(collection(db, 'teams', teamId, 'tasks'), (snap) => {
    const tasks = snap.docs.map(d => d.data() as Task);
    callback(tasks);
  });
}

export async function saveMemberCompletion(
  teamId: string,
  memberId: string,
  taskId: string,
  date: string,
  pointsEarned: number
): Promise<void> {
  const completionId = `${memberId}-${taskId}-${date}`;
  await setDoc(doc(db, 'teams', teamId, 'completions', completionId), {
    memberId,
    taskId,
    date,
    pointsEarned,
    completedAt: new Date().toISOString(),
  });
}

export async function getTeamCompletions(teamId: string): Promise<any[]> {
  const snap = await getDocs(collection(db, 'teams', teamId, 'completions'));
  return snap.docs.map(d => d.data());
}

export async function saveUserTeamId(userId: string, teamId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    teamId,
  });
}

export async function getUserTeamId(userId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return snap.data()?.teamId || null;
}

export async function getUserProfile(userId: string): Promise<any> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function setUserIsCoach(userId: string, isCoach: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    isCoach,
  });
}