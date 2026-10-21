import 'reflect-metadata'

import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { RequestMethod } from '@nestjs/common'
import { ModulesContainer } from '@nestjs/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IS_PUBLIC_KEY } from '../../src/common/guards/decorators'
import { featureModules } from '../../src/modules'
import { normalisePath, registeredRoutes } from '../conformance/api-target'
import { bootSecurityApp, loginAs, type Login, type SecurityApp } from './helpers'

/**
 * BE-33 AC1a: a mutating request with a valid session cookie but no (or a wrong) CSRF token is
 * 403 CSRF_INVALID on EVERY mutating, non-public route of EVERY module group. The route list is read
 * from the running app (Nest's module container), so a new module or route is covered automatically.
 * The CSRF check runs inside the global AuthGuard, before the role and capability guards and before
 * validation, so one signed-in role is enough to reach it on any route.
 */

const MUTATING = new Set<RequestMethod>([RequestMethod.POST, RequestMethod.PUT, RequestMethod.PATCH, RequestMethod.DELETE])
const VERB: Record<number, 'post' | 'put' | 'patch' | 'delete'> = {
  [RequestMethod.POST]: 'post',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.DELETE]: 'delete',
}

interface MutatingRoute {
  verb: 'post' | 'put' | 'patch' | 'delete'
  path: string
  label: string
}

const first = (p: unknown): string => {
  const v = Array.isArray(p) ? (p[0] as unknown) : p
  return typeof v === 'string' ? v : ''
}
/** Every path of a decorator (`@Post(['a', 'b'])` is two routes). */
const all = (p: unknown): string[] => (Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [typeof p === 'string' ? p : ''])
const join = (...parts: string[]): string => {
  const out = parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
  return `/${out}`
}

/** Mutating, non-public routes of the running app, grouped by the Nest module that owns the controller. */
function mutatingRoutesByModule(container: ModulesContainer, publicRoutes: Set<string>): Map<string, MutatingRoute[]> {
  const groups = new Map<string, MutatingRoute[]>()
  for (const mod of container.values()) {
    const name = mod.metatype?.name ?? ''
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as (new (...a: never[]) => unknown) | null
      if (!ctrl) continue
      const base = first(Reflect.getMetadata(PATH_METADATA, ctrl))
      const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ctrl) === true
      for (const key of Object.getOwnPropertyNames(ctrl.prototype)) {
        if (key === 'constructor') continue
        const handler = (ctrl.prototype as Record<string, unknown>)[key]
        if (typeof handler !== 'function') continue
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined
        if (method === undefined || !MUTATING.has(method)) continue
        // Method-level @Public wins; a class-level one covers the rest (RolesGuard/AuthGuard use getAllAndOverride).
        const own = Reflect.getMetadata(IS_PUBLIC_KEY, handler) as boolean | undefined
        const isPublic = own ?? classPublic
        for (const sub of all(Reflect.getMetadata(PATH_METADATA, handler))) {
          const path = join(base, sub).replace(/:[A-Za-z0-9_]+/g, '1')
          const verb = VERB[method] as MutatingRoute['verb']
          if (isPublic) {
            publicRoutes.add(`${verb.toUpperCase()} ${normalisePath(join(base, sub))}`)
            continue
          }
          const list = groups.get(name) ?? []
          list.push({ verb, path, label: `${verb.toUpperCase()} /api${join(base, sub)}` })
          groups.set(name, list)
        }
      }
    }
  }
  return groups
}

describe('BE-33 AC1a: CSRF_INVALID on every mutating route group', () => {
  let t: SecurityApp
  let admin: Login
  let groups: Map<string, MutatingRoute[]>
  const publicRoutes = new Set<string>()

  beforeAll(async () => {
    t = await bootSecurityApp()
    admin = await loginAs(t, 'admin@demo.test')
    groups = mutatingRoutesByModule(t.app.get(ModulesContainer), publicRoutes)
  })
  afterAll(async () => {
    await t.close()
  })

  const send = (r: MutatingRoute, csrf: string | null) => {
    // A fresh request on the admin's cookie jar; the header is the only thing that varies.
    let req = admin.agent[r.verb](`/api${r.path}`)
    if (csrf !== null) req = req.set('X-CSRF-Token', csrf)
    return req.send({})
  }

  it('finds the mutating routes and every feature module that owns one', () => {
    expect(groups.size).toBeGreaterThanOrEqual(20)
    const total = [...groups.values()].reduce((n, l) => n + l.length, 0)
    expect(total).toBeGreaterThanOrEqual(100)
    // Every feature module that registers a mutating, non-public controller of its own is a group below.
    const featureNames = new Set(featureModules.map((m) => m.name))
    const owned = [...groups.keys()].filter((n) => featureNames.has(n))
    expect(owned.length).toBeGreaterThanOrEqual(15)
  })

  it('the covered groups equal the set of modules with mutating non-public routes (cross-checked against the Express router)', () => {
    // Independent source: every POST/PUT/PATCH/DELETE the Express router serves.
    const served = [...registeredRoutes(t.app)].filter((k) => /^(POST|PUT|PATCH|DELETE) /.test(k))
    const derived = new Set<string>([...publicRoutes])
    for (const routes of groups.values()) for (const r of routes) derived.add(`${r.verb.toUpperCase()} ${normalisePath(r.path.replace(/\/1(?=\/|$)/g, '/:p'))}`)
    // Nothing served is missing from "public + a covered group"; nothing derived is unserved.
    expect(served.filter((k) => !derived.has(k))).toEqual([])
    expect([...derived].filter((k) => !served.includes(k))).toEqual([])
    expect([...groups.values()].every((l) => l.length > 0)).toBe(true)
  })

  it('the @Public mutating routes are exactly the pre-session auth routes (a new one needs a deliberate edit here)', () => {
    expect([...publicRoutes].sort()).toEqual(
      [
        'POST /auth/login',
        'POST /auth/logout',
        'POST /auth/password/email',
        'POST /auth/password/reset',
        'POST /auth/password/reset-ic',
        'POST /auth/register',
      ].sort(),
    )
  })

  it('logout with a valid session but a missing or wrong X-CSRF-Token: 403 CSRF_INVALID, and the session survives (G4 minor 2)', async () => {
    const user = await loginAs(t, 'guru@demo.test')
    const missing = await user.agent.post('/api/auth/logout').send({})
    expect(missing.status).toBe(403)
    expect(missing.body?.error?.code).toBe('CSRF_INVALID')
    const wrong = await user.agent.post('/api/auth/logout').set('X-CSRF-Token', `${user.csrf.slice(0, -2)}xx`).send({})
    expect(wrong.status).toBe(403)
    expect(wrong.body?.error?.code).toBe('CSRF_INVALID')
    expect((await user.agent.get('/api/session')).status).toBe(200)
    const ok = await user.agent.post('/api/auth/logout').set('X-CSRF-Token', user.csrf).send({})
    expect(ok.body?.error?.code).not.toBe('CSRF_INVALID')
    expect((await user.agent.get('/api/session')).status).toBe(401)
  })

  it('without the X-CSRF-Token header: 403 CSRF_INVALID on every mutating route of every module', async () => {
    const failures: string[] = []
    for (const [name, routes] of groups) {
      for (const r of routes) {
        const res = await send(r, null)
        if (res.status !== 403 || res.body?.error?.code !== 'CSRF_INVALID') {
          failures.push(`${name} ${r.label} -> ${String(res.status)} ${String(res.body?.error?.code)}`)
        }
      }
    }
    expect(failures).toEqual([])
  }, 120_000)

  it('with a wrong token: 403 CSRF_INVALID on every mutating route of every module', async () => {
    const failures: string[] = []
    const wrong = `${admin.csrf.slice(0, -2)}xx`
    expect(wrong).not.toBe(admin.csrf)
    for (const [name, routes] of groups) {
      for (const r of routes) {
        const res = await send(r, wrong)
        if (res.status !== 403 || res.body?.error?.code !== 'CSRF_INVALID') {
          failures.push(`${name} ${r.label} -> ${String(res.status)} ${String(res.body?.error?.code)}`)
        }
      }
    }
    expect(failures).toEqual([])
  }, 120_000)

  it('the same call with the right token is NOT a CSRF failure (the header is what decides)', async () => {
    const some = [...groups.values()].map((l) => l[0] as MutatingRoute)
    let notCsrf = 0
    for (const r of some) {
      const res = await send(r, admin.csrf)
      if (res.body?.error?.code !== 'CSRF_INVALID') notCsrf += 1
    }
    expect(notCsrf).toBe(some.length)
  }, 120_000)
})
