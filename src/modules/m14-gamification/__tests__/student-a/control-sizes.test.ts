import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * FR-X6-3 (docs/prd/r1/40-cross-cutting.md): touch targets are at least 44 px. The project theme
 * (`src/theme/ui.config.ts`) sets the height of `UButton` for xs to lg and of `UInput` for md and lg;
 * `xl` falls back to the stock 40 px, so no M14 control may ask for it.
 */
const MODULE_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const templates = ['components', 'pages'].flatMap((dir) =>
  readdirSync(`${MODULE_ROOT}${dir}`, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.vue'))
    .map((file): [string, string] => [file, readFileSync(`${MODULE_ROOT}${dir}/${file}`, 'utf8')]),
)

describe('M14 control sizes', () => {
  it('scans the M14 templates', () => {
    expect(templates.length).toBeGreaterThan(20)
  })

  it.each(templates)('%s uses no unthemed xl control', (_file, source) => {
    const controls = source.match(/<U(?:Button|Input)\b[^>]*>/g) ?? []
    expect(controls.filter((tag) => /\bsize="xl"|'xl'/.test(tag))).toEqual([])
  })
})
