import type { McqOption, QuestionDef, SchemeDef, StimulusDef } from '../attempts/exam-core.adapter'
import { leavesOf } from '../attempts/exam-core.adapter'
import type { BijakQuestionBundle, BijakQuestionSource } from '../attempts/ports'
import { POC_BANK, pocQuestionId } from '../papers/poc'

/**
 * STOPGAP question source for the Bijak attempts module (BE-16) until the question bank (BE-09, Group A)
 * merges. It serves the PoC questions of BE-15's bundled export (`papers/poc/poc-bank.ts`) under their
 * reserved ids (`POC_QUESTION_ID_BASE + n`), the same ids the seeded PoC papers place, so a student can
 * start, answer and submit a PoC paper on the real API.
 *
 * - The question id (and the MCQ leaf id, which is the question id) is the reserved decimal id; structured
 *   part ids, group ids and stimulus ids keep their export keys.
 * - Schemes stay server-side: BE-16 only lets them out inside a graded result.
 * - `BijakIntegrationModule` binds it ONLY when the BE-09 tables are absent (`question_versions` does not
 *   exist). REPLACED BY BE-09: once BE-09 merges, its module binds `provideQuestionSource` itself, this
 *   class and its binding are deleted, and the PoC questions are loaded into the bank under the same
 *   reserved ids (see `papers/poc/index.ts`).
 */
export class PocBijakQuestionSource implements BijakQuestionSource {
  private readonly bundles = new Map<string, BijakQuestionBundle>()

  constructor() {
    const schemes = new Map(POC_BANK.schemes.map((s) => [s.id, s.scheme as unknown as SchemeDef]))
    const stimuli = new Map(POC_BANK.stimuli.map((s) => [s.id, s as unknown as StimulusDef]))
    const groups = new Map(POC_BANK.groups.map((g) => [g.id, g]))
    for (const raw of POC_BANK.questions) {
      const id = pocQuestionId(raw.id).toString()
      const question = { ...(raw as unknown as QuestionDef), id }
      const leafSchemes: Record<string, SchemeDef> = {}
      let complete = true
      if (raw.mcq) {
        const s = schemes.get(raw.id)
        if (s) leafSchemes[id] = s
        else complete = false
      } else {
        for (const leaf of leavesOf(question.parts ?? [])) {
          const s = schemes.get(leaf.id)
          if (s) leafSchemes[leaf.id] = s
          else complete = false
        }
      }
      // A question without its full scheme would grade wrongly: leave it out, so the attempt fails closed (500), never mis-marks.
      if (!complete) continue
      const g = raw.groupId ? groups.get(raw.groupId) : undefined
      const stimulus = g ? stimuli.get(g.stimulusId) : undefined
      if (raw.groupId && !stimulus) continue
      this.bundles.set(id, {
        question,
        ...(g && stimulus ? { group: { id: g.id, stimulus, ...(g.optionBank ? { optionBank: g.optionBank as McqOption[] } : {}) } } : {}),
        schemes: Object.freeze(leafSchemes),
      })
    }
  }

  /** Number of PoC questions it can serve (tests). */
  get size(): number {
    return this.bundles.size
  }

  async loadQuestions(questionIds: readonly string[]): Promise<ReadonlyMap<string, BijakQuestionBundle>> {
    const out = new Map<string, BijakQuestionBundle>()
    for (const id of questionIds) {
      const b = this.bundles.get(id)
      if (b) out.set(id, b)
    }
    return out
  }
}
