/**
 * Ports other cards implement. M10 part A never computes what it does not own: a teacher's question
 * counts come from the question bank (M04, BE-09) and "has the teacher launched a mission" from the
 * missions store (BE-18). Until those cards merge the defaults below answer "nothing yet", which keeps
 * the dashboard checklist `hasMission` false and the contribution counters 0.
 */
import { Injectable } from '@nestjs/common'

export interface TeacherQuestionStats {
  /** Questions the teacher contributed (objective bank rows plus structured ones, BR-M10-06). */
  total: number
  /** Of `total`, the structured questions (v2 `question_versions.type = 'structured'`); the rest are objective. Optional: fakes may omit it (read as 0). */
  structured?: number
  approved: number
  pending: number
  used: number
  /** Contributed questions per subject name (any order); the service sorts and folds them. */
  bySubject: { label: string; count: number }[]
}

export interface TeacherQuestionsProvider {
  statsOf(teacherId: string): Promise<TeacherQuestionStats>
}

export class NoTeacherQuestions implements TeacherQuestionsProvider {
  async statsOf(): Promise<TeacherQuestionStats> {
    return { total: 0, structured: 0, approved: 0, pending: 0, used: 0, bySubject: [] }
  }
}

export interface TeacherMissionsProvider {
  /** True when the teacher has launched at least one mission (BE-18). */
  hasMission(teacherId: string): Promise<boolean>
}

export class NoTeacherMissions implements TeacherMissionsProvider {
  async hasMission(): Promise<boolean> {
    return false
  }
}

/**
 * The two ports as one injectable holder, so a later module plugs in without editing `classes.module.ts`
 * (the same pattern as `CurriculumPorts`). BE-09 calls `provideQuestions(...)`, BE-18 calls
 * `provideMissions(...)`, each from its own `onModuleInit`. Registering twice is a wiring error and throws.
 */
@Injectable()
export class ClassesPorts {
  private questionsProvider: TeacherQuestionsProvider = new NoTeacherQuestions()
  private missionsProvider: TeacherMissionsProvider = new NoTeacherMissions()
  private questionsSet = false
  private missionsSet = false

  get questions(): TeacherQuestionsProvider {
    return this.questionsProvider
  }

  get missions(): TeacherMissionsProvider {
    return this.missionsProvider
  }

  provideQuestions(provider: TeacherQuestionsProvider): void {
    if (this.questionsSet) throw new Error('ClassesPorts: the teacher questions provider is already set')
    this.questionsProvider = provider
    this.questionsSet = true
  }

  provideMissions(provider: TeacherMissionsProvider): void {
    if (this.missionsSet) throw new Error('ClassesPorts: the teacher missions provider is already set')
    this.missionsProvider = provider
    this.missionsSet = true
  }
}
