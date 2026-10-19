import type { ContractIndex } from './contract-index'
import { findLegacyKeys } from './guards'
import type {
  ActorRole,
  HttpClient,
  HttpMethod,
  HttpRequestInit,
  HttpResponse,
  Target,
} from './http-client'

export type ViolationKind =
  'schema' | 'legacy_key' | 'unknown_operation' | 'undocumented_status' | 'assertion' | 'error'

export interface Violation {
  kind: ViolationKind
  /** `GET /articles/{slug}`, or null when the path is not in the contract. */
  operation: string | null
  status?: number
  message: string
}

/** A response annotated with the operation it matched. */
export interface CheckedResponse extends HttpResponse {
  operation: string | null
}

export interface ScenarioContext {
  /** A client with no credentials; every response is checked against the contract. */
  anonymous(): HttpClient
  /** A client logged in as a seeded account of this role; every response is checked. */
  as(role: ActorRole): Promise<HttpClient>
  /** Credentials of the seeded account of this role on this target. */
  credentials(role: ActorRole): { identifier: string; password: string }
  /** Records an `assertion` violation unless the response has the expected status. */
  expectStatus(res: HttpResponse, status: number): void
  /** Records an `assertion` violation when `ok` is false. */
  check(ok: boolean, message: string): void
}

export interface Scenario {
  /** Unique and stable: it is the key of `knownMismatches`. */
  id: string
  /** Route group / domain, for the report. */
  domain: string
  run(ctx: ScenarioContext): Promise<void>
}

/** A mismatch that is understood and tracked. The runner reports it apart from real failures. */
export interface KnownMismatch {
  scenario: string
  /** Narrow the entry to one kind of violation; omit to cover every violation of the scenario. */
  kind?: ViolationKind
  /** Which side looks wrong, and why. */
  reason: string
}

export interface ScenarioResult {
  id: string
  domain: string
  violations: Violation[]
  known: Violation[]
  failures: Violation[]
}

export interface RunReport {
  target: string
  results: ScenarioResult[]
  /** `METHOD path` of every operation some scenario sent a request to, with the statuses seen. */
  touched: Map<string, Set<number>>
  /** Known-mismatch entries that no longer match any violation (the mismatch was fixed). */
  stale: KnownMismatch[]
  ok: boolean
}

export interface RunOptions {
  target: Target
  contract: ContractIndex
  knownMismatches?: KnownMismatch[]
}

/** Runs every scenario against the target and checks every response against the contract. */
export async function runScenarios(
  scenarios: Scenario[],
  { target, contract, knownMismatches = [] }: RunOptions,
): Promise<RunReport> {
  const touched = new Map<string, Set<number>>()
  const results: ScenarioResult[] = []

  for (const scenario of scenarios) {
    const violations: Violation[] = []
    const wrap = (client: HttpClient): HttpClient => ({
      async request(method: HttpMethod, path: string, init?: HttpRequestInit) {
        const res = await client.request(method, path, init)
        return checkResponse(contract, violations, touched, method, path, res)
      },
    })
    const ctx: ScenarioContext = {
      anonymous: () => wrap(target.anonymous),
      as: async (role) => wrap(await target.actor(role)),
      credentials: (role) => target.credentials(role),
      expectStatus(res, status) {
        if (res.status !== status) {
          violations.push({
            kind: 'assertion',
            operation: (res as CheckedResponse).operation ?? null,
            status: res.status,
            message: `expected HTTP ${String(status)}, got ${String(res.status)}`,
          })
        }
      },
      check(ok, message) {
        if (!ok) violations.push({ kind: 'assertion', operation: null, message })
      },
    }
    try {
      await scenario.run(ctx)
    } catch (err) {
      violations.push({
        kind: 'error',
        operation: null,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    results.push({ id: scenario.id, domain: scenario.domain, violations, known: [], failures: [] })
  }

  const used = new Set<KnownMismatch>()
  for (const r of results) {
    for (const v of r.violations) {
      const hit = knownMismatches.find(
        (k) => k.scenario === r.id && (k.kind === undefined || k.kind === v.kind),
      )
      if (hit) {
        used.add(hit)
        r.known.push(v)
      } else r.failures.push(v)
    }
  }
  const stale = knownMismatches.filter((k) => !used.has(k))
  return {
    target: target.name,
    results,
    touched,
    stale,
    ok: results.every((r) => r.failures.length === 0) && stale.length === 0,
  }
}

function checkResponse(
  contract: ContractIndex,
  out: Violation[],
  touched: Map<string, Set<number>>,
  method: HttpMethod,
  path: string,
  res: HttpResponse,
): CheckedResponse {
  const op = contract.match(method, path)
  const operation = op?.key ?? null
  const base = { operation, status: res.status }

  for (const p of findLegacyKeys(res.body)) {
    out.push({ ...base, kind: 'legacy_key', message: `body exposes a legacy_ key at ${p}` })
  }
  if (!op) {
    out.push({
      ...base,
      kind: 'unknown_operation',
      message: `${method} ${path} is not in openapi.json`,
    })
    return { ...res, operation }
  }
  const seen = touched.get(op.key) ?? new Set<number>()
  seen.add(res.status)
  touched.set(op.key, seen)

  if (!contract.declares(op, res.status)) {
    out.push({
      ...base,
      kind: 'undocumented_status',
      message: `contract declares ${Object.keys(op.responses).join(', ')} for ${op.key}, got ${String(res.status)}`,
    })
    return { ...res, operation }
  }
  const schema = contract.schemaFor(op, res.status)
  if (schema) {
    const parsed = schema.safeParse(res.body)
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')
      out.push({
        ...base,
        kind: 'schema',
        message: `body does not match the contract schema: ${issues}`,
      })
    }
  } else if (
    (op.responses[String(res.status)] ?? op.responses.default) === false &&
    res.body !== null &&
    res.body !== undefined &&
    res.body !== ''
  ) {
    out.push({
      ...base,
      kind: 'schema',
      message: `contract defines no JSON body for ${String(res.status)}, got one`,
    })
  }
  return { ...res, operation }
}
