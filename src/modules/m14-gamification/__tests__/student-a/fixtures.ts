import type {
  ChallengeProgress,
  ConvertView,
  GamificationDashboard,
  LedgerEntry,
  TierGridItem,
  GamificationWallet,
} from '../../api'

export const TIERS: TierGridItem[] = [
  {
    key: 'bronze',
    labelMs: 'Gangsa',
    icon: '🥉',
    color: '#cd7f32',
    minSyiling: 0,
    conversionRate: 50,
    isMine: false,
  },
  {
    key: 'silver',
    labelMs: 'Perak',
    icon: '🥈',
    color: '#c0c0c0',
    minSyiling: 500,
    conversionRate: 40,
    isMine: false,
  },
  {
    key: 'gold',
    labelMs: 'Emas',
    icon: '🥇',
    color: '#ffd700',
    minSyiling: 2000,
    conversionRate: 30,
    isMine: false,
  },
  {
    key: 'platinum',
    labelMs: 'Platinum',
    icon: '💎',
    color: '#e5e4e2',
    minSyiling: 5000,
    conversionRate: 20,
    isMine: false,
  },
]

const tierView = (t: TierGridItem) => ({
  key: t.key,
  labelMs: t.labelMs,
  icon: t.icon,
  color: t.color,
  minSyiling: t.minSyiling,
  conversionRate: t.conversionRate,
})

export const wallet = (over: Partial<GamificationWallet> = {}): GamificationWallet => ({
  userId: 1,
  currentSyiling: 256,
  totalSyilingEarned: 256,
  tokenBalance: 0,
  xp: 8,
  level: 2,
  xpNeeded: 110,
  levelProgressPct: 7,
  tier: tierView(TIERS[0]!),
  nextTier: { ...tierView(TIERS[1]!), pct: 51.2, need: 244 },
  title: { name: 'Permulaan', emoji: '📚' },
  nextTitle: { name: 'Pelajar', emoji: '🎓', threshold: 300, need: 44 },
  earnedToday: 0,
  earnedThisWeek: 0,
  streak: { current: 1, best: 5, multiplier: 1 },
  ...over,
})

export const challenge = (
  id: number,
  over: Partial<ChallengeProgress> = {},
): ChallengeProgress => ({
  id,
  icon: '📝',
  title: `Cabaran ${id}`,
  description: `Keterangan ${id}`,
  difficulty: 'easy',
  rewardSyiling: 15,
  rewardXp: 10,
  target: 3,
  progress: 0,
  pct: 0,
  completed: false,
  ...over,
})

export const ledgerRow = (id: number, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  id,
  type: 'earn',
  amount: 25,
  balanceAfter: 256,
  source: 'daily_challenge',
  description: 'Cabaran selesai: Penjelajah Topik',
  createdAt: '2026-05-19T03:26:00+08:00',
  ...over,
})

export const dashboard = (over: Partial<GamificationDashboard> = {}): GamificationDashboard => ({
  wallet: wallet(),
  challenges: [1, 2, 3, 4, 5].map((i) => challenge(i)),
  recent: [1, 2, 3, 4, 5, 6, 7].map((i) => ledgerRow(i)),
  mastery: [
    {
      subjectId: 2,
      level: 2,
      subjectName: 'Bahasa Melayu',
      stage: 'Aktif',
      correct: 46,
      nextTarget: 50,
      accuracy: 48.94,
      multiplier: 1.05,
    },
    {
      subjectId: 1,
      level: 1,
      subjectName: 'Sejarah',
      stage: 'Mula Belajar',
      correct: 14,
      nextTarget: 25,
      accuracy: 35,
      multiplier: 1,
    },
  ],
  tiers: TIERS,
  ...over,
})

export const convertInfo = (over: Partial<ConvertView> = {}): ConvertView => ({
  currentSyiling: 256,
  tokenBalance: 0,
  rate: 50,
  tierLabel: 'Gangsa',
  quick: [50, 250, 256],
  tiers: TIERS.map((t) => ({ ...t, isMine: t.key === 'bronze' })),
  ...over,
})
