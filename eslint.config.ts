import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from 'eslint-config-prettier/flat'
import type { Linter } from 'eslint'
import pluginVue from 'eslint-plugin-vue'

import { readDsStrict } from './eslint/ds-strict.mjs'
import ppPlugin from './eslint/pp-plugin.mjs'

/**
 * ESLint flat config (overview §13, ADR-0009).
 *
 * Module boundaries (enforced with `no-restricted-imports`):
 * - UI code imports another module only via `@/modules/<slug>` (its index.ts).
 *   Inside your own module, use relative imports.
 * - Mock code imports another module's store only via `@/modules/<slug>/mock` (repository exports,
 *   D12), never another module's UI entry `@/modules/<slug>`.
 * - Nobody imports another module's pages, components, mock/tables, mock/datasets, mock/seeds or
 *   mock/repository.
 * - Dynamic `import()` specifiers are plain string literals (so the rules can check them).
 * - `import.meta.glob` is banned except in `GLOB_ALLOWED` (there, its pattern is checked too).
 * - Root-absolute specifiers (`/src/...`) are treated like the `@/` alias.
 * - UI code never imports any `mock/` (only `src/app/bootstrap.ts` installs the mock transport).
 * - `@/mock/testing/**` is private to the mock core.
 *
 * `no-restricted-imports` only checks static imports, so each boundary block also sets
 * `no-restricted-syntax` with `ImportExpression` selectors built from the same patterns. This closes
 * the dynamic `import()` bypass (lazy routes, `defineAsyncComponent`, `await import()`). Rule
 * settings replace per file, so every block passes its own full pattern list.
 */

const CROSS_MODULE_RELATIVE = {
  regex: String.raw`^\.\.?/(?:.*/)?m\d{2}-[a-z0-9-]+/`,
  message:
    'Do not reach into another module with a relative path. Import it via `@/modules/<slug>` (UI) or `@/modules/<slug>/mock` (mock code).',
}

const MOCK_TESTING_PRIVATE = {
  regex: String.raw`^(?:@|/src)/mock/testing(?:/|$)`,
  message: '`@/mock/testing` is private to the mock core (test hooks, dev/e2e only).',
}

const uiBoundaryPatterns = [
  {
    regex: String.raw`^(?:@|/src)/modules/[^/]+/.+`,
    message:
      'Import another module only through its public entry `@/modules/<slug>`. Inside your own module, use relative imports. UI code never imports `mock/`.',
  },
  {
    regex: String.raw`^(?:@|/src)/mock(?:/|$)`,
    message: 'UI code never imports the mock. Call the typed functions in `api/` instead.',
  },
  {
    regex: String.raw`^\.\.?/(?:.*/)?mock(?:/|$)`,
    message: 'UI code never imports `mock/`. Call the typed functions in `api/` instead.',
  },
  CROSS_MODULE_RELATIVE,
]

const mockBoundaryPatterns = [
  {
    regex: String.raw`^(?:@|/src)/modules/[^/]+/(?!mock$).+`,
    message:
      'Mock code reaches another module only through its repository exports `@/modules/<slug>/mock`. Tables, datasets, seeds and repository internals stay private (D12).',
  },
  CROSS_MODULE_RELATIVE,
]

/** Mock code (core and module plugins) never pulls a module's UI entry into the mock chunk. */
const MOCK_NO_UI_ENTRY = {
  regex: String.raw`^(?:@|/src)/modules/[^/]+$`,
  message:
    'Mock code imports another module only via `@/modules/<slug>/mock` (its repository exports), never its UI entry `@/modules/<slug>` (ADR-0009, D12).',
}

// The perf-calibration harness (src/mock/dataset/testing, F-09) is test-only: it may be imported
// only from files under a __tests__ folder, so it never reaches a build. Alias and relative forms.
const DATASET_TESTING_TEST_ONLY = {
  regex: String.raw`(?:^(?:@|/src)/mock/dataset/testing(?:/|$)|(?:^|/)dataset/testing(?:/|$)|^\.\.?/testing/perf-)`,
  message:
    '`@/mock/dataset/testing/*` (perf calibration) is test-only: import it only from `**/__tests__/**` files.',
}

const testBoundaryPatterns = [
  {
    regex: String.raw`^(?:@|/src)/modules/[^/]+/(?!mock$).+`,
    message:
      'Tests import another module only via `@/modules/<slug>` or `@/modules/<slug>/mock`. Use relative imports for your own module.',
  },
  CROSS_MODULE_RELATIVE,
]

interface BoundaryPattern {
  regex: string
  message: string
}

/**
 * `no-restricted-syntax` entries that apply boundary patterns to dynamic `import('...')`.
 * esquery regex literals cannot contain `/`, so it is written as `\x2F`.
 */
function dynamicImportRestrictions(patterns: readonly BoundaryPattern[]) {
  return patterns.map(({ regex, message }) => ({
    selector: `ImportExpression[source.value=/${regex.replaceAll('/', String.raw`\x2F`)}/]`,
    message,
  }))
}

/**
 * A dynamic `import()` whose specifier is not a plain string literal (a variable or a template
 * literal) cannot be matched by the selectors above, so it is refused outright (overview §3 rule 4).
 */
const NON_LITERAL_DYNAMIC_IMPORT = {
  selector: "ImportExpression:not([source.type='Literal'])",
  message:
    'Dynamic import specifiers must be plain string literals so the module boundary rules can check them (overview §3 rule 4).',
}

/**
 * `import.meta.glob` (and `globEager`) is a third way to import modules. It is banned outright,
 * except in the files listed in `GLOB_ALLOWED` (the mock entry discovers `./core-data`). Allowed
 * files still get the boundary patterns applied to the glob's first argument, which must be a
 * plain string literal.
 */
const GLOB_MEMBER =
  "MemberExpression[object.type='MetaProperty'][object.meta.name='import'][property.name=/^glob/]"
const GLOB_CALL = `CallExpression[callee.type='MemberExpression'][callee.object.type='MetaProperty'][callee.property.name=/^glob/]`
const GLOB_ALLOWED = ['src/mock/index.ts']

function globRestrictions(patterns: readonly BoundaryPattern[], allowGlob: boolean) {
  if (!allowGlob) {
    return [
      {
        selector: GLOB_MEMBER,
        message: `\`import.meta.glob\` is not allowed here (it bypasses the module boundary rules). Allowed only in: ${GLOB_ALLOWED.join(', ')}.`,
      },
    ]
  }
  return [
    ...patterns.map(({ regex, message }) => ({
      selector: `${GLOB_CALL}[arguments.0.value=/${regex.replaceAll('/', String.raw`\x2F`)}/]`,
      message,
    })),
    {
      selector: `${GLOB_CALL}:not([arguments.0.type='Literal'])`,
      message:
        '`import.meta.glob` patterns must be one plain string literal so the boundary rules can check them.',
    },
  ]
}

/** Static, dynamic and glob import boundaries for one block (settings replace per file). */
function boundaryRules(
  patterns: readonly BoundaryPattern[],
  options: { allowGlob?: boolean } = {},
): Linter.RulesRecord {
  return {
    'no-restricted-imports': ['error', { patterns: [...patterns] }],
    'no-restricted-syntax': [
      'error',
      ...dynamicImportRestrictions(patterns),
      NON_LITERAL_DYNAMIC_IMPORT,
      ...globRestrictions(patterns, options.allowGlob ?? false),
    ],
  }
}

/**
 * Design-system strict files (V2-T04, design system v2.0 guard rules G-1..G-13). The set comes from
 * `config/ds-strict.json` (ratchet: only grows). Legacy files are not strict.
 */
const DS = readDsStrict()
const DS_IGNORES = [...DS.exempt, '**/__tests__/**', '**/*.test.ts']

const DS_IMPORT_PATTERNS = [
  ...uiBoundaryPatterns,
  DATASET_TESTING_TEST_ONLY,
  {
    group: ['@lucide/*', 'lucide-*', '@iconify-json/*', '@iconify/*', '@phosphor-icons/*'],
    message:
      'Icons come from the `i-ph-*` collection via Nuxt UI icon props (G-6, D38). No icon packages in strict files.',
  },
  {
    group: ['@fontsource/*', '@fontsource-variable/*', 'chart.js', 'chart.js/*'],
    message: 'Fonts and charts are owned by the theme / ds composites, not by pages (G-6).',
  },
  {
    regex: String.raw`^(?:@|/src)/(?:components|shells)(?:/|$)`,
    message:
      'Legacy `@/components/*` and `@/shells/*` are frozen; use `@nuxt/ui` and `@/ds` (G-6).',
  },
]

const DS_RAW_ELEMENTS = [
  'button',
  'input',
  'select',
  'textarea',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'dialog',
  'img',
].map((element) => ({
  element,
  message: `Raw <${element}> is forbidden in design-system files (G-5). Use the Nuxt UI / Ds* component (UButton, UInput, USelect, UTextarea, ULink, UTable, UModal, UAvatar, DsArt3D, ...).`,
}))

export default defineConfigWithVueTs(
  {
    name: 'app/ignores',
    ignores: [
      'dist/**',
      'dist-*/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'node_modules/**',
      '.playwright-mcp/**',
      'docs/**',
      '.claude/**',
    ],
  },

  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,

  // Type-checked rules for application code only.
  {
    name: 'app/type-checked',
    files: ['src/**/*.ts', 'src/**/*.vue'],
    extends: [vueTsConfigs.recommendedTypeCheckedOnly],
  },

  {
    name: 'app/vue-rules',
    files: ['**/*.vue'],
    rules: {
      'vue/no-v-html': 'error',
      'vue/block-lang': ['error', { script: { lang: 'ts' } }],
      'vue/component-api-style': ['error', ['script-setup']],
    },
  },

  // Boundary rules: UI code.
  {
    name: 'app/boundaries-ui',
    files: ['src/**/*.ts', 'src/**/*.vue'],
    ignores: [
      'src/mock/**',
      'src/modules/*/mock/**',
      'src/**/__tests__/**',
      'src/app/bootstrap.ts',
    ],
    rules: boundaryRules([...uiBoundaryPatterns, DATASET_TESTING_TEST_ONLY]),
  },

  // Boundary rules: the only file allowed to install the mock transport.
  {
    name: 'app/boundaries-bootstrap',
    files: ['src/app/bootstrap.ts'],
    rules: boundaryRules([
      ...mockBoundaryPatterns,
      MOCK_TESTING_PRIVATE,
      DATASET_TESTING_TEST_ONLY,
    ]),
  },

  // Boundary rules: mock code (core and module plugins). F-10 (D12) owns this section; the lint
  // fixture test `src/mock/repository/__tests__/boundaries.lint.test.ts` covers static + dynamic.
  {
    name: 'app/boundaries-mock-modules',
    files: ['src/modules/*/mock/**/*.ts'],
    rules: boundaryRules([
      ...mockBoundaryPatterns,
      MOCK_NO_UI_ENTRY,
      MOCK_TESTING_PRIVATE,
      DATASET_TESTING_TEST_ONLY,
    ]),
  },
  {
    name: 'app/boundaries-mock-core',
    files: ['src/mock/**/*.ts'],
    rules: boundaryRules([...mockBoundaryPatterns, MOCK_NO_UI_ENTRY, DATASET_TESTING_TEST_ONLY]),
  },
  // The mock entry may use `import.meta.glob` (core discovery), still within the boundary patterns.
  {
    name: 'app/boundaries-mock-glob-allowed',
    files: GLOB_ALLOWED,
    rules: boundaryRules([...mockBoundaryPatterns, MOCK_NO_UI_ENTRY, DATASET_TESTING_TEST_ONLY], {
      allowGlob: true,
    }),
  },

  // Boundary rules: unit tests.
  {
    name: 'app/boundaries-tests',
    files: ['src/**/__tests__/**/*.ts'],
    rules: boundaryRules(testBoundaryPatterns),
  },

  // Design-system strict files (config/ds-strict.json).
  {
    name: 'app/ds-strict',
    files: DS.strict,
    ignores: DS_IGNORES,
    plugins: { pp: ppPlugin },
    rules: {
      'pp/ds-class-allowlist': 'error',
      'pp/ds-no-inline-style': 'error',
      'pp/ds-no-style-block': 'error',
      'pp/ds-no-remote-assets': 'error',
      'pp/ds-icon-names': 'error',
      'vue/no-restricted-html-elements': ['error', ...DS_RAW_ELEMENTS],
      'no-restricted-imports': ['error', { patterns: DS_IMPORT_PATTERNS }],
    },
  },

  skipFormatting,
)
