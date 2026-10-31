/**
 * The SQL half of the rules: the `QuestionFilter` each activity's real reader passes to the bank, so a count or a draw over
 * `filterOf(activity)` is exactly what pupils can be served (before the per-record mapper checks that `evaluate` adds).
 *
 * Every filter is applied by `QuestionsRepository.scope`, which already forces the live version, `is_active`, not PKSK, not
 * Darjah and the learner level (`NOT_PRIMARY_LEVEL_SQL`, `LEARNER_LEVEL_SQL`); the SPM activities add `spmPool` (`SPM_SERVABLE_SQL`).
 * Use with `eligibleIds`, `eligibleAmong`, `eligibleIdsPage`, `sampleIds` or `groupCount`.
 *
 * - latih_tubi_spm, databank: what `Be09PracticeQuestionSource.sample({ spmPool: true })` and the SPM pool read.
 * - bab:                      what `chapterPage` / `chapterCounts` read.
 * - simulasi_kuiz:            the random draw of the kuiz (`type mcq`, one MCQ leaf; groups allowed, D90).
 * - simulasi_paper, jana_kertas: the bank scope only; the bridge, the paper and the pool facts are per-record checks.
 */
import { PRACTICE_SHAPE } from '../../practice/question-bridge/be09-practice-mapping'
import type { ServabilityActivity } from '@pp/contract'

import type { QuestionFilter } from '../types'

export interface ActivityScope {
  subjectId?: string
  chapterId?: string
}

export function filterOf(activity: ServabilityActivity, scope: ActivityScope = {}): QuestionFilter {
  const subject = scope.subjectId === undefined ? {} : { subjectId: scope.subjectId }
  switch (activity) {
    case 'latih_tubi_spm':
    case 'databank':
      return { ...subject, type: 'mcq', ungrouped: true, mcqShape: PRACTICE_SHAPE, spmPool: true }
    case 'bab':
      return { ...subject, ...(scope.chapterId === undefined ? {} : { chapterId: scope.chapterId }), type: 'mcq', ungrouped: true, mcqShape: PRACTICE_SHAPE }
    case 'simulasi_kuiz':
      return { ...subject, type: 'mcq', singleMcqLeaf: true }
    case 'simulasi_paper':
    case 'jana_kertas':
      return { ...subject }
  }
}
