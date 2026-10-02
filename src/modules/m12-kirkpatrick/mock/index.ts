/**
 * M12 mock plugin (M12-T1; SRS M12 v1.6 §6, §6.9, §6.11, §7; overview §6.7, D11/D12). Owner of FeedbackResponse
 * (DATA-M12-01), KirkpatrickIntervention (`kirkpatrickInterventions`, DATA-M12-02) and the stored score tables
 * (DATA-M12-03 school scores, DATA-M12-04 ALESA lists, DATA-M12-05 consistency anchors), and of the display
 * constants DC-M12-01 ... 03. It reads, through the owners' contracts only: the M05 `kirkpatrick` segment (F-26c
 * KirkpatrickSessionAggregate) and the answer log, the M08 SPM history and headcount entries, the M01 users and
 * M02 schools, and the M03 subjects. The M26 mood store is not read (BR-M12-15: the mood count is 0).
 *
 * PUBLIC exports (the only M12 mock code other modules may import, `@/modules/m12-kirkpatrick/mock`): the
 * repositories `feedback` (`aggregates(schoolId?)` and `count('Q-M12-T1', schoolId?)` are Q-M12-T1 for M17,
 * XR-M12-09; the optional school filter is XR-M17-21: the responses of that school's respondents, 0 for a school
 * without any) and `kirkpatrickInterventions`.
 *
 * Routes (`handlers/`): §7 #1-#14. Hooks (`hooks/`): `addFeedback`, `addIntervention`, `addSegmentStudent`.
 *
 * Bump `version` whenever the seed, a spec or a cheap field changes (overview §6.9, §14 rule 4b).
 */

import { defineMockModule } from '@/mock/define'

import { m12Routes } from './handlers'
import { m12Hooks } from './hooks'
import {
  alesaRepo,
  consistencyRepo,
  feedbackRepo,
  interventionsRepo,
  schoolScoresRepo,
} from './repository'
import { finaliseM12, seedM12 } from './seeds/seed'
import { M12_TABLES } from './tables/tables'

const plugin = defineMockModule({
  id: 'M12',
  dependsOn: ['core', 'M01', 'M02', 'M03', 'M05', 'M08'],
  version: 1,
  tables: M12_TABLES,
  repositories: {
    feedback: feedbackRepo,
    kirkpatrickInterventions: interventionsRepo,
    schoolEngagementScores: schoolScoresRepo,
    alesaPredictions: alesaRepo,
    studentConsistency: consistencyRepo,
  },
  seed: seedM12,
  finalise: finaliseM12,
  routes: m12Routes,
  hooks: m12Hooks,
})

export default plugin

export const {
  feedback,
  kirkpatrickInterventions,
  schoolEngagementScores,
  alesaPredictions,
  studentConsistency,
} = plugin.repositories

export { M12Error, type M12ErrorCode } from './repository'
export type { FeedbackAggregates } from './repository'
export type * from './types'
