import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

import * as examCore from '../src/index'

const ENTRY = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const PKG_DIR = fileURLToPath(new URL('..', import.meta.url))

describe('@pp/exam-core public API (BE-14 AC 3 and 4)', () => {
  it('exports exactly the agreed runtime functions', () => {
    expect(Object.keys(examCore).sort()).toEqual(
      [
        'composeFromBlueprint',
        'effectiveMarks',
        'gradePart',
        'isBlank',
        'leavesOf',
        'numericValue',
        'poolUnits',
      ].sort(),
    )
  })

  it.each(['node', 'browser'] as const)(
    'bundles for platform %s with no external import (no Vue, DOM-free, Node-free)',
    async (platform) => {
      const result = await build({
        entryPoints: [ENTRY],
        bundle: true,
        write: false,
        format: 'esm',
        platform,
        metafile: true,
        absWorkingDir: PKG_DIR,
        logLevel: 'silent',
      })
      expect(result.errors).toEqual([])
      const inputs = Object.keys(result.metafile.inputs)
      // Every bundled input is inside the package's own src/: no app code, node_modules or builtins.
      for (const path of inputs) expect(path.startsWith('src/')).toBe(true)
      const externalImports = Object.values(result.metafile.inputs).flatMap((i) =>
        i.imports.filter((x) => x.external),
      )
      expect(externalImports).toEqual([])
    },
  )
})
