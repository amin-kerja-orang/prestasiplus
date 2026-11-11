import { describe, expect, it } from 'vitest'

import { groupIssuesOf } from '../../src/modules/exam/builder/paper-check'

/** The pure group rules shared by the paper check and the regroup guard: one case per code. */
describe('groupIssuesOf', () => {
  const groupOf = (id: string) => (['a', 'b', 'c'].includes(id) ? 'G' : undefined)
  const members = () => ['a', 'b', 'c']
  const codes = (sections: string[][]) => groupIssuesOf(sections.map((questionIds) => ({ questionIds })), groupOf, members).map((i) => i.code)

  it('a complete, consecutive, ordered group has no issue', () => {
    expect(codes([['x', 'a', 'b', 'c', 'y']])).toEqual([])
  })
  it('GROUP_INCOMPLETE: a member is missing from the section', () => {
    expect(codes([['a', 'b']])).toEqual(['GROUP_INCOMPLETE'])
  })
  it('GROUP_NOT_CONSECUTIVE: another question sits between members', () => {
    expect(codes([['a', 'x', 'b', 'c']])).toContain('GROUP_NOT_CONSECUTIVE')
  })
  it('GROUP_OUT_OF_ORDER: the members run in another order than the group', () => {
    expect(codes([['b', 'a', 'c']])).toEqual(['GROUP_OUT_OF_ORDER'])
  })
  it('GROUP_SPLIT: the members are in more than one section', () => {
    expect(codes([['a', 'b'], ['c']])).toContain('GROUP_SPLIT')
  })
})
