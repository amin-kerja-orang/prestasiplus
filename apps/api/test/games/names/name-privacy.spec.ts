import type { RoleCode } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { canSeeName, displayName, type NameViewer, shownPupil } from '../../../src/modules/games/core/name-privacy'
import { initialsOf } from '../../../src/modules/games/core/names'

const viewer = (role: RoleCode, over: Partial<NameViewer> = {}): NameViewer => ({
  role,
  userId: '10',
  schoolId: '1',
  ownPupilIds: new Set(),
  ...over,
})
const pupil = { id: '20', name: 'Murid Contoh Alfa', schoolId: '1' }

describe('displayName (children\'s names rule)', () => {
  it('is first name + initial of the second word', () => {
    expect(displayName('Murid Contoh Alfa')).toBe('Murid C.')
    expect(displayName('Murid Demo')).toBe('Murid D.')
  })
  it('keeps a single word, trims and upper-cases the initial, survives blanks', () => {
    expect(displayName('Alfa')).toBe('Alfa')
    expect(displayName('  murid   contoh  ')).toBe('murid C.')
    expect(displayName('')).toBe('')
    expect(displayName('   ')).toBe('')
  })
  it('initials computed from the shown name leak no more than the shown name', () => {
    expect(initialsOf(displayName('Murid Contoh Alfa'))).toBe('MC')
    expect(initialsOf(displayName('Alfa'))).toBe('A')
  })
})

describe('canSeeName', () => {
  it('the pupil themself sees the own name, whatever the role', () => {
    for (const role of ['student', 'parent', 'ppd_officer', 'sponsor'] as const) {
      expect(canSeeName(viewer(role, { userId: '20' }), pupil), role).toBe(true)
    }
  })
  it('admin sees everyone', () => {
    expect(canSeeName(viewer('admin', { schoolId: null }), { ...pupil, schoolId: '9' })).toBe(true)
  })
  it('school_admin sees pupils of the own school only (never when either school is unknown)', () => {
    expect(canSeeName(viewer('school_admin'), pupil)).toBe(true)
    expect(canSeeName(viewer('school_admin'), { ...pupil, schoolId: '2' })).toBe(false)
    expect(canSeeName(viewer('school_admin'), { ...pupil, schoolId: null })).toBe(false)
    expect(canSeeName(viewer('school_admin', { schoolId: null }), { ...pupil, schoolId: null })).toBe(false)
  })
  it('teacher sees pupils of the own classes only, not the whole school', () => {
    expect(canSeeName(viewer('teacher', { ownPupilIds: new Set(['20']) }), pupil)).toBe(true)
    expect(canSeeName(viewer('teacher', { ownPupilIds: new Set(['21']) }), pupil)).toBe(false)
    expect(canSeeName(viewer('teacher'), pupil)).toBe(false)
  })
  it('every other role sees only the own row', () => {
    for (const role of ['student', 'parent', 'ppd_officer', 'sponsor'] as const) {
      expect(canSeeName(viewer(role, { ownPupilIds: new Set(['20']) }), pupil), role).toBe(false)
    }
  })
})

describe('shownPupil', () => {
  it('full name and real id within scope', () => {
    expect(shownPupil(viewer('admin'), pupil)).toEqual({ userId: '20', name: 'Murid Contoh Alfa' })
  })
  it('first name + initial and a null id outside the scope', () => {
    expect(shownPupil(viewer('student'), pupil)).toEqual({ userId: null, name: 'Murid C.' })
  })
  it('an adult account is not a child: shown in full to everyone', () => {
    expect(shownPupil(viewer('student'), { ...pupil, isPupil: false })).toEqual({ userId: '20', name: 'Murid Contoh Alfa' })
  })
  it('an unknown account type is protected (isPupil defaults to true)', () => {
    expect(shownPupil(viewer('parent'), { id: '20', name: 'Murid Contoh Alfa', schoolId: null })).toEqual({ userId: null, name: 'Murid C.' })
  })
})
