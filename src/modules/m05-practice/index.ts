import { defineAsyncComponent } from 'vue'

import type { ModuleManifest } from '@/app/modules'

import routes from './routes'

/**
 * M05 public entry (ADR-0009). Other modules import this module only from here.
 * Public exports: the typed client functions and types of the practice endpoints (`./api`,
 * M05-T1: #1–#14 and the session calls #4–#6, #23). Public components are added by the tasks named
 * in build-plan §S.3 rule 6 (M05-T4 `QuizRunner`).
 */
export const manifest: ModuleManifest = {
  id: 'M05',
  slug: 'm05-practice',
  routes,
}

export * from './api/practice'
export type * from './api/types'

// M05-T4 (XL-10): the reusable quiz component and its public contract. Hosts: M05 Q1/Q2/S7/Q4–Q6, M06.
/** Loaded on first use, so the module entry (read at boot) stays light. */
export const QuizRunner = defineAsyncComponent(() => import('./components/quiz/QuizRunner.vue'))
export { PRACTICE_LABELS, REVISION_LABELS } from './components/quiz/quiz-labels'
export type {
  QuizAnswerRecord,
  QuizApi,
  QuizCompletedEvent,
  QuizLabels,
  QuizReportConfig,
  QuizStartErrorEvent,
} from './components/quiz/quiz-types'

/** The Phosphor glyph of a subject (used by M06 cards). */
export { subjectGlyph } from './components/quiz/subject-glyph'
