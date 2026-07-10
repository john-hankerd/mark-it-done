// MarkItDone v2.0 — Rewards Screen
import { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from '../../firebaseConfig';
import { showAlert } from '../../services/alert';
import { getAllTimePoints } from '../../services/pointsEngine';
import {
    Redemption,
    Reward,
    calcAvailablePoints,
    createReward,
    deleteReward,
    getTeamRedemptions,
    getTeamRewards,
    onRedemptionsChange,
    onRewardsChange,
    requestRedemption,
    resolveRedemption,
} from '../../services/rewardsService';
import { getUserProfile, getUserTeamId } from '../../services/teamService';

const ORANGE = '#FF6B35';

const REWARD_ICONS = [
  '🎁','🏖️','☕','🍕','🎮','🎬','💰','👟','🎧','📱',
  '🍦','🎂','🏋️','💆','🎵','📚','🧁','🍔','🎪','✈️',
];

export default function RewardsScreen() {
  const userId = auth.currentUser?.uid || '';

  const [isCoach, setIsCoach] = useState(false);
  const [userName, setUserName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [loading, setLoading] = useState(true);

  // Add reward modal (coach)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('🎁');
  const [newCost, setNewCost] = useState('25');

  // View toggle
  const [viewTab, setViewTab] = useState<'shop' | 'history'>('shop');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!teamId) return;
    const unsub1 = onRewardsChange(teamId, setRewards);
    const unsub2 = onRedemptionsChange(teamId, (r) => {
      setRedemptions(r);
      // Recalc available points when redemptions change
      const myRedemptions = r.filter(red => red.memberId === userId);
      setAvailablePoints(calcAvailablePoints(totalPoints, myRedemptions));
    });
    return () => { unsub1(); unsub2(); };
  }, [teamId, totalPoints]);

  const loadData = async () => {
    try {
      if (!userId) { setLoading(false); return; }

      const profile = await getUserProfile(userId);
      if (profile) {
        setIsCoach(profile.isCoach || false);
        setUserName(profile.name || '');
      }

      const tid = await getUserTeamId(userId);
      if (tid) {
        setTeamId(tid);
        const [rw, rd] = await Promise.all([
          getTeamRewards(tid),
          getTeamRedemptions(tid),
        ]);
        setRewards(rw);
        setRedemptions(rd);
      }

      const ap = await getAllTimePoints();
      setTotalPoints(ap);

      if (tid) {
        const rd = await getTeamRedemptions(tid);
        const myRedemptions = rd.filter(r => r.memberId === userId);
        setAvailablePoints(calcAvailablePoints(ap, myRedemptions));
      } else {
        setAvailablePoints(ap);
      }
    } catch (e) {
      console.log('Rewards load error:', e);
    }
    setLoading(false);
  };

  // ─── Coach: Add reward ───
  const handleAddReward = async () => {
    if (!newTitle.trim() || !teamId) return;
    const cost = parseInt(newCost) || 25;
    if (cost < 1) {
      showAlert('Invalid cost', 'Point cost must be at least 1.');
      return;
    }
    try {
      await createReward(teamId, userId, newTitle.trim(), newDesc.trim(), newIcon, cost);
      resetAddModal();
      showAlert('Reward Created!', `"${newTitle.trim()}" is now available.`);
    } catch (e) {
      showAlert('Error', 'Could not create reward.');
    }
  };

  const handleDeleteReward = (reward: Reward) => {
    showAlert('Delete Reward', `Remove "${reward.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteReward(teamId, reward.id);
          } catch (e) {
            showAlert('Error', 'Could not delete reward.');
          }
        },
      },
    ]);
  };

  const resetAddModal = () => {
    setNewTitle('');
    setNewDesc('');
    setNewIcon('🎁');
    setNewCost('25');
    setShowAddModal(false);
  };

  // ─── Member: Redeem reward ───
  const handleRedeem = (reward: Reward) => {
    if (availablePoints < reward.pointCost) {
      showAlert(
        'Not enough points',
        `You need ${reward.pointCost} pts but have ${availablePoints} available.`
      );
      return;
    }

    showAlert(
      'Redeem Reward',
      `Spend ${reward.pointCost} pts on "${reward.title}"?\n\nYour coach will be notified to approve.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            try {
              await requestRedemption(teamId, reward, userId, userName);
              setAvailablePoints(prev => prev - reward.pointCost);
              showAlert('Requested!', 'Your coach will review your redemption.');
            } catch (e) {
              showAlert('Error', 'Could not submit redemption.');
            }
          },
        },
      ]
    );
  };

  // ─── Coach: Approve/Deny ───
  const handleResolve = (redemption: Redemption, status: 'approved' | 'denied') => {
    const action = status === 'approved' ? 'Approve' : 'Deny';
    showAlert(
      `${action} Redemption`,
      `${action} "${redemption.rewardTitle}" for ${redemption.memberName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: status === 'denied' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await resolveRedemption(teamId, redemption.id, status);
            } catch (e) {
              showAlert('Error', 'Could not update redemption.');
            }
          },
        },
      ]
    );
  };

  // ─── Filter redemptions ───
  const pendingRedemptions = redemptions.filter(r => r.status === 'pending');
  const myRedemptions = redemptions.filter(r => r.memberId === userId);
  const resolvedRedemptions = isCoach
    ? redemptions.filter(r => r.status !== 'pending')
    : myRedemptions.filter(r => r.status !== 'pending');

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return { text: '⏳ Pending', color: '#f5a623' };
      case 'approved': return { text: '✅ Approved', color: '#4CAF50' };
      case 'denied': return { text: '❌ Denied', color: '#ff4444' };
      default: return { text: status, color: '#aaa' };
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rewards</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#aaa' }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!teamId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rewards</Text>
          <Text style={styles.headerSub}>Earn and redeem rewards</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎁</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 8 }}>
            Join a team first
          </Text>
          <Text style={{ fontSize: 14, color: '#aaa', textAlign: 'center' }}>
            Rewards are team-based. Join or create a team in the Team tab.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Rewards</Text>
            <Text style={styles.headerSub}>
              {isCoach ? 'Manage team rewards' : 'Earn & redeem'}
            </Text>
          </View>
          {isCoach && (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButtonText}>+ Reward</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Points display */}
        <View style={styles.pointsCard}>
          <View style={styles.pointsMain}>
            <Text style={styles.pointsVal}>{availablePoints}</Text>
            <Text style={styles.pointsLabel}>Available Points</Text>
          </View>
          <View style={styles.pointsDivider} />
          <View style={styles.pointsSide}>
            <Text style={styles.pointsSideVal}>{totalPoints}</Text>
            <Text style={styles.pointsSideLabel}>Total Earned</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.viewTabs}>
          <TouchableOpacity
            style={[styles.viewTab, viewTab === 'shop' && styles.viewTabActive]}
            onPress={() => setViewTab('shop')}
          >
            <Text style={[styles.viewTabText, viewTab === 'shop' && styles.viewTabTextActive]}>
              🎁 {isCoach ? 'Rewards' : 'Shop'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewTab, viewTab === 'history' && styles.viewTabActive]}
            onPress={() => setViewTab('history')}
          >
            <Text style={[styles.viewTabText, viewTab === 'history' && styles.viewTabTextActive]}>
              📜 History {pendingRedemptions.length > 0 ? `(${pendingRedemptions.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Shop / Rewards List ── */}
        {viewTab === 'shop' && (
          <>
            {rewards.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🎁</Text>
                <Text style={styles.emptyText}>
                  {isCoach
                    ? 'No rewards yet. Tap "+ Reward" to create one for your team.'
                    : 'No rewards available yet. Ask your coach to set some up!'}
                </Text>
              </View>
            ) : (
              rewards.map(reward => {
                const canAfford = availablePoints >= reward.pointCost;
                return (
                  <TouchableOpacity
                    key={reward.id}
                    style={styles.rewardCard}
                    onPress={() => !isCoach && handleRedeem(reward)}
                    onLongPress={() => isCoach && handleDeleteReward(reward)}
                    activeOpacity={isCoach ? 1 : 0.7}
                  >
                    <View style={styles.rewardIconWrap}>
                      <Text style={styles.rewardIcon}>{reward.icon}</Text>
                    </View>
                    <View style={styles.rewardInfo}>
                      <Text style={styles.rewardTitle}>{reward.title}</Text>
                      {reward.description ? (
                        <Text style={styles.rewardDesc}>{reward.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.rewardCostWrap}>
                      <View style={[
                        styles.rewardCostBadge,
                        !isCoach && canAfford && styles.rewardCostBadgeAfford,
                        !isCoach && !canAfford && styles.rewardCostBadgeCant,
                      ]}>
                        <Text style={[
                          styles.rewardCostText,
                          !isCoach && canAfford && styles.rewardCostTextAfford,
                          !isCoach && !canAfford && styles.rewardCostTextCant,
                        ]}>
                          {reward.pointCost} pts
                        </Text>
                      </View>
                      {!isCoach && (
                        <Text style={styles.rewardAction}>
                          {canAfford ? 'Redeem' : 'Need more'}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            {isCoach && rewards.length > 0 && (
              <Text style={styles.hintText}>Hold a reward to delete it</Text>
            )}
          </>
        )}

        {/* ── History / Redemptions ── */}
        {viewTab === 'history' && (
          <>
            {/* Pending (coach sees all, member sees own) */}
            {pendingRedemptions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  ⏳ Pending ({pendingRedemptions.length})
                </Text>
                {(isCoach ? pendingRedemptions : pendingRedemptions.filter(r => r.memberId === userId))
                  .map(r => (
                  <View key={r.id} style={styles.redemptionRow}>
                    <Text style={styles.redemptionIcon}>{r.rewardIcon}</Text>
                    <View style={styles.redemptionInfo}>
                      <Text style={styles.redemptionTitle}>{r.rewardTitle}</Text>
                      <Text style={styles.redemptionMeta}>
                        {isCoach ? `${r.memberName} · ` : ''}{r.pointCost} pts
                      </Text>
                    </View>
                    {isCoach ? (
                      <View style={styles.resolveRow}>
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() => handleResolve(r, 'approved')}
                        >
                          <Text style={styles.approveBtnText}>✓</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.denyBtn}
                          onPress={() => handleResolve(r, 'denied')}
                        >
                          <Text style={styles.denyBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: '#fff8e1' }]}>
                        <Text style={[styles.statusText, { color: '#f5a623' }]}>Pending</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Resolved */}
            {resolvedRedemptions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📜 Past Redemptions</Text>
                {resolvedRedemptions.map(r => {
                  const badge = statusBadge(r.status);
                  return (
                    <View key={r.id} style={styles.redemptionRow}>
                      <Text style={styles.redemptionIcon}>{r.rewardIcon}</Text>
                      <View style={styles.redemptionInfo}>
                        <Text style={styles.redemptionTitle}>{r.rewardTitle}</Text>
                        <Text style={styles.redemptionMeta}>
                          {isCoach ? `${r.memberName} · ` : ''}{r.pointCost} pts
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: badge.color + '20' }]}>
                        <Text style={[styles.statusText, { color: badge.color }]}>
                          {badge.text}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : pendingRedemptions.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>📜</Text>
                <Text style={styles.emptyText}>No redemptions yet.</Text>
              </View>
            ) : null}
          </>
        )}

      </ScrollView>

      {/* ── Add Reward Modal (Coach) ── */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={resetAddModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              <Text style={styles.modalTitle}>Create Reward</Text>
              <Text style={styles.modalSub}>Members can redeem this with their earned points.</Text>

              <TextInput
                style={styles.input}
                placeholder="Reward name (e.g. Free Coffee)"
                placeholderTextColor="#aaa"
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
              />

              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Description (optional)"
                placeholderTextColor="#aaa"
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              <Text style={styles.fieldLabel}>Point Cost</Text>
              <TextInput
                style={styles.input}
                value={newCost}
                onChangeText={setNewCost}
                keyboardType="number-pad"
                placeholder="e.g. 25"
                placeholderTextColor="#aaa"
              />
              <View style={styles.presetRow}>
                {[10, 25, 50, 75, 100].map(v => (
                  <TouchableOpacity
                    key={v}
                    style={[styles.presetBtn, newCost === String(v) && styles.presetBtnActive]}
                    onPress={() => setNewCost(String(v))}
                  >
                    <Text style={[styles.presetText, newCost === String(v) && styles.presetTextActive]}>
                      {v}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {REWARD_ICONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconBtn, newIcon === icon && styles.iconBtnSelected]}
                    onPress={() => setNewIcon(icon)}
                  >
                    <Text style={{ fontSize: 22 }}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Preview */}
              <View style={styles.previewCard}>
                <Text style={styles.previewLabel}>Preview</Text>
                <View style={styles.previewRow}>
                  <Text style={{ fontSize: 28 }}>{newIcon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewTitle}>{newTitle || 'Reward Name'}</Text>
                    {newDesc ? <Text style={styles.previewDesc}>{newDesc}</Text> : null}
                  </View>
                  <Text style={styles.previewCost}>{newCost || '0'} pts</Text>
                </View>
              </View>

              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={resetAddModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, !newTitle.trim() && styles.saveBtnDisabled]}
                  onPress={handleAddReward}
                >
                  <Text style={styles.saveBtnText}>Create Reward</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f5f2' },
  header: {
    backgroundColor: '#1a1a2e',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },
  addButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Points card
  pointsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  pointsMain: { flex: 2, alignItems: 'center' },
  pointsVal: { color: ORANGE, fontSize: 32, fontWeight: '800' },
  pointsLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 },
  pointsDivider: {
    width: 1, height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 12,
  },
  pointsSide: { flex: 1, alignItems: 'center' },
  pointsSideVal: { color: '#fff', fontSize: 18, fontWeight: '700' },
  pointsSideLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2 },

  // Tabs
  viewTabs: { flexDirection: 'row', gap: 8 },
  viewTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
  },
  viewTabActive: { backgroundColor: ORANGE },
  viewTabText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  viewTabTextActive: { color: '#fff' },

  scroll: { padding: 16, gap: 12, paddingBottom: 32 },

  // Reward cards
  rewardCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 0.5,
    borderColor: '#e8e4df',
  },
  rewardIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#fff0ea',
    alignItems: 'center', justifyContent: 'center',
  },
  rewardIcon: { fontSize: 24 },
  rewardInfo: { flex: 1 },
  rewardTitle: { fontSize: 15, fontWeight: '600', color: '#333' },
  rewardDesc: { fontSize: 12, color: '#aaa', marginTop: 2 },
  rewardCostWrap: { alignItems: 'flex-end' },
  rewardCostBadge: {
    backgroundColor: '#f7f5f2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rewardCostBadgeAfford: { backgroundColor: '#fff0ea' },
  rewardCostBadgeCant: { backgroundColor: '#f5f5f5' },
  rewardCostText: { fontSize: 13, fontWeight: '700', color: '#aaa' },
  rewardCostTextAfford: { color: ORANGE },
  rewardCostTextCant: { color: '#ccc' },
  rewardAction: { fontSize: 10, color: ORANGE, fontWeight: '600', marginTop: 3 },

  hintText: { color: '#ccc', fontSize: 11, textAlign: 'center' },

  // Section
  section: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    borderWidth: 0.5, borderColor: '#e8e4df', gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },

  // Redemption rows
  redemptionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.5, borderColor: '#f0ece8',
  },
  redemptionIcon: { fontSize: 20 },
  redemptionInfo: { flex: 1 },
  redemptionTitle: { fontSize: 14, fontWeight: '500', color: '#333' },
  redemptionMeta: { fontSize: 11, color: '#aaa', marginTop: 1 },

  resolveRow: { flexDirection: 'row', gap: 6 },
  approveBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  approveBtnText: { color: '#4CAF50', fontSize: 16, fontWeight: '700' },
  denyBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#FFEBEE',
    alignItems: 'center', justifyContent: 'center',
  },
  denyBtnText: { color: '#ff4444', fontSize: 16, fontWeight: '700' },

  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: '600' },

  // Empty
  emptyBox: { alignItems: 'center', marginTop: 40, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', maxWidth: 250 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24,
    maxHeight: '90%', borderTopWidth: 0.5, borderColor: '#e8e4df',
  },
  modalTitle: { color: '#1a1a2e', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: '#aaa', fontSize: 13, marginBottom: 16 },
  input: {
    backgroundColor: '#f7f5f2', borderRadius: 12,
    padding: 14, color: '#1a1a2e', fontSize: 15,
    marginBottom: 12, borderWidth: 0.5, borderColor: '#e8e4df',
  },
  fieldLabel: {
    color: '#aaa', fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 8, fontWeight: '600',
  },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  presetBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#f7f5f2', alignItems: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  presetBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  presetText: { fontSize: 13, fontWeight: '700', color: '#aaa' },
  presetTextActive: { color: '#fff' },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#f7f5f2', alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#e8e4df',
  },
  iconBtnSelected: { borderColor: ORANGE, backgroundColor: '#fff0ea' },

  // Preview
  previewCard: {
    backgroundColor: '#f7f5f2', borderRadius: 14,
    padding: 14, marginBottom: 16,
  },
  previewLabel: {
    fontSize: 10, fontWeight: '600', color: '#aaa',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewTitle: { fontSize: 14, fontWeight: '600', color: '#333' },
  previewDesc: { fontSize: 11, color: '#aaa', marginTop: 1 },
  previewCost: { fontSize: 14, fontWeight: '800', color: ORANGE },

  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: '#f7f5f2', alignItems: 'center',
  },
  cancelBtnText: { color: '#aaa', fontWeight: '600' },
  saveBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: ORANGE, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});