import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ACCESS_MATRIX } from '../index'

type Cell = 'F' | 'R' | 'S' | 'D' | undefined

/** Normalises a mode cell of v2-portals.md section 6: "F national" -> F, "S own school" -> S, "-" -> hidden. */
function normalise(raw: string): Cell {
  const text = raw.replace(/\*\*/g, '').trim()
  if (/^[—–-]/.test(text) || text === '') return undefined
  const m = /^([FRSD])(?![A-Za-z])/.exec(text)
  if (!m) throw new Error(`Unrecognised mode cell: "${raw}"`)
  return m[1] as Cell
}

const md = readFileSync(
  fileURLToPath(new URL('../../../../../docs/requirements/v2-portals.md', import.meta.url)),
  'utf8',
)
const section = md.slice(md.indexOf('## 6. Complete Portal'), md.indexOf('### 6.10'))

/** Item id -> [Pusat, PPD/JPN, Sekolah] cells, located through each table's own header row. */
function parseDocModes(): Map<string, [string, string, string]> {
  const out = new Map<string, [string, string, string]>()
  let cols: number[] | null = null
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith('|')) {
      cols = null
      continue
    }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells[0] === 'ID') {
      cols = [cells.indexOf('Pusat'), cells.indexOf('PPD·JPN'), cells.indexOf('Sekolah')]
      continue
    }
    const id = cells[0]
    if (!cols || !id || !/^[A-Z]{2}-\d{2}$/.test(id)) continue
    // A table without mode columns (6.9 Sistem) is headed "Pusat only": F / hidden / hidden.
    if ((cols[0] as number) < 0) out.set(id, ['F', '—', '—'])
    else out.set(id, [cols[0], cols[1], cols[2]].map((i) => cells[i as number] ?? '') as [string, string, string])
  }
  return out
}

describe('access matrix vs v2-portals.md section 6 mode cells', () => {
  const docModes = parseDocModes()

  it('finds a mode row for every item', () => {
    expect([...docModes.keys()]).toEqual(ACCESS_MATRIX.map((i) => i.id))
  })

  it('normalises the documented cell forms', () => {
    expect(normalise('F national')).toBe('F')
    expect(normalise('S own school (usage tabs only)')).toBe('S')
    expect(normalise('R PPD district; JPN — (Q7)')).toBe('R')
    expect(normalise('D R (pelajar+guru list)')).toBe('D')
    expect(normalise('—')).toBeUndefined()
  })

  it('matches the Pusat, PPD/JPN and Sekolah mode of every item', () => {
    for (const item of ACCESS_MATRIX) {
      const [admin, ppd, school] = docModes.get(item.id) as [string, string, string]
      expect({ id: item.id, modes: item.modes }).toEqual({
        id: item.id,
        modes: {
          ...(normalise(admin) ? { admin: normalise(admin) } : {}),
          ...(normalise(ppd) ? { ppd_officer: normalise(ppd) } : {}),
          ...(normalise(school) ? { school_admin: normalise(school) } : {}),
        },
      })
    }
  })
})
