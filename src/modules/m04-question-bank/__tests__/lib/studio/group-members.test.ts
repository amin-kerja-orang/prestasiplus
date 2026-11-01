import { describe, expect, it } from 'vitest'

import {
  addMember,
  GROUP_MEMBER_MESSAGES,
  isComplete,
  MAX_GROUP_MEMBERS,
  memberIds,
  memberIssues,
  membersChanged,
  moveMember,
  removeMember,
  type GroupMember,
} from '../../../lib/studio/group-members'

const m = (id: string): GroupMember => ({ id, numberLabel: id, stem: `Soalan ${id}` })
const ids = (list: readonly GroupMember[]): string[] => memberIds(list)

describe('group members (D90)', () => {
  it('a stimulus is a group only with two or more questions', () => {
    expect(isComplete([m('1')])).toBe(false)
    expect(memberIssues([m('1')])).toEqual([GROUP_MEMBER_MESSAGES.needsTwo])
    expect(isComplete([m('1'), m('2')])).toBe(true)
    expect(memberIssues([m('1'), m('2')])).toEqual([])
  })

  it('adds at the end or at a place, once', () => {
    const base = [m('1'), m('2')]
    const end = addMember(base, m('3'))
    expect(end.ok && ids(end.members)).toEqual(['1', '2', '3'])
    const first = addMember(base, m('3'), 0)
    expect(first.ok && ids(first.members)).toEqual(['3', '1', '2'])
    const beyond = addMember(base, m('3'), 99)
    expect(beyond.ok && ids(beyond.members)).toEqual(['1', '2', '3'])
    expect(addMember(base, m('2'))).toEqual({ ok: false, message: GROUP_MEMBER_MESSAGES.duplicate })
    expect(ids(base)).toEqual(['1', '2'])
  })

  it('stops at 20 members', () => {
    const full = Array.from({ length: MAX_GROUP_MEMBERS }, (_v, i) => m(String(i + 1)))
    expect(addMember(full, m('99'))).toEqual({ ok: false, message: GROUP_MEMBER_MESSAGES.full })
  })

  it('removes a member and keeps the order of the rest', () => {
    expect(ids(removeMember([m('1'), m('2'), m('3')], '2'))).toEqual(['1', '3'])
    expect(ids(removeMember([m('1')], 'x'))).toEqual(['1'])
  })

  it('moves a member up and down and stops at the ends', () => {
    const base = [m('1'), m('2'), m('3')]
    expect(ids(moveMember(base, '3', -1))).toEqual(['1', '3', '2'])
    expect(ids(moveMember(base, '1', 1))).toEqual(['2', '1', '3'])
    expect(ids(moveMember(base, '1', -1))).toEqual(['1', '2', '3'])
    expect(ids(moveMember(base, '3', 1))).toEqual(['1', '2', '3'])
    expect(ids(moveMember(base, '1', 5))).toEqual(['2', '3', '1'])
    expect(ids(moveMember(base, 'x', 1))).toEqual(['1', '2', '3'])
    expect(ids(base)).toEqual(['1', '2', '3'])
  })

  it('tells a saved list from an edited one by membership and order', () => {
    const saved = [m('1'), m('2')]
    expect(membersChanged(saved, [m('1'), m('2')])).toBe(false)
    expect(membersChanged(saved, [m('2'), m('1')])).toBe(true)
    expect(membersChanged(saved, [m('1')])).toBe(true)
    expect(membersChanged(saved, [m('1'), m('2'), m('3')])).toBe(true)
  })
})
