import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { XS_ALL_TIME, xsAccuracy } from '../../src/modules/school-admin/xs-queries'

/**
 * Pure specs of S6-T03 (no database, no Docker): the XS-5 rounding rule and AC-XS-3 (no hard-coded display constant for the
 * cross-screen measures in the API production code of the school admin and the Command Center).
 */

describe('xsAccuracy (XS-5): pooled, one decimal, half up, null without answers, never above 100', () => {
  it.each([
    [37, 50, 74],
    [2, 3, 66.7],
    [6, 10, 60],
    [1, 1, 100],
    [1, 2, 50],
    [4, 7, 57.1],
    [5, 9, 55.6],
    [1, 8, 12.5],
    [1, 16, 6.3], // 6.25 rounds up (half up), not to the even 6.2
    [1, 32, 3.1], // 3.125
    [1157, 2000, 57.9], // 57.85 is an exact half in decimal; floating point must not push it down
    [1, 3, 33.3],
    [2, 3, 66.7],
    [0, 5, 0],
  ])('%i correct of %i answers is %f', (correct, answered, expected) => {
    expect(xsAccuracy(correct, answered)).toBe(expected)
  })

  it('is null (shown "—") with no answers, never 0', () => {
    expect(xsAccuracy(0, 0)).toBeNull()
    expect(xsAccuracy(3, 0)).toBeNull()
  })

  it('is never above 100, even for inconsistent counts', () => {
    expect(xsAccuracy(7, 5)).toBe(100)
  })

  it('never has two decimals: x10 is a whole number for every pair up to 60 answers', () => {
    for (let answered = 1; answered <= 60; answered++) {
      for (let correct = 0; correct <= answered; correct++) {
        const v = xsAccuracy(correct, answered) as number
        expect(Math.abs(v * 10 - Math.round(v * 10)), `${correct}/${answered}`).toBeLessThan(1e-9)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(100)
      }
    }
  })

  it('AC-X4-2: per pupil 100, 50 and 57 on screen, and 60 pooled (not the mean of the rounded values)', () => {
    const pupils = [
      { answered: 1, correct: 1 },
      { answered: 2, correct: 1 },
      { answered: 7, correct: 4 },
    ]
    expect(pupils.map((p) => Math.round(xsAccuracy(p.correct, p.answered) as number))).toEqual([100, 50, 57])
    const answered = pupils.reduce((n, p) => n + p.answered, 0)
    const correct = pupils.reduce((n, p) => n + p.correct, 0)
    expect(xsAccuracy(correct, answered)).toBe(60)
  })

  it('the all-time window has no bounds', () => {
    expect(XS_ALL_TIME).toEqual({ from: null, to: null })
  })
})

// --- AC-XS-3 ---------------------------------------------------------------------------------------------------------------

const SRC = fileURLToPath(new URL('../../src/modules/', import.meta.url))

function productionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : productionFiles(path)
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : []
  })
}

/** Source text without comments and string contents' quotes kept (a comment may quote a number; code may not hold one). */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(\s)\/\/ .*$/gm, '$1')
}

const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')

describe('AC-XS-3: no hard-coded display constant for XS-1..XS-8 (API production code)', () => {
  it('the screens read the measures from xs-queries.ts: the population, the dashboard and the Command Center import it', () => {
    const importers = [
      'school-admin/reports/population.ts',
      'school-admin/dashboard.service.ts',
      'school-admin/reports/windows.ts',
      'command-center/shared/command-center.repository.ts',
      'command-center/board/reads.ts',
      'command-center/board/board.service.ts',
      'command-center/shared/math.ts',
    ]
    for (const file of importers) expect(read(file), file).toMatch(/from '(?:\.{1,2}\/)+(?:school-admin\/)?xs-queries'/)
  })

  it('no school-admin or command-center file defines a DISPLAY_ constant or a DC_ display-constant object for these measures', () => {
    const offenders: string[] = []
    for (const dir of ['school-admin', 'command-center']) {
      for (const file of productionFiles(join(SRC, dir))) {
        const text = code(file)
        if (/\bDISPLAY_[A-Z0-9_]+\b/.test(text)) offenders.push(`${relative(SRC, file)}: DISPLAY_ constant`)
        // A constant object whose keys are the XS measures and whose values are non-zero numbers.
        const literal = /\b(?:totalStudents|totalAnswered|activeStudents|totalAnswers|pupils|students|teachers|answers|questionsTested|accuracy)\s*:\s*(?!0\b)\d+(?:\.\d+)?\s*[,}]/g
        for (const m of text.matchAll(literal)) offenders.push(`${relative(SRC, file)}: ${m[0].trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the one remaining observed display constant (platform "Pembetulan", DC_M17_03) is not one of XS-1..XS-8', () => {
    const text = code(join(SRC, 'command-center/board/board.service.ts'))
    expect(text).toMatch(/DC_M17_03 = Object\.freeze\(\{ total: 899, avgImprovement: 0, improvedCount: 0 \}\)/)
    // It carries no pupil, teacher, answer or accuracy key.
    expect(text.match(/DC_M17_03 = Object\.freeze\(\{([^}]*)\}\)/)?.[1]).not.toMatch(/pupils|students|teachers|answers|accuracy/i)
  })
})
