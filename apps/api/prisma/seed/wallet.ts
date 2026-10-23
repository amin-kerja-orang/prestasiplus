/**
 * Wallet seed (BE-11, M14 core): the demo wallets, ledgers and streaks of the demo
 * accounts that have wallet data in the frontend mock. Demo kind: refused in production unless
 * ALLOW_DEMO_SEED (the demo gate, as BE-07 and BE-25). Fictitious data only.
 *
 * Source of every value: the mock (`src/modules/m14-gamification/mock/data/{catalogue,designed}.ts` and the
 * designed replay `seeds/replay.ts`, SRS M14 section 6.11). Nothing is invented and no total is tuned.
 *
 *   mock account 1  admin@demo.test         observed wallet (256), 14 observed ledger rows, observed streak 1 / 5
 *   mock account 2  pelajar@demo.test       replay of the designed sessions P1-P4 (370 syiling, 916 XP)
 *   mock account 3  pelajar2@demo.test      empty state: no wallet, no streak (BR-M14-02 defaults)
 *   mock account 4  pelajarmaju@demo.test   replay of the designed sessions M1-M4 (267 syiling, 432 XP, level 3)
 *
 * Differences from the mock rows (each is a row of docs/architecture/v2-backend-deviations.md):
 *  - ids are new (identity columns); `source_id` is the mock `refId`, except that a daily-challenge reference
 *    gets the Malaysia day appended (`challenge:5:2026-09-22`) because the mock reuses `challenge:5` on
 *    several days and the idempotency key must be unique per user, source and source id;
 *  - `total_days` of the designed streaks is 0, as SRS M14 section 6.11.7 fixes (the replay counts 3);
 *  - session_credits are not seeded: they need practice sessions (BE-12).
 *
 * The tier catalogue is also REFERENCE data (`core/wallet-tiers.ts`, P11-B1), which runs earlier in every environment;
 * the tier upsert below, by the same key, is then a no-op in a demo run and keeps this seed working when run alone.
 *
 * Idempotent: tiers are upserted by `tier_name` and an existing tier is left as it is; a user that already has
 * a wallet row (seeded earlier, or loaded by the migration) is left untouched, so a re-run never doubles a
 * ledger. `legacy_*` is never set.
 */
import { assertSeedAllowed } from './guard'
import type { SeedModule } from './index'

/** Tiers 1-4 of the mock (DATA-M14-03, discovery 2.2), all active. */
export const WALLET_TIERS = [
  { tierName: 'bronze', labelMs: 'Gangsa', icon: '🥉', color: '#cd7f32', minSyiling: 0, conversionRate: 50, sortOrder: 1, perks: ['Akses asas hadiah', 'Ganjaran kuiz standard', 'Profil asas'] },
  {
    tierName: 'silver',
    labelMs: 'Perak',
    icon: '🥈',
    color: '#c0c0c0',
    minSyiling: 500,
    conversionRate: 40,
    sortOrder: 2,
    perks: ['Kadar penukaran lebih baik', 'Akses hadiah premium', 'Profil enhanced', 'Cabaran eksklusif'],
  },
  {
    tierName: 'gold',
    labelMs: 'Emas',
    icon: '🥇',
    color: '#ffd700',
    minSyiling: 2000,
    conversionRate: 30,
    sortOrder: 3,
    perks: ['Kadar penukaran terbaik', 'Hadiah eksklusif Gold', 'Analitik lanjutan', 'Tema profil khas', 'Keistimewaan pertandingan'],
  },
  {
    tierName: 'platinum',
    labelMs: 'Platinum',
    icon: '💎',
    color: '#e5e4e2',
    minSyiling: 5000,
    conversionRate: 20,
    sortOrder: 4,
    perks: [
      'Kadar penukaran terbaik sekali',
      'Hadiah eksklusif Platinum',
      'Dashboard analitik penuh',
      'Ciri profil premium',
      'Akses VIP pertandingan',
      'Preview ciri baru',
    ],
  },
] as const

/** Reward rates shared by the four seeded tiers (mock `rewards` and `games`). */
export const TIER_REWARDS = {
  quizRewardL1: 1,
  quizRewardL2: 2,
  quizRewardL3: 3,
  quizRewardL4: 4,
  quizRewardL5: 5,
  pkskRewardCorrect: 5,
  boardGameRewardCorrect: 5,
  boardGameRewardWin: 25,
} as const

/** `[at, source, amount, description, sourceId]`, oldest first. Every row is an `earn`. */
type SeedRow = readonly [at: string, source: string, amount: number, description: string, sourceId: string | null]

export interface DemoWallet {
  email: string
  tierName: string
  createdAt: string
  tokenBalance: number
  xp: number
  level: number
  streak: { current: number; best: number; lastActivityDate: string; totalDays: number }
  ledger: readonly SeedRow[]
}

export const DEMO_WALLETS: readonly DemoWallet[] = [
  {
    // Mock account 1 (admin): wallet and streak observed on live (SRS M14 6.11.2).
    email: 'admin@demo.test',
    tierName: 'bronze',
    createdAt: '2026-02-11T05:23:00+08:00',
    tokenBalance: 0,
    xp: 8,
    level: 2,
    streak: { current: 1, best: 5, lastActivityDate: '2026-05-19', totalDays: 0 },
    ledger: [
      ['2026-02-11T05:23:00+08:00', 'legacy', 4, 'Cabaran Kilat: 3 betul, combo 2x', null],
      ['2026-02-19T21:47:00+08:00', 'legacy', 4, 'Betul/Salah: 3 betul, streak 2', null],
      ['2026-02-19T23:12:00+08:00', 'legacy', 35, 'One-time sync: transfer missing coins from legacy student_coins table', null],
      ['2026-05-11T14:22:00+08:00', 'quiz_spm', 42, 'Latih Tubi SPM: 14 betul — 35%', null],
      ['2026-05-11T14:22:00+08:00', 'spm', 7, 'Streak activity (spm)', null],
      ['2026-05-11T14:22:00+08:00', 'daily_challenge', 10, 'Cabaran selesai: Mula Hari Ini', null],
      ['2026-05-11T14:22:00+08:00', 'daily_challenge', 30, 'Cabaran selesai: Kilat Matematik', null],
      ['2026-05-11T14:22:00+08:00', 'daily_challenge', 12, 'Cabaran selesai: Jawab 5 Betul', null],
      ['2026-05-11T14:27:00+08:00', 'quiz_spm', 22, 'Latih Tubi SPM: 11 betul — 32.35%', null],
      ['2026-05-11T14:27:00+08:00', 'daily_challenge', 15, 'Cabaran selesai: Rajin Berlatih', null],
      ['2026-05-11T14:27:00+08:00', 'daily_challenge', 40, 'Cabaran selesai: Cabaran Kilat', null],
      ['2026-05-19T03:26:00+08:00', 'quiz_spm', 3, 'SPM Tahun Lepas: 1 betul — 20%', null],
      ['2026-05-19T03:26:00+08:00', 'spm', 7, 'Streak activity (spm)', null],
      ['2026-05-19T03:26:00+08:00', 'daily_challenge', 25, 'Cabaran selesai: Penjelajah Topik', null],
    ],
  },
  {
    // Mock account 2: designed sessions P1-P4 replayed through the M14 engine (SRS M14 6.11.3).
    email: 'pelajar@demo.test',
    tierName: 'bronze',
    createdAt: '2026-09-22T19:00:00+08:00',
    tokenBalance: 0,
    xp: 916,
    level: 1,
    streak: { current: 2, best: 2, lastActivityDate: '2026-09-25', totalDays: 0 },
    ledger: [
      ['2026-09-22T19:00:00+08:00', 'quiz_spm', 4, 'SPM Tahun Lepas: 4 betul — 40%', 'P1'],
      ['2026-09-22T19:00:00+08:00', 'spm', 7, 'Streak activity (spm)', null],
      ['2026-09-22T19:00:00+08:00', 'daily_challenge', 10, 'Cabaran selesai: Mula Hari Ini', 'challenge:5:2026-09-22'],
      ['2026-09-24T20:15:00+08:00', 'quiz_spm', 26, 'Latih Tubi SPM: 26 betul — 76.47%', 'P2'],
      ['2026-09-24T20:15:00+08:00', 'spm', 7, 'Streak activity (spm)', null],
      ['2026-09-24T20:15:00+08:00', 'daily_challenge', 30, 'Cabaran selesai: Kilat Matematik', 'challenge:4:2026-09-24'],
      ['2026-09-24T20:15:00+08:00', 'daily_challenge', 10, 'Cabaran selesai: Mula Hari Ini', 'challenge:5:2026-09-24'],
      ['2026-09-24T20:15:00+08:00', 'daily_challenge', 12, 'Cabaran selesai: Jawab 5 Betul', 'challenge:6:2026-09-24'],
      ['2026-09-24T20:15:00+08:00', 'daily_challenge', 40, 'Cabaran selesai: Cabaran Kilat', 'challenge:10:2026-09-24'],
      ['2026-09-24T20:40:00+08:00', 'quiz_spm', 6, 'SPM Tahun Lepas: 6 betul — 60%', 'P3'],
      ['2026-09-24T20:40:00+08:00', 'daily_challenge', 20, 'Cabaran selesai: Latihan 10 Minit', 'challenge:7:2026-09-24'],
      ['2026-09-25T08:30:00+08:00', 'quiz_spm', 34, 'Ramalan SPM: 34 betul — 85%', 'P4'],
      ['2026-09-25T08:30:00+08:00', 'spm', 7, 'Streak activity (spm)', null],
      ['2026-09-25T08:30:00+08:00', 'daily_challenge', 20, 'Cabaran selesai: Si Tepat', 'challenge:2:2026-09-25'],
      ['2026-09-25T08:30:00+08:00', 'daily_challenge', 30, 'Cabaran selesai: Kilat Matematik', 'challenge:4:2026-09-25'],
      ['2026-09-25T08:30:00+08:00', 'daily_challenge', 10, 'Cabaran selesai: Mula Hari Ini', 'challenge:5:2026-09-25'],
      ['2026-09-25T08:30:00+08:00', 'daily_challenge', 12, 'Cabaran selesai: Jawab 5 Betul', 'challenge:6:2026-09-25'],
      ['2026-09-25T08:30:00+08:00', 'daily_challenge', 20, 'Cabaran selesai: Latihan 10 Minit', 'challenge:7:2026-09-25'],
      ['2026-09-25T08:30:00+08:00', 'daily_challenge', 25, 'Cabaran selesai: Kombo 2 Hari', 'challenge:8:2026-09-25'],
      ['2026-09-25T08:30:00+08:00', 'daily_challenge', 40, 'Cabaran selesai: Cabaran Kilat', 'challenge:10:2026-09-25'],
    ],
  },
  {
    // Mock account 4: designed sessions M1-M4 replayed through the M14 engine (SRS M14 6.11.3).
    email: 'pelajarmaju@demo.test',
    tierName: 'bronze',
    createdAt: '2026-09-23T16:10:00+08:00',
    tokenBalance: 0,
    xp: 432,
    level: 3,
    streak: { current: 3, best: 3, lastActivityDate: '2026-09-25', totalDays: 0 },
    ledger: [
      ['2026-09-23T16:10:00+08:00', 'quiz_practice', 8, 'Latih Tubi: 8 betul — 80%', 'M1'],
      ['2026-09-23T16:10:00+08:00', 'daily_challenge', 20, 'Cabaran selesai: Si Tepat', 'challenge:2:2026-09-23'],
      ['2026-09-23T16:10:00+08:00', 'daily_challenge', 10, 'Cabaran selesai: Mula Hari Ini', 'challenge:5:2026-09-23'],
      ['2026-09-23T16:10:00+08:00', 'daily_challenge', 12, 'Cabaran selesai: Jawab 5 Betul', 'challenge:6:2026-09-23'],
      ['2026-09-23T16:10:00+08:00', 'achievement', 5, 'Pencapaian: Langkah Pertama', 'achievement:1'],
      ['2026-09-24T17:05:00+08:00', 'quiz_practice', 9, 'Latih Tubi: 9 betul — 90%', 'M2'],
      ['2026-09-24T17:05:00+08:00', 'daily_challenge', 20, 'Cabaran selesai: Si Tepat', 'challenge:2:2026-09-24'],
      ['2026-09-24T17:05:00+08:00', 'daily_challenge', 10, 'Cabaran selesai: Mula Hari Ini', 'challenge:5:2026-09-24'],
      ['2026-09-24T17:05:00+08:00', 'daily_challenge', 12, 'Cabaran selesai: Jawab 5 Betul', 'challenge:6:2026-09-24'],
      ['2026-09-24T17:05:00+08:00', 'daily_challenge', 25, 'Cabaran selesai: Kombo 2 Hari', 'challenge:8:2026-09-24'],
      ['2026-09-24T17:05:00+08:00', 'daily_challenge', 35, 'Cabaran selesai: Ketepatan 90%', 'challenge:9:2026-09-24'],
      ['2026-09-24T17:05:00+08:00', 'achievement', 10, 'Pencapaian: Pengumpul Syiling', 'achievement:5'],
      ['2026-09-25T09:15:00+08:00', 'quiz_practice', 6, 'Latih Tubi: 6 betul — 60%', 'M3'],
      ['2026-09-25T09:15:00+08:00', 'daily_challenge', 10, 'Cabaran selesai: Mula Hari Ini', 'challenge:5:2026-09-25'],
      ['2026-09-25T09:15:00+08:00', 'daily_challenge', 12, 'Cabaran selesai: Jawab 5 Betul', 'challenge:6:2026-09-25'],
      ['2026-09-25T09:15:00+08:00', 'daily_challenge', 25, 'Cabaran selesai: Kombo 2 Hari', 'challenge:8:2026-09-25'],
      ['2026-09-25T09:15:00+08:00', 'achievement', 10, 'Pencapaian: Streak 3 Hari', 'achievement:3'],
      ['2026-09-25T10:00:00+08:00', 'quiz_practice', 3, 'Latih Tubi: 3 betul — 42.86%', 'M4'],
      ['2026-09-25T10:00:00+08:00', 'daily_challenge', 25, 'Cabaran selesai: Penjelajah Topik', 'challenge:3:2026-09-25'],
    ],
  },
]

export const walletSeed: SeedModule = {
  name: 'wallet',
  kind: 'demo',
  async run(ctx) {
    // Defence in depth: the runner already refuses demo modules in production without the flag.
    assertSeedAllowed()
    const { prisma } = ctx
    const seededAt = ctx.clock.now()

    const tierIds = new Map<string, bigint>()
    for (const t of WALLET_TIERS) {
      const row = await prisma.tier.upsert({
        where: { tierName: t.tierName },
        create: { ...t, perks: [...t.perks], ...TIER_REWARDS, isActive: true, createdAt: seededAt, updatedAt: seededAt },
        update: {},
      })
      tierIds.set(t.tierName, row.id)
    }

    for (const w of DEMO_WALLETS) {
      const user = await prisma.user.findFirst({ where: { email: { equals: w.email, mode: 'insensitive' } } })
      if (!user) continue // the account comes from the identity seed; without it there is nothing to attach to
      const tierId = tierIds.get(w.tierName)
      if (tierId === undefined) throw new Error(`Wallet seed: unknown tier ${w.tierName}.`)
      await prisma.$transaction(async (tx) => {
        if (await tx.wallet.findUnique({ where: { userId: user.id } })) return
        const created = new Date(w.createdAt)
        let balance = 0
        let lastAt = created
        for (const [at, source, amount, description, sourceId] of w.ledger) {
          balance += amount
          lastAt = new Date(at)
          await tx.coinLedger.create({
            data: { userId: user.id, type: 'earn', source, sourceId, amount, balanceAfter: balance, description, createdAt: lastAt },
          })
        }
        await tx.wallet.create({
          data: {
            userId: user.id,
            tierId,
            currentSyiling: balance,
            totalSyilingEarned: balance,
            tokenBalance: w.tokenBalance,
            xp: w.xp,
            level: w.level,
            createdAt: created,
            updatedAt: lastAt,
          },
        })
        await tx.streak.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            current: w.streak.current,
            best: w.streak.best,
            lastActivityDate: new Date(`${w.streak.lastActivityDate}T00:00:00Z`),
            totalDays: w.streak.totalDays,
            createdAt: created,
            updatedAt: lastAt,
          },
          update: {},
        })
      })
    }
  },
}
