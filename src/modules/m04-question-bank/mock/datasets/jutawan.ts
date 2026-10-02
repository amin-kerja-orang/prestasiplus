/**
 * The `jutawanQuestions` virtual dataset (owner M04; SRS v1.11 §6.13.4, BR-M04-37, DATA-M04-12):
 * the question bank of the M16 "Jutawan Ilmu" game. 149,911 rows in their own id space 1–149,911,
 * separate from the 466,041 question rows (they are in no other count).
 *
 * Cells: the 143 subject × grade counts of M16 discovery A.7 (OBSERVED), each split evenly over
 * difficulty 1–4 by largest remainder (PROPOSED, BR-M04-37). No anchors (none observed). Every row
 * is an active MCQ with 4 options and one key; texts reuse the per-subject stems (fictitious).
 */

import { defineVirtualDataset, hashKey, split, type CellSpec } from '@/mock/dataset'
import { floor } from '@/mock/define'

import { JUTAWAN_CELLS, JUTAWAN_TOTAL } from '../data/tables'
import type { JutawanFacets, JutawanQuestion } from '../repository/types'
import { deriveQuestionFields, questionTextOf } from './question-derive'
import { objectiveFacets } from '../data/anchors'

export const JUTAWAN_FACETS = ['subjectId', 'educationLevelId', 'difficultyLevel'] as const

let memo: CellSpec<JutawanFacets>[] | null = null

export function jutawanSpec(): CellSpec<JutawanFacets>[] {
  if (memo) return memo
  const cells: CellSpec<JutawanFacets>[] = []
  for (const [level, bySubject] of Object.entries(JUTAWAN_CELLS)) {
    for (const [subject, n] of Object.entries(bySubject)) {
      for (const [d, count] of split(n, [
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
      ] as const)) {
        cells.push({
          facets: {
            subjectId: Number(subject),
            educationLevelId: Number(level),
            difficultyLevel: d,
          },
          count,
        })
      }
    }
  }
  memo = cells
  return memo
}

type Derived = Omit<JutawanQuestion, 'id' | keyof JutawanFacets>

function deriveJutawan(key: number, f: Readonly<JutawanFacets>): Derived {
  // The objective stems give a text, 4 options and a key for the subject.
  const facets = objectiveFacets(f.subjectId, f.educationLevelId, {
    difficultyLevel: f.difficultyLevel,
  })
  const base = deriveQuestionFields(key, facets)
  return {
    questionText: questionTextOf(key, facets),
    options: base.options ?? ['A', 'B', 'C', 'D'],
    correctAnswer: base.correctAnswer ?? hashKey(key, 7) % 4,
    explanation: base.explanation,
    isActive: true,
  }
}

export const jutawanDataset = defineVirtualDataset<JutawanQuestion, keyof JutawanFacets>({
  name: 'jutawanQuestions',
  owner: 'M04',
  total: JUTAWAN_TOTAL,
  idRange: { min: 1, max: JUTAWAN_TOTAL },
  runtimeIds: floor({ start: 9_000_001 }),
  facets: JUTAWAN_FACETS,
  distribution: () => jutawanSpec(),
  derive: (id, facets) => deriveJutawan(id, facets),
})
