/**
 * Global Misi Harian seed (S6-T07, DM-75): the 15 platform missions observed on the V2 teacher page (PRD 20 R1-GUR-2b
 * "Observed examples": title, target and reward exactly as listed, the description is the V2 goal text). They are rows with
 * `scope = 'global'`, no owner and no subject (migration 0205), shown to every teacher with the "Global" badge; there is no admin
 * screen for them (D115). Each is an achievement goal with a `goal_kind` measured from the pupil's practice activity on the mission
 * date (PO decision on #483), see the kind mapping in GLOBAL_MISSIONS. Descriptions of "Kombo 10" and "Belajar 15 Minit" are inferred
 * from the pattern of their sibling rows (same wording, other number); the other 13 are as observed.
 *
 * Idempotent (found by title among the global rows, partial unique index `uq_missions_global_title`; an existing row is left
 * as it is), deterministic (the mission date is the Malaysia day of the fixed seed clock) and free of personal data; `legacy_*`
 * is never set. Reference data (`kind: 'reference'`, PRD 20 R1-GUR-2b, issue #483): it loads in every environment including
 * production, is listed to teachers and, as today's goals, served to every pupil. Runs after the classes seed and before gamification (see the ORDER NOTE in `./index.ts`).
 */
import type { MissionGoalKind } from '@pp/contract'

import { mytDay } from '../../src/db/clock'
import type { SeedModule } from './index'

export interface GlobalMissionSeed {
  title: string
  /** `description`: the V2 goal text. */
  description: string
  /** How the goal is measured from the pupil's practice activity (PO decision on #483). */
  goalKind: MissionGoalKind
  /** `question_count`: the target, 1..1000. */
  target: number
  /** `reward_coins`: 0..100 for a teacher row; a Global row may exceed it ("Kombo 10" is +120 on V2; migration 0205 allows it). */
  reward: number
}

export const GLOBAL_MISSIONS: readonly GlobalMissionSeed[] = [
  { title: 'Rajin Berlatih', description: 'Selesaikan 3 kuiz hari ini', goalKind: 'sessions_per_day', target: 3, reward: 15 },
  { title: 'Si Tepat', description: 'Dapat 80% ketepatan dalam mana-mana kuiz', goalKind: 'accuracy_in_session', target: 80, reward: 20 },
  { title: 'Penjelajah Topik', description: 'Latih 3 topik berbeza hari ini', goalKind: 'topics_per_day', target: 3, reward: 25 },
  { title: 'Kilat Matematik', description: 'Jawab 10 soalan dengan betul', goalKind: 'correct_per_day', target: 10, reward: 30 },
  { title: 'Mula Hari Ini', description: 'Selesaikan 1 sesi latihan hari ini', goalKind: 'sessions_per_day', target: 1, reward: 10 },
  { title: 'Jawab 5 Betul', description: 'Jawab 5 soalan dengan betul', goalKind: 'correct_per_day', target: 5, reward: 12 },
  { title: 'Latihan 10 Minit', description: 'Berlatih sekurang-kurangnya 10 minit hari ini', goalKind: 'minutes_per_day', target: 10, reward: 20 },
  { title: 'Kombo 2 Hari', description: 'Kekalkan kombo latihan selama 2 hari berturut-turut', goalKind: 'streak_days', target: 2, reward: 25 },
  { title: 'Ketepatan 90%', description: 'Capai ketepatan 90% dalam sesi latihan', goalKind: 'accuracy_in_session', target: 90, reward: 35 },
  { title: 'Cabaran Kilat', description: 'Jawab 20 soalan betul dalam satu sesi', goalKind: 'correct_in_session', target: 20, reward: 40 },
  { title: 'Selesai 5 Kuiz', description: 'Lengkapkan 5 kuiz hari ini', goalKind: 'sessions_per_day', target: 5, reward: 50 },
  { title: 'Ketepatan 80%', description: 'Capai ketepatan 80% dalam latihan', goalKind: 'accuracy_in_session', target: 80, reward: 80 },
  { title: '3 Topik Berbeza', description: 'Cuba 3 topik berlainan', goalKind: 'topics_per_day', target: 3, reward: 60 },
  { title: 'Kombo 10', description: 'Kekalkan kombo latihan selama 10 hari berturut-turut', goalKind: 'streak_days', target: 10, reward: 120 },
  { title: 'Belajar 15 Minit', description: 'Berlatih sekurang-kurangnya 15 minit hari ini', goalKind: 'minutes_per_day', target: 15, reward: 40 },
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
          description: m.description,
          goalKind: m.goalKind,
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
