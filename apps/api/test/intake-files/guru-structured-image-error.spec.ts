import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { GuruSubmissionsService } from '../../src/modules/intake/files/guru-submissions.service'

/** S6-T17: `prepareStructured` merges only a field error of the image check into the 422; any other failure is rethrown. No database. */
const body = { educationLevelId: '1', subjectId: '1', difficultyLevel: 3, stimulusImageId: 'tok', parts: [{ text: 'a', marks: 1, scheme: 's' }] } as never

function service(findFirst: () => Promise<unknown>) {
  const prisma = { client: { file: { findFirst } } }
  const svc = new GuruSubmissionsService(prisma as never, {} as never, {} as never)
  const resolve = vi.spyOn(svc, 'resolveTags').mockImplementation((_b, extra) => Promise.reject(new Error(JSON.stringify(extra))))
  return { svc, resolve }
}

describe('prepareStructured: the image check error handling', () => {
  it('passes the image field error on to the form errors', async () => {
    const { svc, resolve } = service(() => Promise.resolve(null))
    await expect(svc.prepareStructured('5', body)).rejects.toThrow(/stimulusImageId/)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('rethrows an ApiError that has no fields', async () => {
    const boom = ApiError.of('NOT_FOUND')
    const { svc, resolve } = service(() => Promise.reject(boom))
    await expect(svc.prepareStructured('5', body)).rejects.toBe(boom)
    expect(resolve).not.toHaveBeenCalled()
  })

  it('rethrows an error that is not an ApiError', async () => {
    const boom = new TypeError('db down')
    const { svc, resolve } = service(() => Promise.reject(boom))
    await expect(svc.prepareStructured('5', body)).rejects.toBe(boom)
    expect(resolve).not.toHaveBeenCalled()
  })
})
