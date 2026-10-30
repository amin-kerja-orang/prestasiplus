/**
 * Layer 2 of the launch blueprints (bijak-spm, BJS-13; architecture section 8): exact unit quotas, KBAT marks
 * and marks bands, read from the analyst files `docs/reference/blueprints/<code>.json` (the code with `/`
 * replaced by `-`). That folder is the ONE source of truth; the exam-core test fixtures are copies.
 *
 * Files are validated on load (a malformed file fails the seed). A section that the analyst marked INCOMPLETE
 * has no `kbatMarks`: it is seeded null and stays unverifiable. Values are never adjusted here.
 */
import { existsSync, readFileSync } from 'node:fs'

import { z } from 'zod'

import type { Layer2File } from './build'

const BLUEPRINT_DIR = new URL('../../../../../docs/reference/blueprints/', import.meta.url)

const line = z.union([
  z.strictObject({ subject: z.string().min(1), level: z.enum(['T4', 'T5']), unitCode: z.string().min(1), value: z.number().int().min(0) }),
  z.strictObject({ bucket: z.literal('t1_t3'), value: z.number().int().min(0) }),
])

const layer2File = z.strictObject({
  code: z.string().regex(/^\d{4}\/\d$/),
  sections: z
    .array(
      z.strictObject({
        position: z.number().int().min(1),
        quota: z
          .strictObject({
            basis: z.enum(['questions', 'marks']),
            lines: z.array(line).min(1),
            levelShare: z.strictObject({ t4: z.number().int().min(0), t5: z.number().int().min(0) }).optional(),
          })
          .optional(),
        kbatMarks: z.number().int().min(0).optional(),
        marksBand: z
          .array(z.strictObject({ from: z.number().int().min(1), to: z.number().int().min(1), marksMin: z.number().int().min(1), marksMax: z.number().int().min(1) }))
          .optional(),
        notes: z.string(),
      }),
    )
    .min(1),
  kbatMarksTotal: z.number().int().min(0).optional(),
})

export const fileOfCode = (code: string): URL => new URL(`${code.replace('/', '-')}.json`, BLUEPRINT_DIR)

/** The analyst file of a blueprint code, or null when it does not exist yet. */
export function loadLayer2(code: string): Layer2File | null {
  const file = fileOfCode(code)
  if (!existsSync(file)) return null
  const parsed = layer2File.parse(JSON.parse(readFileSync(file, 'utf8')))
  if (parsed.code !== code) throw new Error(`layer 2: ${code.replace('/', '-')}.json declares code ${parsed.code}`)
  return parsed as Layer2File
}
