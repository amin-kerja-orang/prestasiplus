// @vitest-environment jsdom
import { FEATURE_ROUTE_PREFIXES, pathHasPrefix } from '@pp/contract'
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
    // #417 D-5: Kemajuan Saya and Sejarah Latihan stay up when Latih Tubi is OFF.
    expect(isFeatureRouteOff('/practice/progress')).toBe(false)
    expect(isFeatureRouteOff('/practice/history')).toBe(false)
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

/** S0-T11: every one of the 32 keys, OFF -> the in-place 404 on each fe prefix, ON (or absent) -> allow. */
describe('every Kawalan Ciri key (S0-T11)', () => {
  const entries = Object.entries(FEATURE_ROUTE_PREFIXES)

  it('has 32 keys', () => {
    expect(entries).toHaveLength(32)
  })

  it.each(entries)('%s: OFF answers the in-place 404 on its fe paths, ON and missing pass', (key, p) => {
    for (const prefix of p.fe) {
      for (const path of [prefix, `${prefix}/1`]) {
        const owner = entries.find(
          ([, o]) => o.fe.some((f) => pathHasPrefix(path, f)) && !(o.feExcept ?? []).some((e) => pathHasPrefix(path, e)),
        )
        // A sub-path that a more specific key owns is asserted under that key.
        if (owner?.[0] !== key) continue
        withFlags({ [key]: false })
        expect(decideAccess(route(path), student), `${key} OFF ${path}`).toEqual({ kind: 'in-place', status: 404 })
        withFlags({ [key]: true })
        expect(decideAccess(route(path), student), `${key} ON ${path}`).toEqual({ kind: 'allow' })
        withFlags({})
        expect(decideAccess(route(path), student), `${key} absent ${path}`).toEqual({ kind: 'allow' })
        // A look-alike on the segment boundary is not covered.
        withFlags({ [key]: false })
        expect(decideAccess(route(`${prefix}x`), student)).toEqual({ kind: 'allow' })
      }
    }
  })

  it.each(entries.filter(([, p]) => (p.feExcept ?? []).length > 0))('%s: OFF leaves its feExcept paths reachable', (key, p) => {
    withFlags({ [key]: false })
    for (const except of p.feExcept ?? []) {
      expect(decideAccess(route(except), student), `${key} OFF ${except}`).toEqual({ kind: 'allow' })
    }
  })

  it('every feExcept path (bar the two other-module ones of S0-T10) is owned by another key', () => {
    for (const [key, p] of entries) {
      for (const except of p.feExcept ?? []) {
        if (['/practice/chapter', '/practice/revision'].includes(except)) continue
        const owners = entries.filter(([k, o]) => k !== key && o.fe.some((f) => pathHasPrefix(except, f)))
        expect(owners.length > 0, `${key} feExcept ${except}`).toBe(true)
      }
    }
  })

  it('latih-tubi OFF keeps Kemajuan Saya and Sejarah Latihan; their own keys hide them', () => {
    withFlags({ 'latih-tubi': false })
    expect(decideAccess(route('/practice/progress'), student)).toEqual({ kind: 'allow' })
    expect(decideAccess(route('/practice/history'), student)).toEqual({ kind: 'allow' })
    expect(decideAccess(route('/practice/session'), student)).toEqual({ kind: 'in-place', status: 404 })
    withFlags({ 'kemajuan-saya': false, 'sejarah-latihan': false })
    expect(decideAccess(route('/practice/progress'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/practice/history'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/practice'), student)).toEqual({ kind: 'allow' })
  })

  it('shared pages follow the key that owns them (D-3): prestasi vs guru.prestasi, cita-cita vs universiti', () => {
    withFlags({ prestasi: false })
    expect(decideAccess(route('/prestasi'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/prestasi/3001'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/prestasi/kelas'), student)).toEqual({ kind: 'allow' })
    withFlags({ 'guru.prestasi': false })
    expect(decideAccess(route('/prestasi/kelas/2001'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/prestasi'), student)).toEqual({ kind: 'allow' })
    withFlags({ 'cita-cita': false })
    expect(decideAccess(route('/cita-cita'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/cita-cita/universiti'), student)).toEqual({ kind: 'allow' })
    withFlags({ universiti: false })
    expect(decideAccess(route('/cita-cita/universiti'), student)).toEqual({ kind: 'in-place', status: 404 })
    expect(decideAccess(route('/cita-cita/biasiswa'), student)).toEqual({ kind: 'allow' })
  })

  it('AC-ADM-P2-19.1: Leaderboard OFF answers 404 on /leaderboard and its duplicate, keeps the URL, ON restores it', async () => {
    withFlags({ leaderboard: false })
    expect(decideAccess(route('/gamification/leaderboard'), student)).toEqual({ kind: 'in-place', status: 404 })
    withFlags({ leaderboard: false })
    const router = testRouter()
    await router.push('/leaderboard')
    expect(router.currentRoute.value.path).toBe('/leaderboard')
    expect(useRouteOutcome().value).toBe(404)
    withFlags({ leaderboard: true })
    await router.push('/dashboard')
    await router.push('/leaderboard')
    expect(useRouteOutcome().value).toBeNull()
  })
})
