// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'

import { setRouteOutcome, useRouteOutcome, decideAccess } from '../router'
import { isFeatureRouteOff } from '../features'
import { fakeTransport, logIn, NOW, STUDENT, testRouter } from './router-fixtures'
import { installTransport } from '@/api'
import { clock } from '@/lib/time'
import { useSessionStore } from '@/stores/session'

/** S0-T10 Kawalan Ciri: a page of an OFF feature answers the standard in-place 404 (AC-ADM-N06.1). */

const route = (path: string) => ({ path, meta: {} }) as unknown as RouteLocationNormalized
const student = { isLoggedIn: true, role: 'student', landingPath: '/dashboard' } as const

/** Signs a pupil in with a server `features` map. */
function withFlags(features?: Record<string, boolean>): void {
  logIn(STUDENT, features ? { features } : {})
  useSessionStore().check()
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: Date.parse(NOW), toFake: ['Date'] })
  clock.reset()
  setActivePinia(createPinia())
  setRouteOutcome(null)
  installTransport(fakeTransport())
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

describe('isFeatureRouteOff', () => {
  it('is false with no OFF flag, a missing key or an ON key', () => {
    expect(isFeatureRouteOff('/permainan')).toBe(false)
    withFlags()
    expect(isFeatureRouteOff('/permainan')).toBe(false)
    withFlags({ 'latih-tubi': false })
    expect(isFeatureRouteOff('/permainan')).toBe(false)
  })

  it('OFF permainan covers the prefix and below, on a segment boundary only', () => {
    withFlags({ permainan: false })
    expect(isFeatureRouteOff('/permainan')).toBe(true)
    expect(isFeatureRouteOff('/permainan/x')).toBe(true)
    expect(isFeatureRouteOff('/permainanx')).toBe(false)
    expect(isFeatureRouteOff('/dashboard')).toBe(false)
  })

  it('OFF latih-tubi covers /practice but not its feExcept paths', () => {
    withFlags({ 'latih-tubi': false })
    expect(isFeatureRouteOff('/practice')).toBe(true)
    expect(isFeatureRouteOff('/practice/chapter')).toBe(false)
    expect(isFeatureRouteOff('/practice/chapter/3')).toBe(false)
    expect(isFeatureRouteOff('/practice/revision')).toBe(false)
  })

  it('the locked keys are OFF by the map: /cikgu and /mohon-keluarga-angkat', () => {
    withFlags({ 'cikgu-alesa': false, 'keluarga-angkat': false })
    expect(isFeatureRouteOff('/cikgu')).toBe(true)
    expect(isFeatureRouteOff('/cikgu/rph')).toBe(true)
    expect(isFeatureRouteOff('/mohon-keluarga-angkat')).toBe(true)
  })

  it('is false with no active Pinia', () => {
    setActivePinia(undefined)
    expect(isFeatureRouteOff('/permainan')).toBe(false)
  })
})

describe('decideAccess: 404 in place for an OFF feature', () => {
  it('OFF permainan', () => {
    withFlags({ permainan: false })
    expect(decideAccess(route('/permainan'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/permainan/x'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/permainanx'), student)).toEqual({ kind: 'allow' })
  })

  it('OFF latih-tubi: /practice is 404, chapter and revision pass', () => {
    withFlags({ 'latih-tubi': false })
    expect(decideAccess(route('/practice'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/practice/chapter'), student)).toEqual({ kind: 'allow' })
    expect(decideAccess(route('/practice/revision'), student)).toEqual({ kind: 'allow' })
  })

  it('ON or missing key passes', () => {
    withFlags({ permainan: true })
    expect(decideAccess(route('/permainan'), student)).toEqual({ kind: 'allow' })
    expect(decideAccess(route('/practice'), student)).toEqual({ kind: 'allow' })
  })

  it('the locked keys answer 404 on /cikgu', () => {
    withFlags({ 'cikgu-alesa': false })
    expect(decideAccess(route('/cikgu'), student)).toEqual({ kind: 'in-place', status: 404 })
  })
})

describe('the router', () => {
  it('keeps the URL and sets the in-place 404 outcome for an OFF feature, then clears it', async () => {
    withFlags({ permainan: false })
    const router = testRouter()
    await router.push('/permainan')
    expect(router.currentRoute.value.path).toBe('/permainan')
    expect(useRouteOutcome().value).toBe(404)
    await router.push('/dashboard')
    expect(useRouteOutcome().value).toBeNull()
  })

  it('does not touch the outcome for an ON feature', async () => {
    withFlags({ permainan: true })
    const router = testRouter()
    await router.push('/dashboard')
    expect(useRouteOutcome().value).toBeNull()
  })
})
