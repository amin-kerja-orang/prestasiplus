import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../openapi'

/**
 * OD-14 / DM-42 (S6-T16), contract level: a teacher's personal question is a store detail. No wire schema of the bank, the Studio, the pupil
 * practice, the counts or the reports carries the flag, its owner or its value, so no client can ask for, filter by or be shown a private
 * question through a bank route. (The only surface of personal questions is /guru/personal-questions, whose shape has no flag.)
 */
describe('the contract never exposes the personal-question flag', () => {
  const doc = buildOpenApiDocument() as unknown as { paths: Record<string, unknown>; components: { schemas: Record<string, { properties?: Record<string, unknown> }> } }
  const FORBIDDEN_PROPS = ['ownerUserId', 'owner_user_id', 'visibility']
  // `QuestionStructuredDetail.visibility` is the constant 'public' (a different, older field); the flag's only value is checked below.
  const ALLOWED = new Set(['QuestionStructuredDetail.visibility'])

  it('no question, practice, Studio, servability, stimulus, chapter or set schema has a visibility or owner property', () => {
    const related = /question|practice|studio|servab|stimul|chapter|databank|set|mission|bijak|spm/i
    for (const [name, schema] of Object.entries(doc.components.schemas).filter(([n]) => related.test(n))) {
      for (const prop of FORBIDDEN_PROPS) if (!ALLOWED.has(`${name}.${prop}`)) expect(Object.keys(schema.properties ?? {}), `${name}.${prop}`).not.toContain(prop)
    }
  })

  it('the value teacher_private is no enum value or example anywhere (a description may name it)', () => {
    const hits: string[] = []
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`))
      if (node === null || typeof node !== 'object') return
      for (const [k, v] of Object.entries(node)) {
        if ((k === 'enum' || k === 'const' || k === 'example' || k === 'default') && JSON.stringify(v).includes('teacher_private')) hits.push(`${path}.${k}`)
        walk(v, `${path}.${k}`)
      }
    }
    walk(doc, '$')
    expect(hits).toEqual([])
  })

  it('no bank query parameter (list, Studio, practice, counts) can select it', () => {
    const text = JSON.stringify(doc.paths)
    for (const prop of FORBIDDEN_PROPS) expect(text).not.toContain(`"name":"${prop}"`)
  })
})
