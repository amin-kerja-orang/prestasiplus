// Unit tests of the design-system guard rules (V2-T04): class allowlist (page and ds level),
// :ui objects, script constants, inline style, <style> blocks, remote assets, icon names and
// dynamic class bindings. Run with `npm run test`.
import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'
import vueParser from 'vue-eslint-parser'

import { classifyToken } from '../class-allowlist.mjs'
import tsParser from '@typescript-eslint/parser'

import dsClassAllowlist from '../rules/ds-class-allowlist.mjs'
import dsIconNames from '../rules/ds-icon-names.mjs'
import dsNoDynamicClass from '../rules/ds-no-dynamic-class.mjs'
import dsNoInlineStyle from '../rules/ds-no-inline-style.mjs'
import dsNoRemoteAssets from '../rules/ds-no-remote-assets.mjs'
import dsNoStyleBlock from '../rules/ds-no-style-block.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: { parser: vueParser, ecmaVersion: 2022, sourceType: 'module' },
})
const vue = (template, script = '') =>
  `<template>${template}</template>\n${script ? `<script setup lang="js">${script}</script>` : ''}`

const PAGE_OK = [
  'flex',
  'inline-flex',
  'grid',
  'grid-cols-3',
  'col-span-2',
  'gap-4',
  'gap-x-6',
  'items-center',
  'justify-between',
  'self-end',
  'order-2',
  'grow',
  'shrink-0',
  'basis-1/2',
  'flex-1',
  'flex-col',
  'w-full',
  'h-screen',
  'min-h-0',
  'max-w-3xl',
  'size-8',
  'p-4',
  'px-6',
  'mt-8',
  '-mt-2',
  'mx-auto',
  'space-y-3',
  'relative',
  'sticky',
  'top-0',
  'overflow-x-auto',
  'truncate',
  'text-ellipsis',
  'text-center',
  'aspect-square',
  'sr-only',
  // layout-adjacent behaviour utilities
  'invisible',
  'visible',
  'pointer-events-none',
  'cursor-pointer',
  'select-none',
  'object-cover',
  'object-contain',
  // variants
  'md:grid-cols-2',
  'lg:flex',
  '2xl:gap-8',
  'pointer-coarse:min-h-12',
  'hover:text-muted',
  'dark:bg-muted',
  'learner:gap-4',
  'staff:gap-2',
  'aria-selected:text-highlighted',
  'aria-expanded:flex',
  'data-[state=open]:flex',
  'data-open:flex',
  'placeholder:text-dimmed',
  'empty:hidden',
  'not-first:mt-2',
  'group-hover/row:text-default',
  '@md:flex',
  // tokens
  'text-default',
  'text-muted',
  'text-error',
  'text-primary/10',
  'bg-elevated',
  'bg-soft',
  'bg-default/50',
  'bg-cat-3',
  'text-display',
  'text-overline',
  'tabular',
  'i-ph-check-circle-duotone',
]

const PAGE_BAD = [
  ['bg-blue-500', 'palette'],
  ['text-red-600', 'palette'],
  ['bg-kobalt-500', 'palette'],
  ['text-ink-700', 'palette'],
  ['bg-primary-500', 'palette'],
  ['bg-white', 'palette'],
  ['text-black', 'palette'],
  ['w-[13px]', 'arbitrary'],
  ['bg-(--my-colour)', 'arbitrary'],
  ['text-[#ff0000]', 'arbitrary'],
  ['[&>p]:flex', 'arbitrary'],
  ['[[data-personality=learner]_&]:flex', 'arbitrary'],
  ['border', 'lines'],
  ['border-b', 'lines'],
  ['border-default', 'lines'],
  ['divide-y', 'lines'],
  ['outline-none', 'lines'],
  ['ring-2', 'lines'],
  ['ring-offset-2', 'lines'],
  ['shadow-lg', 'shadow'],
  ['shadow-card', 'shadow'],
  ['rounded-xl', 'radius'],
  ['rounded-card', 'radius'],
  ['bg-gradient-primary', 'gradient'],
  ['bg-gradient-to-r', 'gradient'],
  ['from-primary', 'gradient'],
  ['z-50', 'decoration'],
  ['transition-all', 'decoration'],
  ['animate-ds-rise', 'decoration'],
  ['font-bold', 'decoration'],
  ['opacity-50', 'decoration'],
  ['uppercase', 'typography'],
  ['underline', 'typography'],
  ['text-sm', 'text-size'],
  ['text-2xl', 'text-size'],
  ['p-5', 'spacing'],
  ['gap-0.5', 'spacing'],
  ['mt-10', 'spacing'],
  ['i-lucide-x', 'icon'],
  ['xl:hover:bg-blue-100', 'palette'],
  ['sm:border-t', 'lines'],
  ['tooltip', 'unknown'],
  ['custom-card', 'unknown'],
  ['bg-highlight', 'unknown'],
  ['bg-accented', 'unknown'],
  ['bg-primary', 'unknown'],
  ['bogus:flex', 'variant'],
  ['aria-bogus:flex', 'variant'],
]

describe('classifyToken - page level', () => {
  it.each(PAGE_OK)('allows %s', (token) => {
    expect(classifyToken(token, 'page')).toBeNull()
  })
  it.each(PAGE_BAD)('rejects %s (%s)', (token, code) => {
    expect(classifyToken(token, 'page')?.code).toBe(code)
  })
})

describe('classifyToken - ds level', () => {
  it.each([
    ...PAGE_OK,
    'rounded-lg',
    'rounded-card',
    'rounded-full',
    'shadow-lg',
    'shadow-card',
    'transition-colors',
    'transition',
    'duration-200',
    'animate-ds-rise',
    'font-semibold',
    'font-display',
    'z-10',
    'opacity-50',
    'uppercase',
    'bg-gradient-primary',
    'bg-gradient-primary-h',
    'bg-highlight',
    'text-primary-on',
    'bg-accented',
    'bg-primary/10',
    'text-primary',
    'p-0.5',
    'gap-1.5',
  ])('allows %s', (token) => {
    expect(classifyToken(token, 'ds')).toBeNull()
  })

  it.each([
    ['border', 'lines'],
    ['divide-y', 'lines'],
    ['ring-2', 'lines'],
    ['outline-none', 'lines'],
    ['bg-blue-500', 'palette'],
    ['bg-kobalt-500', 'palette'],
    ['w-[13px]', 'arbitrary'],
    ['text-sm', 'text-size'],
    ['bg-gradient-to-r', 'gradient'],
    ['from-primary', 'gradient'],
    ['i-lucide-x', 'icon'],
    ['tooltip', 'unknown'],
  ])('rejects %s (%s)', (token, code) => {
    expect(classifyToken(token, 'ds')?.code).toBe(code)
  })
})

const page = [{ level: 'page' }]
const ds = [{ level: 'ds' }]

tester.run('pp/ds-class-allowlist (page)', dsClassAllowlist, {
  valid: [
    { filename: 'a.vue', options: page, code: vue('<div class="flex items-center gap-4"></div>') },
    { filename: 'a.vue', options: page, code: vue('<UCard class="text-muted bg-elevated p-4" />') },
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<div :class="['flex', ok ? 'gap-2' : 'gap-4']"></div>`),
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<div :class="{ 'flex-col': ok, grid: !ok }"></div>`),
    },
    { filename: 'a.vue', options: page, code: vue('<div :class="`flex ${dyn} gap-2`"></div>') },
    { filename: 'a.vue', options: page, code: vue('<div :class="dynamicVariable"></div>') },
    // template-literal edges: fragments touching ${} are not judged
    { filename: 'a.vue', options: page, code: vue('<div :class="`bg-${tone}-500 flex`"></div>') },
    { filename: 'a.vue', options: page, code: vue('<div :class="`flex${x}`"></div>') },
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<UCard :ui="{ root: 'p-4 flex', body: ['gap-2'] }" />`),
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div />', `const x = cn('flex', ok && 'gap-2')`),
    },
    { filename: 'a.vue', options: page, code: vue('<div />', `const label = 'rounded-xl'`) },
  ],
  invalid: [
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div class="flex bg-blue-500"></div>'),
      errors: [{ message: /Palette colour .* \[bg-blue-500\]/ }],
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div class="w-[300px]"></div>'),
      errors: [{ message: /Arbitrary values/ }],
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div class="border-b divide-y ring-2 outline-none"></div>'),
      errors: 4,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div class="shadow-md rounded-lg bg-gradient-primary from-primary"></div>'),
      errors: 4,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<div :class="['flex', ok ? 'rounded-xl' : 'p-5']"></div>`),
      errors: 2,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<div :class="{ 'shadow-lg': ok }"></div>`),
      errors: 1,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div :class="`flex ${dyn} text-red-500`"></div>'),
      errors: 1,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div :class="`text-red-500 ${dyn}`"></div>'),
      errors: 1,
    },
    { filename: 'a.vue', options: page, code: vue('<div class="custom-thing"></div>'), errors: 1 },
    // :class bypasses: calls, casts, spreads
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<div :class="cn('flex', 'bg-red-500')"></div>`),
      errors: 1,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<div :class="[...['border-2']]"></div>`),
      errors: 1,
    },
    // Nuxt UI :ui objects (values, nested)
    {
      filename: 'a.vue',
      options: page,
      code: vue(`<UCard :ui="{ root: 'rounded-xl shadow-lg', body: { base: ['bg-red-500'] } }" />`),
      errors: 3,
    },
    // script strings
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div />', `const buttonClass = 'rounded-xl flex'`),
      errors: 1,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div />', `const x = cn('flex', ok && 'border-2')`),
      errors: 1,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div />', `const props = { class: 'shadow-sm' }`),
      errors: 1,
    },
    {
      filename: 'a.vue',
      options: page,
      code: vue('<div />', `const cfg = { ui: { root: 'ring-2' } }`),
      errors: 1,
    },
    {
      filename: 'a.ts',
      options: page,
      code: `export const rowClasses = ['p-5', 'flex']`,
      errors: 1,
    },
  ],
})

tester.run('pp/ds-class-allowlist (ds)', dsClassAllowlist, {
  valid: [
    {
      filename: 'a.vue',
      options: ds,
      code: vue(
        '<div class="flex rounded-card shadow-card bg-gradient-primary transition-colors z-10 font-semibold"></div>',
      ),
    },
    {
      filename: 'a.vue',
      options: ds,
      code: vue(`<UCard :ui="{ root: 'rounded-lg shadow-xs bg-primary/10' }" />`),
    },
  ],
  invalid: [
    {
      filename: 'a.vue',
      options: ds,
      code: vue('<div class="border rounded-lg"></div>'),
      errors: 1,
    },
    {
      filename: 'a.vue',
      options: ds,
      code: vue('<div class="bg-blue-500 w-[3px]"></div>'),
      errors: 2,
    },
    {
      filename: 'a.vue',
      options: ds,
      code: vue('<div class="bg-gradient-to-r from-primary"></div>'),
      errors: 2,
    },
  ],
})

// TypeScript-only syntax: casts and spreads in script class constants.
new RuleTester({ languageOptions: { parser: tsParser } }).run(
  'pp/ds-class-allowlist (ts syntax)',
  dsClassAllowlist,
  {
    valid: [{ filename: 'a.ts', options: page, code: `export const rowClass = 'flex' as string` }],
    invalid: [
      {
        filename: 'a.ts',
        options: page,
        code: `export const rowClass = 'shadow-lg' as string`,
        errors: 1,
      },
      {
        filename: 'a.ts',
        options: page,
        code: `export const boxClasses = ['flex', ...['border-2']] satisfies string[]`,
        errors: 1,
      },
      { filename: 'a.ts', options: page, code: `const x = cn(...['rounded-xl'])`, errors: 1 },
    ],
  },
)

tester.run('pp/ds-no-dynamic-class', dsNoDynamicClass, {
  valid: [
    { filename: 'a.vue', code: vue('<div class="flex"></div>') },
    { filename: 'a.vue', code: vue(`<div :class="['flex', ok ? 'gap-2' : 'gap-4']"></div>`) },
    { filename: 'a.vue', code: vue(`<div :class="{ flex: a, grid: b }"></div>`) },
    { filename: 'a.vue', code: vue(`<div :class="ok && 'flex'"></div>`) },
    { filename: 'a.vue', code: vue(`<div :class="cn('flex', ok && 'gap-2')"></div>`) },
    { filename: 'a.vue', code: vue(`<UCard :ui="{ root: 'p-4' }" />`) },
  ],
  invalid: [
    { filename: 'a.vue', code: vue('<div :class="someVar"></div>'), errors: 1 },
    { filename: 'a.vue', code: vue('<div :class="props.klass"></div>'), errors: 1 },
    { filename: 'a.vue', code: vue('<div :class="getClasses()"></div>'), errors: 1 },
    { filename: 'a.vue', code: vue('<UCard :ui="uiConfig" />'), errors: 1 },
    { filename: 'a.vue', code: vue(`<UCard :ui="{ root: rootClass }" />`), errors: 1 },
  ],
})

tester.run('pp/ds-no-inline-style', dsNoInlineStyle, {
  valid: [{ filename: 'a.vue', code: vue('<div class="flex"></div>') }],
  invalid: [
    { filename: 'a.vue', code: vue('<div style="color: red"></div>'), errors: 1 },
    { filename: 'a.vue', code: vue(`<div :style="{ width: w + 'px' }"></div>`), errors: 1 },
  ],
})

tester.run('pp/ds-no-style-block', dsNoStyleBlock, {
  valid: [{ filename: 'a.vue', code: vue('<div></div>') }],
  invalid: [
    {
      filename: 'a.vue',
      code: `${vue('<div></div>')}\n<style scoped>\n.a { display: flex }\n</style>`,
      errors: 1,
    },
  ],
})

tester.run('pp/ds-no-remote-assets', dsNoRemoteAssets, {
  valid: [
    { filename: 'a.vue', code: vue('<DsArt3D src="/assets/3d/trophy.webp" />') },
    { filename: 'a.vue', code: vue('<ULink href="/ujian" />') },
  ],
  invalid: [
    { filename: 'a.vue', code: vue('<DsArt3D src="https://cdn.example.com/x.glb" />'), errors: 1 },
    { filename: 'a.vue', code: vue('<UAvatar src="//cdn.example.com/a.png" />'), errors: 1 },
    { filename: 'a.vue', code: vue(`<DsArt3D :src="'http://x.test/a.webp'" />`), errors: 1 },
    { filename: 'a.vue', code: vue('<div />', `import x from 'https://esm.sh/x'`), errors: 1 },
  ],
})

tester.run('pp/ds-icon-names', dsIconNames, {
  valid: [
    { filename: 'a.vue', code: vue('<UButton icon="i-ph-plus-duotone" />') },
    { filename: 'a.vue', code: vue('<UButton icon="ph:plus-duotone" />') },
    { filename: 'a.vue', code: vue('<UButton icon="plus" />') },
    { filename: 'a.vue', code: vue('<p>i-am-here</p>') },
    { filename: 'a.vue', code: vue('<div />', `const label = 'i-am-here'`) },
    { filename: 'a.vue', code: vue('<div />', `const icon = 'i-ph-check'`) },
    { filename: 'a.vue', code: vue('<div />', `const time = '10:30'`) },
  ],
  invalid: [
    { filename: 'a.vue', code: vue('<UButton icon="i-lucide-plus" />'), errors: 1 },
    { filename: 'a.vue', code: vue('<UButton icon="i-lucide:plus" />'), errors: 1 },
    { filename: 'a.vue', code: vue('<UButton icon="lucide:check" />'), errors: 1 },
    { filename: 'a.vue', code: vue('<UButton trailing-icon="i-heroicons-x-mark" />'), errors: 1 },
    { filename: 'a.vue', code: vue(`<UButton :icon="ok ? 'i-lucide-x' : 'i-ph-x'" />`), errors: 1 },
    { filename: 'a.vue', code: vue('<div />', `const icon = 'lucide:check'`), errors: 1 },
    {
      filename: 'a.vue',
      code: vue('<div />', `const item = { leadingIcon: 'foo:bar' }`),
      errors: 1,
    },
    { filename: 'a.vue', code: vue('<div />', `const x = 'i-lucide-check'`), errors: 1 },
  ],
})
