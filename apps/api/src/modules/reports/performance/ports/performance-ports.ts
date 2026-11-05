import { Inject, Injectable, Optional } from '@nestjs/common'

import {
  ANSWER_FACTS_PORT,
  EmptyAnswerFacts,
  EmptyQuestionContent,
  QUESTION_CONTENT_PORT,
  type AnswerFactsPort,
  type QuestionContentPort,
} from './answer-facts.port'
import { BIJAK_AGGREGATE_PORT, EmptyBijakAggregate, type BijakAggregatePort } from './bijak-aggregate.port'
import { CLASSES_READ_PORT, EmptyClasses, type ClassesReadPort } from './classes-read.port'
import { EmptyGamificationRead, GAMIFICATION_READ_PORT, type GamificationReadPort } from './gamification-read.port'
import { EmptyPracticeRead, PRACTICE_READ_PORT, type PracticeReadPort } from './practice-read.port'
import { EmptyTimelineRead, TIMELINE_READ_PORT, type TimelineReadPort } from './timeline-read.port'

/**
 * Holder of the ports other cards implement (pattern of `CurriculumPorts`). Defaults answer "nothing".
 * BE-16 calls `provideBijak(...)`, BE-17 `provideClasses(...)`, M05 `providePractice(...)`, BE-23
 * `provideGamification(...)`, S10-T01's `provideAnswerFacts(...)` and S10-T03's `provideQuestionContent(...)` (practice adapters) and BE-19's timeline `provideTimeline(...)` from their own `onModuleInit`;
 * a module may instead provide the matching token (tests do). Services read the getters on every request.
 * Registering twice throws.
 */
@Injectable()
export class PerformancePorts {
  private bijakPort: BijakAggregatePort
  private classesPort: ClassesReadPort
  private practicePort: PracticeReadPort
  private gamificationPort: GamificationReadPort
  private timelinePort: TimelineReadPort
  private answerFactsPort: AnswerFactsPort
  private questionContentPort: QuestionContentPort
  private bijakSet: boolean
  private classesSet: boolean
  private practiceSet: boolean
  private gamificationSet: boolean
  private timelineSet: boolean
  private answerFactsSet: boolean
  private questionContentSet: boolean

  constructor(
    @Optional() @Inject(BIJAK_AGGREGATE_PORT) bijak?: BijakAggregatePort,
    @Optional() @Inject(CLASSES_READ_PORT) classes?: ClassesReadPort,
    @Optional() @Inject(PRACTICE_READ_PORT) practice?: PracticeReadPort,
    @Optional() @Inject(GAMIFICATION_READ_PORT) gamification?: GamificationReadPort,
    @Optional() @Inject(TIMELINE_READ_PORT) timeline?: TimelineReadPort,
    @Optional() @Inject(ANSWER_FACTS_PORT) answerFacts?: AnswerFactsPort,
    @Optional() @Inject(QUESTION_CONTENT_PORT) questionContent?: QuestionContentPort,
  ) {
    this.bijakPort = bijak ?? new EmptyBijakAggregate()
    this.classesPort = classes ?? new EmptyClasses()
    this.practicePort = practice ?? new EmptyPracticeRead()
    this.gamificationPort = gamification ?? new EmptyGamificationRead()
    this.timelinePort = timeline ?? new EmptyTimelineRead()
    this.answerFactsPort = answerFacts ?? new EmptyAnswerFacts()
    this.questionContentPort = questionContent ?? new EmptyQuestionContent()
    this.bijakSet = bijak !== undefined
    this.classesSet = classes !== undefined
    this.practiceSet = practice !== undefined
    this.gamificationSet = gamification !== undefined
    this.timelineSet = timeline !== undefined
    this.answerFactsSet = answerFacts !== undefined
    this.questionContentSet = questionContent !== undefined
  }

  get bijak(): BijakAggregatePort {
    return this.bijakPort
  }
  get classes(): ClassesReadPort {
    return this.classesPort
  }
  get practice(): PracticeReadPort {
    return this.practicePort
  }
  get gamification(): GamificationReadPort {
    return this.gamificationPort
  }
  get timeline(): TimelineReadPort {
    return this.timelinePort
  }
  get answerFacts(): AnswerFactsPort {
    return this.answerFactsPort
  }
  get questionContent(): QuestionContentPort {
    return this.questionContentPort
  }

  provideBijak(port: BijakAggregatePort): void {
    if (this.bijakSet) throw new Error('PerformancePorts: the Bijak aggregate is already set')
    this.bijakPort = port
    this.bijakSet = true
  }
  provideClasses(port: ClassesReadPort): void {
    if (this.classesSet) throw new Error('PerformancePorts: the classes port is already set')
    this.classesPort = port
    this.classesSet = true
  }
  providePractice(port: PracticeReadPort): void {
    if (this.practiceSet) throw new Error('PerformancePorts: the practice port is already set')
    this.practicePort = port
    this.practiceSet = true
  }
  provideGamification(port: GamificationReadPort): void {
    if (this.gamificationSet) throw new Error('PerformancePorts: the gamification port is already set')
    this.gamificationPort = port
    this.gamificationSet = true
  }
  provideTimeline(port: TimelineReadPort): void {
    if (this.timelineSet) throw new Error('PerformancePorts: the timeline port is already set')
    this.timelinePort = port
    this.timelineSet = true
  }
  provideAnswerFacts(port: AnswerFactsPort): void {
    if (this.answerFactsSet) throw new Error('PerformancePorts: the answer facts port is already set')
    this.answerFactsPort = port
    this.answerFactsSet = true
  }
  provideQuestionContent(port: QuestionContentPort): void {
    if (this.questionContentSet) throw new Error('PerformancePorts: the question content port is already set')
    this.questionContentPort = port
    this.questionContentSet = true
  }
}
