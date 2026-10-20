import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { of } from 'rxjs'
import { describe, expect, it } from 'vitest'

import { PragmaNoCacheInterceptor } from '../../src/modules/school-admin/pragma-no-cache.interceptor'

describe('PragmaNoCacheInterceptor', () => {
  it('sets Pragma: no-cache before the handler runs', () => {
    const headers: Record<string, string> = {}
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v
      },
    }
    const ctx = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ExecutionContext
    let ran = false
    const next: CallHandler = {
      handle: () => {
        ran = true
        return of(1)
      },
    }
    new PragmaNoCacheInterceptor().intercept(ctx, next)
    expect(headers).toEqual({ Pragma: 'no-cache' })
    expect(ran).toBe(true)
  })
})
