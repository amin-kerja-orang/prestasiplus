import type { ContractIndex, Operation } from '../contract-index'
import type { ActorRole } from '../http-client'
import type { Scenario } from '../runner'

/**
 * Smoke scenarios derived from the contract (BE-31 AC6): for every route group (OpenAPI tag) one
 * happy-path GET, plus one 401 (anonymous) and one 403 (a role without access) where the group's
 * chosen operation declares them. Because the groups come from `openapi.json`, a domain that
 * merges later is covered automatically; its card then adds deeper scenarios next to this file.
 *
 * The operation chosen per group is the first GET without path parameters that declares 200 and
 * no 422 (a 422 usually means a required query parameter).
 */

/** Operations whose allowed role is not the one the path prefix suggests (from the 403 text of the contract). */
const ALLOWED_ROLE: Record<string, ActorRole> = {
  'GET /question-reports': 'admin', // "Admin only"
  'GET /admin-sekolah/dashboard': 'school_admin',
  'GET /admin-sekolah/guru/pending': 'school_admin', // BE-21 AC13
  'GET /amaran/effectiveness': 'teacher', // admin, school_admin, teacher
  'GET /headcounts': 'teacher', // admin, teacher, school_admin
  'GET /monitoring/overview': 'teacher',
  'GET /kirkpatrick/reaction': 'teacher',
  'GET /cikgu/rph': 'teacher', // teacher or admin
  'GET /questions/summary': 'admin', // role list not stated in the contract: best guess
  'GET /intake/dashboard': 'admin', // Admin Pusat only; BE-40 (smoke picks this one op for the intake-dashboard tag)
}

/** A role that must get 403 where a student is allowed (default: student). */
const FORBIDDEN_ROLE: Record<string, ActorRole> = {
  'GET /buku-nota/heatmap': 'teacher', // student and admin only
  'GET /bijak/papers': 'teacher', // student (and admin / school_admin in Mod Pelajar) only
  'GET /bijak/history': 'teacher',
  'GET /me/parent-invite': 'teacher', // student only
  'GET /me/parent-links': 'teacher', // student and parent only (a student reads own links)
}

/**
 * Operations whose only 403 is PASSWORD_CHANGE_REQUIRED (every signed-in role gets it while the flag is set), so
 * there is no role that is simply "not allowed". The API conformance scenarios of the account domain cover it.
 */
const FLAG_ONLY_403 = new Set(['GET /me', 'GET /me/settings', 'GET /me/notifications', 'GET /me/notifications/unread-count'])

/** Required query parameters (the contract marks them 422 when missing). */
const QUERY: Record<string, string> = {
  'GET /practice/sessions': '?modes=random,chapter',
}

/** The role that should be allowed on a path, judged from its prefix. */
function allowedRole(op: Operation): ActorRole {
  const override = ALLOWED_ROLE[op.key]
  if (override) return override
  if (op.path.startsWith('/admin')) return 'admin'
  if (op.path.startsWith('/guru')) return 'teacher'
  return 'student'
}

export function smokeScenarios(contract: ContractIndex): Scenario[] {
  const byTag = new Map<string, Operation>()
  const getOps = contract.operations.filter(
    (op) => op.method === 'GET' && !op.path.includes('{') && '200' in op.responses,
  )
  // Prefer a GET with no 422 (no required query); fall back to any param-free GET.
  for (const op of [...getOps.filter((o) => !('422' in o.responses)), ...getOps]) {
    if (!byTag.has(op.tag)) byTag.set(op.tag, op)
  }

  const out: Scenario[] = []
  // A group with no param-free GET (only writes): prove at least that it refuses anonymous calls.
  for (const op of contract.operations) {
    if (op.tag === 'auth' || byTag.has(op.tag) || !('401' in op.responses)) continue
    byTag.set(op.tag, op)
    out.push({
      id: `${op.tag}/${op.key} anonymous -> 401`,
      domain: op.tag,
      async run(ctx) {
        ctx.expectStatus(
          await ctx.anonymous().request(op.method, op.path + (QUERY[op.key] ?? '')),
          401,
        )
      },
    })
  }
  for (const [tag, op] of [...byTag].filter(([, o]) => getOps.includes(o))) {
    const needsAuth = '401' in op.responses
    const role = allowedRole(op)
    out.push({
      id: `${tag}/${op.key} -> 200`,
      domain: tag,
      async run(ctx) {
        const client = needsAuth ? await ctx.as(role) : ctx.anonymous()
        ctx.expectStatus(await client.request(op.method, op.path + (QUERY[op.key] ?? '')), 200)
      },
    })
    if (needsAuth) {
      out.push({
        id: `${tag}/${op.key} anonymous -> 401`,
        domain: tag,
        async run(ctx) {
          ctx.expectStatus(
            await ctx.anonymous().request(op.method, op.path + (QUERY[op.key] ?? '')),
            401,
          )
        },
      })
    }
    if ('403' in op.responses && !FLAG_ONLY_403.has(op.key)) {
      // A student reaches no admin or teacher route; FORBIDDEN_ROLE lists the exceptions.
      const forbidden = FORBIDDEN_ROLE[op.key] ?? 'student'
      out.push({
        id: `${tag}/${op.key} as ${forbidden} -> 403`,
        domain: tag,
        async run(ctx) {
          const client = await ctx.as(forbidden)
          ctx.expectStatus(await client.request(op.method, op.path + (QUERY[op.key] ?? '')), 403)
        },
      })
    }
  }
  return out
}
