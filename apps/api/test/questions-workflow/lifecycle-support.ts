import type { QuestionPart } from '@pp/contract'

import { ApiError } from '../../src/common/errors/api-error'
import type { WorkflowActor } from '../../src/modules/questions/workflow'
import type { Client } from './helpers'

export const actorOf = (c: Client): WorkflowActor => ({ userId: c.userId, role: c.role as WorkflowActor['role'], requestId: null, ip: null, isTest: false })

/** Awaits a promise that must reject with an `ApiError`. */
export async function failure(p: Promise<unknown> | (() => unknown)): Promise<ApiError> {
  try {
    await (typeof p === 'function' ? p() : p)
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('expected an ApiError, but the call succeeded')
}

/** A working-mode leaf worth `marks` whose key awards `keyMarks`. */
export function workingPart(marks: number, keyMarks: number): QuestionPart {
  return {
    label: 'a',
    mode: 'working',
    marks,
    key: { kind: 'points', marks: keyMarks, points: [{ id: 'p1', code: 'M', marks: keyMarks }] },
  } as unknown as QuestionPart
}
