// Strict design-system lint for the Portal Pentadbiran (rules R1-R14, config in config/ds-strict.json:
// adminScope / adminExempt / enforce / adminAreas). Used by scripts/lint-admin.mjs (ratchet runner,
// ESLint Node API: no long command line) and, for the `enforce` globs, by eslint.config.ts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

import { matcher } from './lib/glob.mjs'
import ppPlugin from './pp-plugin.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

/** Reads the admin part of config/ds-strict.json. */
export function readAdminStrict(file = 'config/ds-strict.json') {
  const raw = JSON.parse(readFileSync(`${ROOT}${file}`, 'utf8'))
  return {
    scope: raw.adminScope ?? [],
    exempt: raw.adminExempt ?? [],
    enforce: (raw.enforce ?? []).map((e) => (typeof e === 'string' ? { glob: e } : e)),
    areas: raw.adminAreas ?? [],
  }
}

/** Rule set R1-R14 at severity `error`. */
export const ADMIN_RULES = {
  'pp/ds-no-class-attr': 'error', // R1
  'pp/ds-no-class-literal-in-script': 'error', // R2
  'pp/ds-no-ui-prop': 'error', // R3
  'pp/ds-no-style': 'error', // R4
  'pp/ds-no-raw-html': 'error', // R5
  'pp/ds-no-ui-duplicate': 'error', // R6
  'pp/ds-ui-allowlist': 'error', // R7
  'pp/ds-no-local-kit': 'error', // R8
  'pp/ds-icon-names': ['error', { baseNamesOnly: true }], // R9
  'pp/ds-imports': 'error', // R10
  'pp/ds-copy-glossary': 'error', // R11
  'pp/ds-no-deprecated-ds-props': 'error', // R13
  'pp/ds-no-adhoc-format': 'error', // R14
  'pp/ds-no-remote-assets': 'error',
}

/**
 * Flat-config blocks: parsers plus the rules on `files` (page-template rule only on `*Page.vue`).
 * `files` are globs relative to the repo root.
 */
export function adminRuleBlocks(files, ignores = []) {
  const pages = files.flatMap((g) => (g.endsWith('/**') ? [`${g}/*Page.vue`] : g.endsWith('Page.vue') ? [g] : []))
  return [
    {
      name: 'admin-strict/rules',
      files,
      ignores,
      plugins: { pp: ppPlugin },
      rules: ADMIN_RULES,
    },
    ...(pages.length
      ? [
          {
            name: 'admin-strict/page-template',
            files: pages,
            ignores,
            plugins: { pp: ppPlugin },
            rules: { 'pp/ds-page-template': 'error' }, // R12
          },
        ]
      : []),
  ]
}

/** Standalone config for the ratchet runner (ESLint Node API, overrideConfigFile: true). */
export function adminStrictConfig() {
  const { exempt } = readAdminStrict()
  return [
    { name: 'admin-strict/ignores', ignores: exempt },
    { name: 'admin-strict/linter', linterOptions: { reportUnusedDisableDirectives: 'off' } },
    {
      name: 'admin-strict/vue-parser',
      files: ['**/*.vue'],
      languageOptions: {
        parser: vueParser,
        parserOptions: { parser: tsParser, sourceType: 'module' },
      },
    },
    { name: 'admin-strict/ts-parser', files: ['**/*.ts'], languageOptions: { parser: tsParser } },
    ...adminRuleBlocks(['src/**/*.vue', 'src/**/*.ts']),
    {
      name: 'admin-strict/page-template-all',
      files: ['**/*Page.vue'],
      plugins: { pp: ppPlugin },
      rules: { 'pp/ds-page-template': 'error' },
    },
  ]
}

export { matcher }
