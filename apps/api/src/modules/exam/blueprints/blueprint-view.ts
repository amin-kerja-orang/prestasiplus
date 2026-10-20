import type { BijakBlueprintView } from '@pp/contract'

import type { BlueprintSection, Blueprint } from '../../../db/generated/client'
import { bijakCodeOf } from '../../bijak/papers'
import { ruleOf, sectionInstruction, sourceToWire } from '../../bijak/papers/rules'

export type BlueprintWithSections = Blueprint & { sections: BlueprintSection[] }

/**
 * `BlueprintView` of one blueprint row, built as the mock `blueprintView` (admin.ts lines 352-379):
 * `markBudget` defaults to the question count, the instruction to the derived line, `totalMarks` is
 * the sum of the section budgets. `subject` is the Bijak code of the curriculum subject.
 */
export function blueprintView(row: BlueprintWithSections, subject: { code: string; name: string }): BijakBlueprintView {
  const sections = [...row.sections]
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const rule = ruleOf(s.ruleType, s.ruleN)
      return {
        label: s.label,
        markBudget: s.markBudget ?? s.questionCount,
        questionCount: s.questionCount,
        compulsory: s.compulsory,
        instruction: sectionInstruction(s.instruction, rule, s.questionCount),
        rule,
        pool: s.pool ?? '',
      }
    })
  return {
    subject: bijakCodeOf(subject.code),
    subjectName: subject.name,
    kertas: row.kertas,
    source: sourceToWire(row.source),
    code: row.code,
    durationMin: row.durationMin,
    instructions: row.instructions,
    totalMarks: sections.reduce((n, s) => n + s.markBudget, 0),
    sections,
  }
}
