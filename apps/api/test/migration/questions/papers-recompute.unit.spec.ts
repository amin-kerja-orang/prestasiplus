/** M-A: the pure parts of the papers recompute: merging V2 placements into the stored ones (add, repoint, never remove or reorder) and completing split groups. */
import { describe, expect, it } from 'vitest'

import { parseArgs } from '../../../src/migration/cli'
import { parsePapersArgs } from '../../../src/migration/load/papers/command'

import { completeGroups, mergeSection, type CurrentPlacement } from '../../../src/migration/load/papers/papers-recompute'
import type { PlacementPlan, SectionPlan } from '../../../src/migration/load/papers/papers-step'

const cur = (...ids: string[]): CurrentPlacement[] => ids.map((question_id, i) => ({ question_id, position: i + 1, number_label: null, marks_override: null, pinned_version_no: 1 }))
const plan = (...ids: (string | [string, string])[]): PlacementPlan[] =>
  ids.map((x) => (typeof x === 'string' ? { question_id: x, number_label: null, marks_override: null } : { question_id: x[0], number_label: null, marks_override: null, was: x[1] }))
const shape = (m: ReturnType<typeof mergeSection>): string[] => m.map((e) => `${e.question_id}:${e.kind}`)

describe('mergeSection', () => {
  it('keeps the stored order and adds a missing question at its V2 place', () => {
    expect(shape(mergeSection(cur('1', '3'), plan('1', '2', '3')))).toEqual(['1:kept', '2:added', '3:kept'])
    expect(shape(mergeSection(cur('2'), plan('1', '2')))).toEqual(['1:added', '2:kept'])
  })

  it('never removes or reorders a stored placement that V2 does not list', () => {
    expect(shape(mergeSection(cur('9', '1'), plan('1', '2')))).toEqual(['9:kept', '1:kept', '2:added'])
    expect(shape(mergeSection(cur('3', '1'), plan('1', '2', '3')))).toEqual(['3:kept', '1:kept', '2:added'])
  })

  it('repoints a placement on the wrong dedupe question in place', () => {
    const m = mergeSection(cur('1', '5', '3'), plan('1', ['2', '5'], '3'))
    expect(shape(m)).toEqual(['1:kept', '2:repointed', '3:kept'])
    expect(m[1]?.from).toBe('5')
  })

  it('changes nothing when the paper already matches', () => {
    expect(shape(mergeSection(cur('1', '2'), plan('1', '2')))).toEqual(['1:kept', '2:kept'])
  })
})

describe('completeGroups', () => {
  const section = (...ids: string[]): SectionPlan => ({ label: 'A', instruction: null, rule_type: 'all', rule_n: null, mark_budget: null, placements: plan(...ids) })
  const facts = { groupOf: new Map([['1', 'g'], ['2', 'g'], ['3', 'g']]), members: new Map([['g', ['1', '2', '3']]]) }

  it('adds the members the paper does not place, for a group it places a member of', () => {
    expect(completeGroups([section('1', '9')], facts)[0]?.placements.map((p) => p.question_id)).toEqual(['1', '9', '2', '3'])
  })

  it('does not move a member that sits in another section (that group stays split)', () => {
    const out = completeGroups([section('1'), section('2')], facts)
    expect(out[0]?.placements.map((p) => p.question_id)).toEqual(['1', '3'])
    expect(out[1]?.placements.map((p) => p.question_id)).toEqual(['2'])
  })

  it('leaves a paper without a group untouched', () => {
    const s = section('7', '8')
    expect(completeGroups([s], facts)[0]).toBe(s)
  })
})

describe('migrate:papers --recompute', () => {
  const parse = (argv: string[], env: Record<string, string | undefined> = {}) => parsePapersArgs(parseArgs(['migrate:papers', ...argv]).args, (d) => d, env).recompute
  it('is OFF by default, ON with --recompute or PP_MIGRATE_PAPERS_RECOMPUTE=1', () => {
    expect(parse(['--apply'])).toBe(false)
    expect(parse(['--apply', '--recompute'])).toBe(true)
    expect(parse(['--apply'], { PP_MIGRATE_PAPERS_RECOMPUTE: '1' })).toBe(true)
    expect(parse(['--apply'], { PP_MIGRATE_PAPERS_RECOMPUTE: '0' })).toBe(false)
  })

  it('refuses a value: --recompute=false is an error, never "off"', () => {
    expect(() => parse(['--apply', '--recompute=false'])).toThrow(/takes no value/)
    expect(() => parse(['--apply', '--recompute=0'])).toThrow(/takes no value/)
    expect(() => parse(['--apply', '--recompute', 'false'])).toThrow()
  })
})
