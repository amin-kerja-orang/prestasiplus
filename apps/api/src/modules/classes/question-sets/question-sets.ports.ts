import { Injectable } from '@nestjs/common'
import type { QuestionSetPaper } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { PAPER_INTAKE_UNAVAILABLE } from './question-sets.constants'

/** The validated text fields of a paper submission, already normalised (trimmed, level as "T{n}", year defaulted). */
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
}

/** Implemented by BE-37 (intake): stores the files, creates the pending question bank submission. */
export interface QuestionPaperIntakePort {
  submit(input: PaperSubmission): Promise<QuestionSetPaper>
}

/** Default while BE-37 is not merged: says honestly that the upload cannot be accepted yet. */
export class UnavailablePaperIntake implements QuestionPaperIntakePort {
  async submit(): Promise<QuestionSetPaper> {
    // 503 with the generic SERVER_ERROR code: no new code is added; the status tells a client to try again later.
    throw new ApiError({ code: 'SERVER_ERROR', status: 503, message: PAPER_INTAKE_UNAVAILABLE })
  }
}

/** Holder with a set-once `provideIntake`, so BE-37 plugs in from its own `onModuleInit` (same pattern as `ClassesPorts`). */
@Injectable()
export class QuestionSetsPorts {
  private intakePort: QuestionPaperIntakePort = new UnavailablePaperIntake()
  private intakeSet = false

  get intake(): QuestionPaperIntakePort {
    return this.intakePort
  }

  provideIntake(port: QuestionPaperIntakePort): void {
    if (this.intakeSet) throw new Error('QuestionSetsPorts: the paper intake is already set')
    this.intakePort = port
    this.intakeSet = true
  }
}
