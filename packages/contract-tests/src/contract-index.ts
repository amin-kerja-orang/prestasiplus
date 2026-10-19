import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { z } from 'zod'

import type { HttpMethod } from './http-client'

type Json = Record<string, unknown>

export interface Operation {
  /** `GET /articles/{slug}`: the identity used in coverage and known-mismatch lists. */
  key: string
  method: HttpMethod
  /** Path template relative to the server base, for example `/articles/{slug}`. */
  path: string
  tag: string
  /** Declared status codes, each mapped to whether the contract defines a JSON body for it. */
  responses: Record<string, boolean>
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
const REF_FROM = '#/components/schemas/'
const REF_TO = '#/$defs/'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * zod-to-openapi writes a nullable reference as `allOf: [{ $ref }, { type: [T, "null"] }]`. As JSON
 * Schema that rejects null (the referenced schema does not allow it), although zod accepts it.
 * 61 places in openapi.json have this shape. Remove this workaround once the emitter writes anyOf. The runner reads it the way the
 * zod schema means it: `anyOf: [{ $ref }, { type: "null" }]`.
 */
export function fixNullableRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fixNullableRefs)
  if (value === null || typeof value !== 'object') return value
  const obj = value as Json
  const allOf = obj.allOf
  if (Array.isArray(allOf) && allOf.length === 2) {
    const [ref, rest] = allOf as [Json, Json]
    const type = rest.type
    if (typeof ref.$ref === 'string' && Array.isArray(type) && type.includes('null')) {
      const others = { ...obj }
      delete others.allOf
      return { ...(fixNullableRefs(others) as Json), anyOf: [ref, { type: 'null' }] }
    }
  }
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fixNullableRefs(v)]))
}

function jsonSchemaOf(response: Json | undefined): unknown {
  const content = response?.content as Record<string, Json> | undefined
  return content?.['application/json']?.schema
}

/** The contract as the runner needs it: operations, path matching and response schemas. */
export class ContractIndex {
  readonly operations: Operation[] = []
  private readonly raw = new Map<string, Json>()
  private readonly matchers: { op: Operation; re: RegExp; statics: number }[] = []
  private readonly defs: Json
  private readonly cache = new Map<string, z.ZodType | null>()

  constructor(readonly spec: Json) {
    const schemas = (spec.components as Json | undefined)?.schemas ?? {}
    this.defs = fixNullableRefs(
      JSON.parse(JSON.stringify(schemas).replaceAll(REF_FROM, REF_TO)),
    ) as Json
    for (const [path, item] of Object.entries(spec.paths as Json)) {
      for (const m of METHODS) {
        const entry = (item as Json)[m] as Json | undefined
        if (!entry) continue
        const method = m.toUpperCase() as HttpMethod
        const responses = (entry.responses ?? {}) as Record<string, Json>
        const op: Operation = {
          key: `${method} ${path}`,
          method,
          path,
          tag: String(((entry.tags as string[] | undefined) ?? ['untagged'])[0]),
          responses: Object.fromEntries(
            Object.entries(responses).map(([s, r]) => [s, Boolean(jsonSchemaOf(r))]),
          ),
        }
        this.operations.push(op)
        this.raw.set(op.key, entry)
        const segs = path.split('/').filter(Boolean)
        const pattern = segs.map((s) => (s.startsWith('{') ? '[^/]+' : escapeRe(s))).join('/')
        this.matchers.push({
          op,
          statics: segs.filter((s) => !s.startsWith('{')).length,
          re: new RegExp(`^/${pattern}/?$`),
        })
      }
    }
  }

  /** Reads `openapi.json` from `@pp/contract` (or from an explicit file). */
  static load(file?: string): ContractIndex {
    const path = file ?? createRequire(import.meta.url).resolve('@pp/contract/openapi.json')
    return new ContractIndex(JSON.parse(readFileSync(path, 'utf8')) as Json)
  }

  /** The operation a request belongs to (static segments win over `{params}`), or null. */
  match(method: HttpMethod, rawPath: string): Operation | null {
    const path = rawPath.split(/[?#]/)[0] ?? rawPath
    let best: { op: Operation; statics: number } | null = null
    for (const c of this.matchers) {
      if (c.op.method === method && c.re.test(path) && (!best || c.statics > best.statics)) best = c
    }
    return best?.op ?? null
  }

  /**
   * The zod schema the contract registers for this status of the operation, or null when the
   * contract defines no JSON body for it (204, binary downloads). Built from the emitted
   * `openapi.json` with `z.fromJSONSchema`, so the same check runs for every target.
   */
  schemaFor(op: Operation, status: number): z.ZodType | null {
    const key = `${op.key} ${String(status)}`
    if (this.cache.has(key)) return this.cache.get(key) ?? null
    const responses = (this.raw.get(op.key)?.responses ?? {}) as Record<string, Json>
    const found = jsonSchemaOf(responses[String(status)] ?? responses.default)
    let schema: z.ZodType | null = null
    if (found) {
      const body = fixNullableRefs(
        JSON.parse(JSON.stringify(found).replaceAll(REF_FROM, REF_TO)),
      ) as Json
      schema = z.fromJSONSchema({ ...body, $defs: this.defsFor(body) } as never) as z.ZodType
    }
    this.cache.set(key, schema)
    return schema
  }

  /** Only the component schemas reachable from `root` (keeps each conversion small). */
  private defsFor(root: unknown): Json {
    const out: Json = {}
    const queue: unknown[] = [root]
    while (queue.length) {
      const text = JSON.stringify(queue.pop())
      for (const m of text.matchAll(/"\$ref":"#\/\$defs\/([^"]+)"/g)) {
        const name = m[1] as string
        if (!(name in out) && name in this.defs) {
          out[name] = this.defs[name]
          queue.push(this.defs[name])
        }
      }
    }
    return out
  }

  /** True when the contract declares this status for the operation (or a `default`). */
  declares(op: Operation, status: number): boolean {
    return String(status) in op.responses || 'default' in op.responses
  }
}
