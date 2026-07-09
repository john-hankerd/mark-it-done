// MarkItDone v2.0 — Rewards Service
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    updateDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Reward {
  id: string;
  title: string;
  description: string;
  icon: string;
  pointCost: number;
  createdBy: string;
  teamId: string;
  createdAt: string;
}

export interface Redemption {
  id: string;
  rewardId: string;
  rewardTitle: string;
  rewardIcon: string;
  pointCost: number;
  memberId: string;
  memberName: string;
  teamId: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
  resolvedAt?: string;
}

// ─── Coach: Create a reward ───
export async function createReward(
  teamId: string,
  coachId: string,
  title: string,
  description: string,
  icon: string,
  pointCost: number
): Promise<Reward> {
  const rewardData = {
    title,
    description,
    icon,
    pointCost,
    createdBy: coachId,
    teamId,
    createdAt: new Date().toISOString(),
  };
  const docRef = await addDoc(collection(db, 'teams', teamId, 'rewards'), rewardData);
  return { id: docRef.id, ...rewardData };
}

// ─── Coach: Delete a reward ───
export async function deleteReward(teamId: string, rewardId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'rewards', rewardId));
}

// ─── Get all rewards for a team ───
export async function getTeamRewards(teamId: string): Promise<Reward[]> {
  const snap = await getDocs(collection(db, 'teams', teamId, 'rewards'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Reward));
}

// ─── Listen to rewards (real-time) ───
export function onRewardsChange(
  teamId: string,
  callback: (rewards: Reward[]) => void
): () => void {
  return onSnapshot(collection(db, 'teams', teamId, 'rewards'), (snap) => {
    const rewards = snap.docs.map(d => ({ id: d.id, ...d.data() } as Reward));
    callback(rewards);
  });
}

// ─── Member: Request redemption ───
export async function requestRedemption(
  teamId: string,
  reward: Reward,
  memberId: string,
  memberName: string
): Promise<Redemption> {
  const data = {
    rewardId: reward.id,
    rewardTitle: reward.title,
    rewardIcon: reward.icon,
    pointCost: reward.pointCost,
    memberId,
    memberName,
    teamId,
    status: 'pending' as const,
    requestedAt: new Date().toISOString(),
  };
  const docRef = await addDoc(collection(db, 'teams', teamId, 'redemptions'), data);
  return { id: docRef.id, ...data };
}

// ─── Get redemptions ───
export async function getTeamRedemptions(teamId: string): Promise<Redemption[]> {
  const snap = await getDocs(collection(db, 'teams', teamId, 'redemptions'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Redemption))
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

// ─── Get member's redemptions ───
export async function getMemberRedemptions(
  teamId: string,
  memberId: string
): Promise<Redemption[]> {
  const all = await getTeamRedemptions(teamId);
  return all.filter(r => r.memberId === memberId);
}

// ─── Coach: Approve or deny a redemption ───
export async function resolveRedemption(
  teamId: string,
  redemptionId: string,
  status: 'approved' | 'denied'
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'redemptions', redemptionId), {
    status,
    resolvedAt: new Date().toISOString(),
  });
}

// ─── Listen to redemptions (real-time) ───
export function onRedemptionsChange(
  teamId: string,
  callback: (redemptions: Redemption[]) => void
): () => void {
  return onSnapshot(collection(db, 'teams', teamId, 'redemptions'), (snap) => {
    const redemptions = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Redemption))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    callback(redemptions);
  });
}

// ─── Calculate member's available points (earned minus spent on approved) ───
export function calcAvailablePoints(
  totalEarned: number,
  redemptions: Redemption[]
): number {
  const spent = redemptions
    .filter(r => r.status === 'approved' || r.status === 'pending')
    .reduce((sum, r) => sum + r.pointCost, 0);
  return Math.max(0, totalEarned - spent);
}