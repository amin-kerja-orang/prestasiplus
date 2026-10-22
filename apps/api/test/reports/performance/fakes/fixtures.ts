import type { RoleCode } from '@pp/contract'

import { FixedClock } from '../../../../src/db/clock'
import type { Ctx } from '../../../../src/modules/reports/performance/services'
import type { BijakItemFact, BijakSittingFact } from '../../../../src/modules/reports/performance/ports'
import { PerformancePorts } from '../../../../src/modules/reports/performance/ports'
import {
  AnalyticsService,
  ClassPerformanceService,
  ItemAnalysisService,
  SchoolPerformanceService,
  StudentPerformanceService,
} from '../../../../src/modules/reports/performance/services'
import { InMemoryBijakAggregate } from './in-memory-bijak-aggregate'
import { InMemoryClasses } from './in-memory-classes'
import { InMemoryDirectory } from './in-memory-directory'
import { InMemoryGamification } from './in-memory-gamification'
import { InMemoryHeadcountFacts } from './in-memory-headcount-facts'

/** The clock of every unit test: Friday 2026-09-25 15:40 MYT. */
export const NOW = '2026-09-25T15:40:00+08:00'

let seq = 0

export function sitting(over: Partial<BijakSittingFact> & Pick<BijakSittingFact, 'userId'>): BijakSittingFact {
  seq += 1
  return {
    attemptId: `a${seq}`,
    schoolId: 's1',
    subjectId: '1',
    subjectCode: 'BM',
    subjectName: 'Bahasa Melayu',
    paperKind: 'pilihan',
    mode: 'exam',
    status: 'submitted',
    score: 8,
    maxScore: 10,
    // Answered questions, not marks: defaults to the marks only so most specs read alike; specs on `answered` set it.
    answeredCount: over.maxScore ?? 10,
    provisional: false,
    pendingReview: 0,
    durationSeconds: 600,
    startedAt: new Date('2026-09-20T10:00:00+08:00'),
    submittedAt: new Date('2026-09-20T10:10:00+08:00'),
    ...over,
  }
}

export function item(over: Partial<BijakItemFact> & Pick<BijakItemFact, 'userId' | 'attemptId' | 'questionId'>): BijakItemFact {
  return {
    schoolId: 's1',
    questionVersion: 1,
    subjectId: '1',
    subjectName: 'Bahasa Melayu',
    topic: 'Tatabahasa',
    subtopic: null,
    stem: `Soalan ${over.questionId}`,
    options: [
      { letter: 'A', text: 'Pilihan A' },
      { letter: 'B', text: 'Pilihan B' },
      { letter: 'C', text: 'Pilihan C' },
      { letter: 'D', text: 'Pilihan D' },
    ],
    correctLetter: 'A',
    chosenLetter: 'A',
    awarded: 1,
    max: 1,
    ...over,
  }
}

export const ctxOf = (role: RoleCode, userId: string, scope: Ctx['scope'] = { level: 'school', schoolId: 's1', label: 'Sekolah' }): Ctx => ({
  userId,
  role,
  scope,
  isTest: false,
})

export interface World {
  bijak: InMemoryBijakAggregate
  classes: InMemoryClasses
  directory: InMemoryDirectory
  gamification: InMemoryGamification
  facts: InMemoryHeadcountFacts
  ports: PerformancePorts
  clock: FixedClock
  analytics: AnalyticsService
  student: StudentPerformanceService
  school: SchoolPerformanceService
  klass: ClassPerformanceService
  items: ItemAnalysisService
}

/** A fresh world: fakes wired into the real services. */
export function world(): World {
  const directory = new InMemoryDirectory()
  const bijak = new InMemoryBijakAggregate()
  const classes = new InMemoryClasses()
  const gamification = new InMemoryGamification()
  const facts = new InMemoryHeadcountFacts()
  const ports = new PerformancePorts(bijak, classes, undefined, gamification)
  const clock = new FixedClock(NOW)
  return {
    bijak,
    classes,
    directory,
    gamification,
    facts,
    ports,
    clock,
    analytics: new AnalyticsService(ports, directory, clock),
    student: new StudentPerformanceService(ports, directory, clock, facts),
    school: new SchoolPerformanceService(ports, directory, clock, facts),
    klass: new ClassPerformanceService(ports, directory, clock, facts),
    items: new ItemAnalysisService(ports, directory, clock),
  }
}
