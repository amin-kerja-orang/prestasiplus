import { describe, expect, it } from 'vitest'

import type { GuruStudent } from '../../api/types'
import { chipsOf, isInClass } from '../../components/pelajar/student-classes'

const base: GuruStudent = { id: 1, name: 'Murid Demo 01', levelName: null, classNames: [] }

describe('student class chips (SW5-03)', () => {
  it('keys the chips by class id, so two classes with the same name stay apart', () => {
    const student: GuruStudent = {
      ...base,
      classNames: ['Kelas Kembar', 'Kelas Kembar'],
      classes: [
        { id: 11, name: 'Kelas Kembar' },
        { id: 12, name: 'Kelas Kembar' },
      ],
    }
    const chips = chipsOf(student)
    expect(chips.map((c) => c.id)).toEqual([11, 12])
    expect(new Set(chips.map((c) => c.key)).size).toBe(2)
  })

  it('falls back to the names, each with a distinct key and no id, when classes is absent', () => {
    const chips = chipsOf({ ...base, classNames: ['A', 'A'] })
    expect(chips.map((c) => [c.id, c.name])).toEqual([
      [null, 'A'],
      [null, 'A'],
    ])
    expect(new Set(chips.map((c) => c.key)).size).toBe(2)
  })

  it('isInClass compares the class id, not the name', () => {
    const student: GuruStudent = {
      ...base,
      classNames: ['Kelas Kembar'],
      classes: [{ id: 11, name: 'Kelas Kembar' }],
    }
    expect(isInClass(student, { id: '11', name: 'Kelas Kembar' })).toBe(true)
    expect(isInClass(student, { id: '12', name: 'Kelas Kembar' })).toBe(false)
    expect(isInClass(student, { id: '', name: null })).toBe(false)
  })

  it('isInClass falls back to the name when classes is absent', () => {
    const student: GuruStudent = { ...base, classNames: ['Kelas A'] }
    expect(isInClass(student, { id: '5', name: 'Kelas A' })).toBe(true)
    expect(isInClass(student, { id: '6', name: 'Kelas B' })).toBe(false)
    expect(isInClass(student, { id: '', name: null })).toBe(false)
  })
})
