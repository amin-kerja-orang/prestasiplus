import { Injectable } from '@nestjs/common'
import type { QuestionSetPaper } from '@pp/contract'

import type { AuthContext } from '../../../common/scope/auth-context'

/** The validated text fields of a paper submission, already normalised (trimmed, paper type as its slug, level as "T{n}", year defaulted). */
export interface PaperDeclaration {
  paperType: string
  subjectText: string
  levelCode: string | null
  year: number
  authorCredit: string
  note: string | null
}

/**
 * One uploaded file as the parser read it. `name` is the validated, re-decoded name reduced to a basename with
 * control characters removed; it is a LABEL for display only. BE-37 must never use the client name (or any part of
 * it) as a storage key or path, and `declaredMime` is what the client claimed and MUST NOT be trusted: the intake
 * sniffs `buffer` itself before storing or processing it.
 */
export interface PaperUpload {
  index: number
  name: string
  size: number
  declaredMime: string
  buffer: Buffer
}

export interface PaperSubmission {
  teacherId: string
  role: string
  isTest: boolean
  declaration: PaperDeclaration
  files: PaperUpload[]
  at: Date
  /** The caller's session context (intake scope and audit), the client address and the request id (null when unknown). */
  auth: AuthContext
  ip: string | null
  requestId: string | null
}

/** Implemented by BE-37 (intake): stores the files, creates the `source = guru` intake batch and answers its id. */
export interface QuestionPaperIntakePort {
  submit(input: PaperSubmission): Promise<QuestionSetPaper>
}

/** Holder with a set-once `provideIntake`, so BE-37 plugs in from its own `onModuleInit` (same pattern as `ClassesPorts`). */
@Injectable()
export class QuestionSetsPorts {
  private intakePort: QuestionPaperIntakePort | null = null

  /** The bound intake. An unbound port is a wiring error (`QuestionSetsModule.onModuleInit` binds it), never a request-time answer. */
  get intake(): QuestionPaperIntakePort {
    if (this.intakePort === null)
      throw new Error('QuestionSetsPorts: the paper intake is not bound')
    return this.intakePort
  }

  provideIntake(port: QuestionPaperIntakePort): void {
    if (this.intakePort !== null)
      throw new Error('QuestionSetsPorts: the paper intake is already set')
    this.intakePort = port
  }
}
