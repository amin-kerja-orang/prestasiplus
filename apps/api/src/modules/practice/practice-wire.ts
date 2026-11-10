/**
 * The served-question part of the start response (`PracticeQuizQuestion[]`). PURE. The key and the explanation are never part of it
 * (AC 4). T-C13 (D105, D90): a stimulus-group member carries the group's stimuli on EVERY member (the rajah is never only on the first
 * question) and its place `{ id, index, size }` among the members served; members are contiguous and in group order (the planner keeps them so).
 */
import type { PracticeQuizQuestion } from '@pp/contract'

import type { PracticeQuestion } from './ports'

export function quizQuestionsOf(questions: readonly PracticeQuestion[], wrongTimesOf: (questionId: string) => number): PracticeQuizQuestion[] {
  const size = new Map<string, number>()
  for (const q of questions) if (q.groupId !== undefined) size.set(q.groupId, (size.get(q.groupId) ?? 0) + 1)
  const seen = new Map<string, number>()
  return questions.map((q) => {
    let group: PracticeQuizQuestion['group']
    if (q.groupId !== undefined) {
      const index = (seen.get(q.groupId) ?? 0) + 1
      seen.set(q.groupId, index)
      group = { id: q.groupId, index, size: size.get(q.groupId) ?? 1 }
    }
    return {
      id: q.id,
      questionText: q.questionText,
      textDirection: q.textDirection,
      scriptType: q.scriptType,
      wrongTimes: wrongTimesOf(q.id),
      hasDskp: q.hasDskp,
      contributor: q.contributor ? { name: q.contributor.name, profileUrl: q.contributor.profileUrl } : null,
      ...(q.referenceUrl ? { referenceUrl: q.referenceUrl } : {}),
      options: q.options.map((o, i) => ({ id: i, label: o.label, text: o.text, ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}) })),
      ...(q.stimuli && q.stimuli.length > 0 ? { stimuli: q.stimuli } : {}),
      ...(group ? { group } : {}),
    }
  })
}
