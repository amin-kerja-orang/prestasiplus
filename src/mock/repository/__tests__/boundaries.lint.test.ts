/**
 * Lint fixture for the module boundary rules (F-10; D12, ADR-0009 Amendment 1, overview §13).
 *
 * Runs the real `eslint.config.ts` over in-memory fixtures placed at virtual paths, so each file is
 * matched by the same config blocks as real code. Only the two boundary rules run (`ruleFilter`),
 * and type information is switched off because the fixture files do not exist on disk.
 *
 * It proves, for both **static** imports and **dynamic** `import('…')`, that another module's
 * `mock/tables`, `mock/datasets`, `mock/seeds` and `mock/repository` fail, and that the owner
 * contract `@/modules/<owner>/mock` passes.
 */

import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const BOUNDARY_RULES = new Set(['no-restricted-imports', 'no-restricted-syntax'])

let eslint: ESLint

beforeAll(async () => {
  eslint = new ESLint({
    cwd: ROOT,
    ruleFilter: ({ ruleId }) => BOUNDARY_RULES.has(ruleId),
    overrideConfig: {
      languageOptions: { parserOptions: { projectService: false, project: null } },
    },
  })
  // Warm-up: the first call loads `eslint.config.ts` (jiti) and the plugins.
  await eslint.lintText('export {}\n', { filePath: `${ROOT}src/mock/__f10_warmup__.ts` })
}, 120_000)

async function lint(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, {
    filePath: `${ROOT}${filePath}`,
    warnIgnored: true,
  })
  expect(result, filePath).toBeDefined()
  const fatal = result!.messages.filter((m) => m.fatal)
  expect(fatal, JSON.stringify(fatal)).toEqual([])
  return result!.messages.map((m) => m.ruleId ?? 'fatal')
}

const M04 = '@/modules/m04-question-bank'
const PRIVATE = [
  `${M04}/mock/tables`,
  `${M04}/mock/datasets/questions`,
  `${M04}/mock/seeds/anchors`,
  `${M04}/mock/repository/questions`,
  `${M04}/mock/index`,
  `${M04}/api/types`,
  // Root-absolute specifiers are treated like the alias.
  `/src/modules/m04-question-bank/mock/datasets/questions`,
  `/src/modules/m04-question-bank/mock/tables`,
]
const RELATIVE_PRIVATE = '../../../m04-question-bank/mock/datasets/questions'

/** Files of other modules' mock code, the mock core, and a module's own tests. */
const MOCK_FILES = [
  'src/modules/m05-practice/mock/handlers/__f10_fixture__.ts',
  'src/modules/m06-spm/mock/index.ts',
  'src/mock/core-data/__f10_fixture__.ts',
]
const TEST_FILE = 'src/modules/m05-practice/__tests__/mock/__f10_fixture__.test.ts'

describe('boundary lint: static and dynamic imports of another module', () => {
  for (const file of [...MOCK_FILES, TEST_FILE]) {
    describe(file, () => {
      it.each(PRIVATE)('static import of %s fails', async (spec) => {
        expect(await lint(file, `import { x } from '${spec}'\nexport default x\n`)).toEqual([
          'no-restricted-imports',
        ])
      })

      it.each(PRIVATE)('dynamic import of %s fails', async (spec) => {
        expect(await lint(file, `export const load = () => import('${spec}')\n`)).toEqual([
          'no-restricted-syntax',
        ])
      })

      it('re-export and relative reach-in fail', async () => {
        expect(
          await lint(file, `export { questions } from '${M04}/mock/datasets/questions'\n`),
        ).toEqual(['no-restricted-imports'])
        expect(
          await lint(file, `import { q } from '${RELATIVE_PRIVATE}'\nexport default q\n`),
        ).toEqual(['no-restricted-imports'])
        expect(
          await lint(file, `export const load = () => import('${RELATIVE_PRIVATE}')\n`),
        ).toEqual(['no-restricted-syntax'])
      })

      it('non-literal dynamic specifiers fail', async () => {
        const code = [
          "const slug = 'm04-question-bank'",
          'export const a = () => import(`@/modules/${slug}/mock/tables`)',
          "export const b = () => import('@/modules/' + slug + '/mock/datasets')",
          'export const c = () => import(`@/modules/m04-question-bank/mock/seeds`)',
          '',
        ].join('\n')
        expect(await lint(file, code)).toEqual([
          'no-restricted-syntax',
          'no-restricted-syntax',
          'no-restricted-syntax',
        ])
      })

      it('the owner contract passes (static and dynamic)', async () => {
        const code = [
          `import { questions } from '${M04}/mock'`,
          `import type { Store } from '@/mock/define'`,
          `import { defineRepository } from '@/mock/repository'`,
          `export const load = () => import('${M04}/mock')`,
          'export type S = Store<{ id: number }>',
          'export { questions, defineRepository }',
          '',
        ].join('\n')
        expect(await lint(file, code)).toEqual([])
      })
    })
  }

  it.each(MOCK_FILES)(
    '%s: the UI entry of another module fails (static and dynamic)',
    async (file) => {
      expect(
        await lint(file, `import { manifest } from '${M04}'\nexport default manifest\n`),
      ).toEqual(['no-restricted-imports'])
      expect(await lint(file, `export const load = () => import('${M04}')\n`)).toEqual([
        'no-restricted-syntax',
      ])
    },
  )

  it('own-module relative imports pass in mock code', async () => {
    const code = [
      "import { sessions } from '../tables'",
      "import { practiceAnchors } from '../seeds/anchors'",
      "export const load = () => import('../datasets/sessions')",
      'export { sessions, practiceAnchors }',
      '',
    ].join('\n')
    expect(await lint(MOCK_FILES[0]!, code)).toEqual([])
  })

  it('UI code never imports any mock, static or dynamic', async () => {
    const file = 'src/modules/m05-practice/pages/__f10_fixture__.ts'
    expect(
      await lint(file, `import { questions } from '${M04}/mock'\nexport default questions\n`),
    ).toEqual(['no-restricted-imports'])
    expect(await lint(file, `export const load = () => import('${M04}/mock')\n`)).toEqual([
      'no-restricted-syntax',
    ])
    expect(
      await lint(file, `import { manifest } from '${M04}'\nexport default manifest\n`),
    ).toEqual([])
    // Root-absolute specifiers are treated like the alias.
    expect(
      await lint(
        file,
        `import { q } from '/src/modules/m04-question-bank/mock'\nexport default q\n`,
      ),
    ).toEqual(['no-restricted-imports'])
    expect(await lint(file, `export const load = () => import('/src/mock/define')\n`)).toEqual([
      'no-restricted-syntax',
    ])
  })
})

describe('boundary lint: import.meta.glob', () => {
  const GLOBS = [
    `import.meta.glob('/src/modules/m04-question-bank/mock/datasets/*.ts', { eager: true })`,
    `import.meta.glob('../../m04-question-bank/mock/**/*.ts')`,
    `import.meta.glob('@/modules/m04-question-bank/mock/seeds/*.ts')`,
    `import.meta.glob('./handlers/*.ts')`,
  ]
  const BANNED_FILES = [
    ...MOCK_FILES,
    TEST_FILE,
    'src/modules/m05-practice/pages/__f10_fixture__.ts',
    'src/modules/m05-practice/components/quiz/__f10_fixture__.vue',
    'src/app/bootstrap.ts',
  ]

  for (const file of BANNED_FILES) {
    it.each(GLOBS)(`${file}: %s is banned`, async (glob) => {
      const code = file.endsWith('.vue')
        ? `<script setup lang="ts">\nconst m = ${glob}\nvoid m\n</script>\n`
        : `export const m = ${glob}\n`
      expect(await lint(file, code)).toEqual(['no-restricted-syntax'])
    })
  }

  describe('allowed only in src/mock/index.ts, within the boundary patterns', () => {
    const file = 'src/mock/index.ts'

    it('its own core discovery passes', async () => {
      const code = `export const found = import.meta.glob<unknown>('./core-data/index.ts', { eager: true, import: 'default' })\n`
      expect(await lint(file, code)).toEqual([])
    })

    it.each([
      `'/src/modules/m04-question-bank/mock/datasets/*.ts'`,
      `'@/modules/m04-question-bank/mock/tables.ts'`,
      `'../modules/m04-question-bank/mock/**/*.ts'`,
      `'@/modules/m04-question-bank'`,
      'pattern',
      `['./core-data/index.ts']`,
    ])('glob(%s) fails', async (arg) => {
      const code = `const pattern = './a/*.ts'\nexport const found = import.meta.glob(${arg})\n`
      expect(await lint(file, code)).toEqual(['no-restricted-syntax'])
    })
  })
})
