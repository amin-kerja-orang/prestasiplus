/**
 * CHK-M27-01 (SRS M27 v1.3 §12; FR-M27-27, NFR-M27-04, AC-M27-08.6): a static scan of the M27-owned files
 * (`src/modules/m27-*`, `e2e/m27-*`; the M27 docs are scanned too when present).
 *
 * (a) No e-mail other than `@demo.test`, so no real person's name is present (fixtures are referenced by id).
 * (b) The screenshot's and the deck's school code, school name, post title and figures are not hard-coded. The
 *     scan list must never be written to the repository: it is read from the file named by the environment
 *     variable `M27_PRIVACY_SCAN_FILE` (one forbidden string per line, outside the repo); the check is skipped
 *     where the variable is absent.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../../..')
const SELF = resolve(__dirname, 'privacy.test.ts')

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

/** M27-owned files: the module folder, its E2E folder and its docs. */
function ownedFiles(): string[] {
  const files = [
    ...walk(join(ROOT, 'src/modules/m27-school-admin')),
    ...walk(join(ROOT, 'e2e/m27-school-admin')),
  ]
  for (const doc of [
    'docs/requirements/srs/M27-school-admin.md',
    'docs/requirements/urs/M27-school-admin.md',
  ]) {
    const path = join(ROOT, doc)
    if (existsSync(path)) files.push(path)
  }
  return files.filter((f) => f !== SELF)
}

describe('CHK-M27-01 privacy scan of M27-owned files', () => {
  it('finds the owned files', () => {
    expect(ownedFiles().length).toBeGreaterThan(5)
  })

  /** Generic placeholders observed on live (not personal data): M02 FR-M02-22 / FR-M02-32. */
  const ALLOWED_PLACEHOLDERS = new Set(['contoh@email.com'])

  it('(a) contains no e-mail address other than @demo.test or an observed live placeholder', () => {
    const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
    const offenders: string[] = []
    for (const file of ownedFiles()) {
      for (const match of readFileSync(file, 'utf8').matchAll(email)) {
        if (!match[0].endsWith('@demo.test') && !ALLOWED_PLACEHOLDERS.has(match[0]))
          offenders.push(`${file}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  const listPath = process.env.M27_PRIVACY_SCAN_FILE
  it.skipIf(!listPath || !existsSync(listPath))(
    '(b) hard-codes none of the screenshot or deck strings (list kept outside the repository)',
    () => {
      const forbidden = readFileSync(listPath as string, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== '')
      const offenders: string[] = []
      for (const file of ownedFiles()) {
        const content = readFileSync(file, 'utf8')
        for (const needle of forbidden) {
          if (content.toLowerCase().includes(needle.toLowerCase())) {
            offenders.push(
              `${file}: a forbidden string (line ${String(forbidden.indexOf(needle) + 1)})`,
            )
          }
        }
      }
      expect(offenders).toEqual([])
    },
  )
})
