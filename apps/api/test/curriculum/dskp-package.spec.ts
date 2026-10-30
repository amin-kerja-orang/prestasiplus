import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DSKP_DATA_DIR, DSKP_FILES, hashText, readDskpSources } from '../../src/modules/curriculum/dskp/dskp-load'

const PACKAGED = fileURLToPath(DSKP_DATA_DIR)
const REFERENCE = fileURLToPath(new URL('../../../../docs/reference/dskp/', import.meta.url))
const jsonIn = (dir: string): string[] => readdirSync(dir).filter((f) => f.endsWith('.json')).sort()

describe('packaged DSKP data (R1-B04)', () => {
  it('has the same 13 files as docs/reference/dskp', () => {
    expect(jsonIn(PACKAGED)).toHaveLength(13)
    expect(jsonIn(PACKAGED)).toEqual(jsonIn(REFERENCE))
  })

  it('every packaged file is byte-identical (line endings aside) to docs/reference/dskp: a drifting copy fails', () => {
    for (const file of jsonIn(REFERENCE)) {
      const packaged = hashText(readFileSync(PACKAGED + file, 'utf8'))
      const reference = hashText(readFileSync(REFERENCE + file, 'utf8'))
      expect(packaged, `${file} differs from docs/reference/dskp: copy it again`).toBe(reference)
    }
  })

  it('maps every packaged file to a subject code and parses it', () => {
    expect(DSKP_FILES.map((f) => f.file).sort()).toEqual(jsonIn(PACKAGED))
    const sources = readDskpSources()
    expect(sources).toHaveLength(13)
    for (const s of sources) {
      expect(s.error, s.file).toBeNull()
      expect(s.subjectCode, s.file).not.toBeNull()
      expect(s.sha256, s.file).toMatch(/^[0-9a-f]{64}$/)
      expect(s.extract?.ignored, s.file).toEqual([])
    }
  })
})
