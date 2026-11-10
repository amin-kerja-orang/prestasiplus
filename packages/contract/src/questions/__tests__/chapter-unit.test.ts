import { describe, expect, it } from 'vitest'

import { leadingNumber, unitsOfChapter } from '../chapter-unit'

const units = (...codes: string[]) => codes.map((code) => ({ code, title: `Unit ${code}` }))
const chapters = (...numbers: (number | null)[]) => numbers.map((chapterNumber) => ({ chapterNumber }))

describe('leadingNumber', () => {
  it('reads the number before the first dot', () => {
    expect(leadingNumber('7.0')).toBe('7')
    expect(leadingNumber(' 07.1.3')).toBe('7')
    expect(leadingNumber('Bab')).toBeNull()
    expect(leadingNumber(null)).toBeNull()
  })
})

describe('unitsOfChapter (G-02: Topik follows Bab)', () => {
  const mat = units('1.0', '2.0', '3.0')
  const matChapters = chapters(1, 2, 3)

  it('one unit per chapter number: Bab 3 offers only unit 3.0', () => {
    expect(unitsOfChapter({ chapterNumber: 3 }, matChapters, mat)?.map((u) => u.code)).toEqual(['3.0'])
  })

  it('a printed DSKP code on the chapter wins and may match several units', () => {
    const all = units('1.0', '2.0', '2.1', '3.0')
    expect(unitsOfChapter({ chapterNumber: 9, dskpCode: '2.0' }, chapters(9), all)?.map((u) => u.code)).toEqual(['2.0', '2.1'])
  })

  it('a printed code with no unit is unknown, not an empty list', () => {
    expect(unitsOfChapter({ chapterNumber: 1, dskpCode: '9.0' }, chapters(1), mat)).toBeNull()
  })

  it('one catch-all chapter for a whole level has no link (nothing is filtered)', () => {
    expect(unitsOfChapter({ chapterNumber: 1 }, chapters(1), mat)).toBeNull()
  })

  it('chapters and units that are not one to one have no link', () => {
    expect(unitsOfChapter({ chapterNumber: 1 }, chapters(1, 2), mat)).toBeNull()
    expect(unitsOfChapter({ chapterNumber: 1 }, chapters(1, 2, 4), mat)).toBeNull()
    expect(unitsOfChapter({ chapterNumber: 1 }, chapters(1, 1, 2), mat)).toBeNull()
  })

  it('a chapter without a number has no link', () => {
    expect(unitsOfChapter({ chapterNumber: null }, chapters(1, 2, 3), mat)).toBeNull()
  })
})
