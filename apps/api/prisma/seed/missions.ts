/**
 * Global Misi Harian seed (S6-T07, DM-75): the 15 platform missions observed on the V2 teacher page (PRD 20 R1-GUR-2b
 * "Observed examples": title, target and reward exactly as listed). They are rows with `scope = 'global'` and no owner or
 * subject (migration 0205), shown to every teacher with the "Global" badge; there is no admin screen for them (D115).
 *
 * Idempotent (found by title among the global rows, partial unique index `uq_missions_global_title`; an existing row is left
 * as it is), deterministic (the mission date is the Malaysia day of the fixed seed clock) and free of personal data; `legacy_*`
 * is never set. Reference data (`kind: 'reference'`, PRD 20 R1-GUR-2b, issue #483): it loads in every environment including
 * production, is listed to teachers only and is never served to pupils. Runs after the classes seed and before gamification (see the ORDER NOTE in `./index.ts`).
 */
import { mytDay } from '../../src/db/clock'
import type { SeedModule } from './index'

export interface GlobalMissionSeed {
  title: string
  /** `question_count`: the target, 1..1000. */
  target: number
  /** `reward_coins`: 0..100 for a teacher row; a Global row may exceed it ("Kombo 10" is +120 on V2; migration 0205 allows it). */
  reward: number
}

export const GLOBAL_MISSIONS: readonly GlobalMissionSeed[] = [
  { title: 'Rajin Berlatih', target: 3, reward: 15 },
  { title: 'Si Tepat', target: 80, reward: 20 },
  { title: 'Penjelajah Topik', target: 3, reward: 25 },
  { title: 'Kilat Matematik', target: 10, reward: 30 },
  { title: 'Mula Hari Ini', target: 1, reward: 10 },
  { title: 'Jawab 5 Betul', target: 5, reward: 12 },
  { title: 'Latihan 10 Minit', target: 10, reward: 20 },
  { title: 'Kombo 2 Hari', target: 2, reward: 25 },
  { title: 'Ketepatan 90%', target: 90, reward: 35 },
  { title: 'Cabaran Kilat', target: 20, reward: 40 },
  { title: 'Selesai 5 Kuiz', target: 5, reward: 50 },
  { title: 'Ketepatan 80%', target: 80, reward: 80 },
  { title: '3 Topik Berbeza', target: 3, reward: 60 },
  { title: 'Kombo 10', target: 10, reward: 120 },
  { title: 'Belajar 15 Minit', target: 15, reward: 40 },
]

export const missionsSeed: SeedModule = {
  name: 'missions-global',
  kind: 'reference',
  async run(ctx) {
    const { prisma } = ctx
    const now = ctx.clock.now()
    const missionDate = new Date(`${mytDay(now)}T00:00:00.000Z`)
    for (const m of GLOBAL_MISSIONS) {
      const found = await prisma.mission.findFirst({ where: { scope: 'global', title: m.title }, select: { id: true } })
      if (found) continue
      await prisma.mission.create({
        data: {
          scope: 'global',
          teacherId: null,
          subjectId: null,
          title: m.title,
          description: null,
          missionType: 'harian',
          missionDate,
          questionCount: m.target,
          rewardCoins: m.reward,
          createdAt: now,
          updatedAt: now,
        },
      })
    }
  },
}
