import { Inject, Injectable } from '@nestjs/common'
import { MISSION_TYPE_LABELS, type MissionToday } from '@pp/contract'

import { CLOCK, type Clock, mytDay } from '../../../db/clock'
import { PracticeRepository } from '../../practice'
import type { ClassActor } from '../actor'
import { ClassesRepository } from '../classes.repository'
import { MissionsRepository } from './missions.repository'

/** `GET /missions/today` (M05 #21): the missions of today for the caller, with the caller's status. */
@Injectable()
export class MissionsService {
  constructor(
    @Inject(MissionsRepository) private readonly repo: MissionsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The M10 missions whose mission date is today (Malaysia day) and whose stored recipients include the caller,
   * oldest first. Status (Q-SESS-LINK) comes from the caller's sessions linked by `missionId`: a completed
   * session beats an in-progress one, none gives `new`.
   */
  async today(actor: ClassActor): Promise<MissionToday[]> {
    const missions = await this.repo.missionsForStudent(actor.userId, mytDay(this.clock.now()), actor.isTest)
    if (missions.length === 0) return []
    const subjects = await this.classes.subjectNames(missions.map((m) => m.subjectId))
    const out: MissionToday[] = []
    for (const m of missions) {
      const sessions = (await this.practice.linkedSessions(actor.userId, 'missionId', m.id)).filter((s) => s.isTest === actor.isTest)
      const status = sessions.some((s) => s.status === 'completed') ? 'completed' : sessions.length > 0 ? 'in_progress' : 'new'
      out.push({
        id: m.id,
        title: m.title,
        typeLabel: MISSION_TYPE_LABELS[m.missionType],
        subjectName: subjects.get(m.subjectId) ?? '',
        questionCount: m.questionCount,
        coinsPerCorrect: m.coinsPerCorrect,
        resourceTitle: m.resourceTitle,
        resourceUrl: m.resourceUrl,
        resourceNote: m.resourceNote,
        status,
      })
    }
    return out
  }
}
