// RuleTester tests of the strict Portal Pentadbiran rules R1-R14 (docs/design/v2-ds-hardening.md,
// "Strict lint for Portal Pentadbiran"). Run with `npm run test`.
import tsParser from '@typescript-eslint/parser'
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import vueParser from 'vue-eslint-parser'

import copyGlossary from '../rules/ds-copy-glossary.mjs'
import dsIconNames from '../rules/ds-icon-names.mjs'
import dsImports from '../rules/ds-imports.mjs'
import noAdhocFormat from '../rules/ds-no-adhoc-format.mjs'
import noClassAttr from '../rules/ds-no-class-attr.mjs'
import noClassLiteral from '../rules/ds-no-class-literal-in-script.mjs'
import noDeprecated from '../rules/ds-no-deprecated-ds-props.mjs'
import noLocalKit from '../rules/ds-no-local-kit.mjs'
import noRawHtml from '../rules/ds-no-raw-html.mjs'
import noStyle from '../rules/ds-no-style.mjs'
import noUiDuplicate from '../rules/ds-no-ui-duplicate.mjs'
import noUiProp from '../rules/ds-no-ui-prop.mjs'
import pageTemplate from '../rules/ds-page-template.mjs'
import uiAllowlist from '../rules/ds-ui-allowlist.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    parserOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
  },
})
const tsTester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
})
const vue = (template, script = '') =>
  `<template>${template}</template>\n${script ? `<script setup lang="ts">${script}</script>` : ''}`

describe('R1 pp/ds-no-class-attr', () => {
  tester.run('ds-no-class-attr', noClassAttr, {
    valid: [vue('<DsStack gap="4"><DsText>x</DsText></DsStack>'), vue('<div data-testid="x" />')],
    invalid: [
      { code: vue('<DsStack class="flex gap-4" />'), errors: [{ messageId: 'cls' }] },
      { code: vue('<UButton :class="{ a: x }" />'), errors: [{ messageId: 'cls' }] },
      { code: vue('<div class="w-full"><span class="text-muted" /></div>'), errors: 2 },
    ],
  })
})

describe('R2 pp/ds-no-class-literal-in-script', () => {
  tsTester.run('ds-no-class-literal-in-script', noClassLiteral, {
    valid: [
      { code: "export const label = 'Simpan perubahan'" },
      { code: "import x from 'text-muted-thing'" },
      { code: "export const tone = 'primary'" },
    ],
    invalid: [
      { code: "export const TH = 'px-4 py-2 text-muted'", errors: [{ messageId: 'lit' }] },
      { code: 'export const a = `bg-elevated rounded-card`', errors: [{ messageId: 'lit' }] },
    ],
  })
  tester.run('ds-no-class-literal-in-script (vue)', noClassLiteral, {
    valid: [],
    invalid: [{ code: vue('<DsText />', "const c = 'gap-4 p-2'"), errors: [{ messageId: 'lit' }] }],
  })
})

describe('R3 pp/ds-no-ui-prop', () => {
  tester.run('ds-no-ui-prop', noUiProp, {
    valid: [vue('<UButton label="x" />')],
    invalid: [
      { code: vue('<UCard :ui="{ body: \'p-0\' }" />'), errors: [{ messageId: 'ui' }] },
      { code: vue('<DsPanel ui="x" />'), errors: [{ messageId: 'ui' }] },
    ],
  })
})

describe('R4 pp/ds-no-style', () => {
  tester.run('ds-no-style', noStyle, {
    valid: [vue('<DsText />')],
    invalid: [
      { code: vue('<DsText style="color: red" />'), errors: [{ messageId: 'inline' }] },
      { code: vue('<DsText :style="s" />'), errors: [{ messageId: 'inline' }] },
      { code: `${vue('<DsText />')}\n<style scoped>.a{}</style>`, errors: [{ messageId: 'block' }] },
    ],
  })
})

describe('R5 pp/ds-no-raw-html', () => {
  tester.run('ds-no-raw-html', noRawHtml, {
    valid: [
      vue('<DsStack><template v-if="a"><slot /></template><component :is="c" /></DsStack>'),
      vue('<RouterView /><Teleport to="body"><KeepAlive /></Teleport>'),
      vue('<code>x</code>'),
    ],
    invalid: [
      { code: vue('<div><p>x</p></div>'), errors: 2 },
      { code: vue('<h2>x</h2>'), errors: [{ messageId: 'raw' }] },
      { code: vue('<label for="a">x</label><input id="a" />'), errors: 2 },
      { code: vue('<table><tr><td>1</td></tr></table>'), errors: 3 },
    ],
  })
})

describe('R6 pp/ds-no-ui-duplicate', () => {
  tester.run('ds-no-ui-duplicate', noUiDuplicate, {
    valid: [vue('<UButton /><DsPanel /><UInput />')],
    invalid: [
      { code: vue('<UCard />'), errors: [{ messageId: 'twin' }] },
      { code: vue('<u-badge />'), errors: [{ messageId: 'twin' }] },
      { code: vue('<UTable /><UTabs /><USlideover /><UPagination />'), errors: 4 },
      { code: vue('<UAlert /><UModal /><UProgress />'), errors: 3 },
    ],
  })
})

describe('R7 pp/ds-ui-allowlist', () => {
  const opts = [{ dsProps: { DsPanel: ['title', 'padding'] } }]
  tester.run('ds-ui-allowlist', uiAllowlist, {
    valid: [
      { code: vue('<UButton /><UInput /><UKbd />'), options: opts },
      { code: vue('<UCard />'), options: opts }, // R6's job
      { code: vue('<DsPanel title="x" :padding="2" data-testid="a" aria-label="b" @click="f" />'), options: opts },
      { code: vue('<DsNotYetBuilt anything="x" />'), options: opts },
    ],
    invalid: [
      { code: vue('<UIcon name="x" />'), options: opts, errors: [{ messageId: 'tag' }] },
      { code: vue('<UAvatar />'), options: opts, errors: [{ messageId: 'tag' }] },
      { code: vue('<DsPanel title="x" bogus="1" :other="2" />'), options: opts, errors: 2 },
    ],
  })
})

describe('R8 pp/ds-no-local-kit', () => {
  const o = [{ widgets: ['src/modules/m99/components/Listed.vue'] }]
  tester.run('ds-no-local-kit', noLocalKit, {
    valid: [
      { code: vue('<DsPanel title="a"><DsText>x</DsText><DsGrid /></DsPanel>'), filename: 'src/modules/m99/components/Real.vue', options: o },
      { code: vue('<DsPanel><slot /></DsPanel>'), filename: 'src/modules/m99/components/Listed.vue', options: o },
      { code: vue('<DsPanel><slot /></DsPanel>'), filename: 'src/modules/m99/pages/XPage.vue', options: o },
    ],
    invalid: [
      { code: vue('<DsPanel title="a"><slot /></DsPanel>'), filename: 'src/modules/m99/components/FooPanel.vue', options: o, errors: [{ messageId: 'kit' }] },
      { code: vue('<UCard><DsText>t</DsText><div v-for="i in xs" :key="i" /></UCard>'), filename: 'src/modules/m99/components/Bar.vue', options: o, errors: [{ messageId: 'kit' }] },
    ],
  })
})

describe('R9 pp/ds-icon-names (baseNamesOnly)', () => {
  const o = [{ baseNamesOnly: true }]
  tester.run('ds-icon-names', dsIconNames, {
    valid: [
      { code: vue('<DsIcon icon="plus" />'), options: o },
      { code: vue('<UButton icon="i-ph-plus" />') }, // default options unchanged
    ],
    invalid: [
      { code: vue('<UButton icon="i-ph-plus" />'), options: o, errors: [{ messageId: 'full' }] },
      { code: vue('<DsIcon :icon="x ? \'i-ph-x\' : \'check\'" />'), options: o, errors: [{ messageId: 'full' }] },
      { code: vue('<DsIcon icon="i-lucide-x" />'), options: o, errors: [{ messageId: 'icon' }] },
    ],
  })
})

describe('R10 pp/ds-imports', () => {
  tsTester.run('ds-imports', dsImports, {
    valid: [
      { code: "import { DsPanel } from '@/ds'", filename: 'src/modules/m02-users-schools/pages/A.vue' },
      { code: "import x from '../lib/user-list'", filename: 'src/modules/m02-users-schools/pages/A.ts' },
      { code: "import { PENTADBIRAN_MENU } from '@/shells/pentadbiran/menu'", filename: 'src/shells/pentadbiran/L.ts' },
    ],
    invalid: [
      { code: "import AppIcon from '@/components/icon'", filename: 'src/modules/m02/pages/A.ts', errors: [{ messageId: 'imp' }] },
      { code: "import { x } from '@/shells/nav/admin-nav'", filename: 'src/modules/m02/pages/A.ts', errors: [{ messageId: 'imp' }] },
      { code: "import Bar from './FormBar.vue'", filename: 'src/modules/m02/components/A.ts', errors: [{ messageId: 'imp' }] },
      { code: "import C from 'chart.js'", filename: 'src/modules/m02/components/A.ts', errors: [{ messageId: 'imp' }] },
      { code: "const m = () => import('../native/Thing.vue')", filename: 'src/modules/m02/components/A.ts', errors: [{ messageId: 'imp' }] },
    ],
  })
})

describe('R11 pp/ds-copy-glossary', () => {
  const o = [{ exceptions: [{ file: 'src/x/Ok.vue', text: 'Reset' }] }]
  tester.run('ds-copy-glossary', copyGlossary, {
    valid: [
      { code: vue('<DsText>Cari</DsText><UButton label="Set Semula" />'), options: o },
      { code: vue('<UButton icon="plus" label="Tambah Banner" />'), options: o },
      { code: vue('<UButton label="Daftar Sekolah" />'), options: o },
      { code: vue('<DsEmptyState size="sm" title="Tiada data." />'), options: o },
      { code: vue('<DsEmptyState size="sm"><DsText>Tiada data.</DsText></DsEmptyState>'), options: o },
      { code: vue('<DsText>Reset</DsText>'), filename: 'src/x/Ok.vue', options: o },
    ],
    invalid: [
      { code: vue('<UButton label="Tapis" />'), options: o, errors: [{ messageId: 'copy' }] },
      { code: vue('<DsText>Reset</DsText>'), options: o, errors: [{ messageId: 'copy' }] },
      { code: vue('<DsText>Tiada data.</DsText>'), options: o, errors: [{ messageId: 'copy' }] },
      { code: vue('<DsText>Kembali ke senarai</DsText>'), options: o, errors: [{ messageId: 'copy' }] },
      { code: vue('<DsText>x</DsText>', "const t = 'Pengurusan Soalan'"), options: o, errors: [{ messageId: 'copy' }] },
      { code: vue('<UButton icon="plus" label="Buat Baru" />'), options: o, errors: 2 },
      { code: vue('<UButton icon="plus">Soalan</UButton>'), options: o, errors: [{ messageId: 'add' }] },
      { code: vue('<UButton label="Daftar Kertas" />'), options: o, errors: [{ messageId: 'daftar' }] },
      { code: vue('<DsText>Upload fail</DsText>'), options: o, errors: [{ messageId: 'copy' }] },
    ],
  })
})

describe('R12 pp/ds-page-template', () => {
  const ok = '<DsPage layout="list"><DsFilterBar /><DsStatRow :items="[a, b]" /><DsDataTable variant="flush" card-title="n" :card-fields="f" /></DsPage>'
  tester.run('ds-page-template', pageTemplate, {
    valid: [
      vue(ok),
      vue('<DsPrintSheet><div /></DsPrintSheet>'),
      vue('<DsPage layout="form"><DsFilterBar v-if="a" /><DsFilterBar v-else /></DsPage>'),
    ],
    invalid: [
      { code: vue('<div />'), errors: [{ messageId: 'root' }] },
      { code: vue('<DsPage><DsText /></DsPage>'), errors: [{ messageId: 'layout' }] },
      { code: vue('<DsPage layout="list" title="x" />'), errors: [{ messageId: 'title' }] },
      { code: vue('<DsPage layout="list"><DsFilterBar /><DsFilterBar /></DsPage>'), errors: [{ messageId: 'dup' }] },
      { code: vue('<DsPage layout="list"><DsStatRow :items="[a]" /></DsPage>'), errors: [{ messageId: 'items' }] },
      { code: vue('<DsPage layout="list"><DsDataTable /></DsPage>'), errors: [{ messageId: 'card' }] },
      { code: vue('<DsPage layout="form"><DsPanel><DsPanel /></DsPanel></DsPage>'), errors: [{ messageId: 'nested' }] },
      { code: vue('<DsPage layout="form"><DsBackLink to="/a" /></DsPage>'), errors: [{ messageId: 'back' }] },
      { code: vue('<DsPage layout="form" back-to="/a" back-label="Senarai" />'), errors: [{ messageId: 'backLabel' }] },
    ],
  })
})

describe('R13 pp/ds-no-deprecated-ds-props', () => {
  tester.run('ds-no-deprecated-ds-props', noDeprecated, {
    valid: [
      vue('<DsPanel padding="4" /><DsFormSection tone="neutral" /><DsStatRow :items="x" />'),
      vue('<UButton tone="x" />'),
    ],
    invalid: [
      { code: vue('<DsPanel flush tone="muted" />'), errors: 2 },
      { code: vue('<DsStatRow roomy compact />'), errors: 2 },
      { code: vue('<DsStatTile value-class="x" /><DsDataTable compact-cells />'), errors: 2 },
      { code: vue('<DsLoadError inline /><DsFilterBar tone="x" />'), errors: 2 },
      { code: vue('<DsFormSection tone="danger" />'), errors: [{ messageId: 'dep' }] },
    ],
  })
})

describe('R14 pp/ds-no-adhoc-format', () => {
  tsTester.run('ds-no-adhoc-format', noAdhocFormat, {
    valid: [{ code: 'const a = formatCount(n); const b = items.length' }],
    invalid: [
      { code: 'const a = n.toLocaleString("ms-MY")', errors: [{ messageId: 'fmt' }] },
      { code: 'const f = new Intl.NumberFormat("ms-MY")', errors: [{ messageId: 'fmt' }] },
      { code: 'const a = x.toFixed(1)', errors: [{ messageId: 'fmt' }] },
      { code: 'const a = `${pct}%`', errors: [{ messageId: 'fmt' }] },
      { code: "const a = pct + '%'", errors: [{ messageId: 'fmt' }] },
      { code: 'const a = s.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",")', errors: [{ messageId: 'fmt' }] },
    ],
  })
  tester.run('ds-no-adhoc-format (vue)', noAdhocFormat, {
    valid: [],
    invalid: [
      { code: vue('<DsText>{{ n.toFixed(1) }}</DsText>'), errors: [{ messageId: 'fmt' }] },
      { code: vue('<DsText>{{ pct }}%</DsText>'), errors: [{ messageId: 'fmt' }] },
    ],
  })
})
