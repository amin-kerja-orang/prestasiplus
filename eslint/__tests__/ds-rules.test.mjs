// Unit tests of the design-system guard rules (V2-T04): class allowlist, inline style, <style>
// blocks, remote assets and icon names. Run with `npm run test`.
import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'
import vueParser from 'vue-eslint-parser'

import { classifyToken } from '../class-allowlist.mjs'
import dsClassAllowlist from '../rules/ds-class-allowlist.mjs'
import dsIconNames from '../rules/ds-icon-names.mjs'
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

describe('classifyToken', () => {
  it.each([
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
    'text-center',
    'aspect-square',
    'md:grid-cols-2',
    'lg:flex',
    'pointer-coarse:min-h-12',
    'hover:text-muted',
    'dark:bg-muted',
    'text-default',
    'text-muted',
    'text-error',
    'bg-elevated',
    'bg-soft',
    'text-display',
    'text-overline',
    'tabular',
    'i-ph-check-circle-duotone',
    'sr-only',
  ])('allows %s', (token) => {
    expect(classifyToken(token)).toBeNull()
  })

  it.each([
    ['bg-blue-500', 'palette'],
    ['text-red-600', 'palette'],
    ['bg-kobalt-500', 'palette'],
    ['text-ink-700', 'palette'],
    ['bg-white', 'palette'],
    ['text-black', 'palette'],
    ['w-[13px]', 'arbitrary'],
    ['bg-(--my-colour)', 'arbitrary'],
    ['text-[#ff0000]', 'arbitrary'],
    ['border', 'lines'],
    ['border-b', 'lines'],
    ['border-default', 'lines'],
    ['divide-y', 'lines'],
    ['outline-none', 'lines'],
    ['ring-2', 'lines'],
    ['ring-offset-2', 'lines'],
    ['shadow-lg', 'shadow'],
    ['rounded-xl', 'radius'],
    ['bg-gradient-to-r', 'gradient'],
    ['from-primary', 'gradient'],
    ['z-50', 'decoration'],
    ['transition-all', 'decoration'],
    ['font-bold', 'decoration'],
    ['opacity-50', 'decoration'],
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
    ['bg-primary', 'unknown'],
    ['bogus:flex', 'variant'],
  ])('rejects %s (%s)', (token, code) => {
    expect(classifyToken(token)?.code).toBe(code)
  })
})

tester.run('pp/ds-class-allowlist', dsClassAllowlist, {
  valid: [
    { filename: 'a.vue', code: vue('<div class="flex items-center gap-4 md:grid-cols-2"></div>') },
    { filename: 'a.vue', code: vue('<UCard class="text-muted bg-elevated p-4" />') },
    { filename: 'a.vue', code: vue(`<div :class="['flex', ok ? 'gap-2' : 'gap-4']"></div>`) },
    { filename: 'a.vue', code: vue(`<div :class="{ 'flex-col': ok, grid: !ok }"></div>`) },
    { filename: 'a.vue', code: vue('<div :class="`flex ${dyn} gap-2`"></div>') },
    { filename: 'a.vue', code: vue('<div :class="dynamicVariable"></div>') },
  ],
  invalid: [
    {
      filename: 'a.vue',
      code: vue('<div class="flex bg-blue-500"></div>'),
      errors: [{ message: /Palette colour .* \[bg-blue-500\]/ }],
    },
    {
      filename: 'a.vue',
      code: vue('<div class="w-[300px]"></div>'),
      errors: [{ message: /Arbitrary values/ }],
    },
    {
      filename: 'a.vue',
      code: vue('<div class="border-b divide-y ring-2 outline-none"></div>'),
      errors: 4,
    },
    {
      filename: 'a.vue',
      code: vue('<div class="shadow-md rounded-lg bg-gradient-to-r from-primary"></div>'),
      errors: 4,
    },
    {
      filename: 'a.vue',
      code: vue(`<div :class="['flex', ok ? 'rounded-xl' : 'p-5']"></div>`),
      errors: 2,
    },
    { filename: 'a.vue', code: vue(`<div :class="{ 'shadow-lg': ok }"></div>`), errors: 1 },
    { filename: 'a.vue', code: vue('<div :class="`flex ${dyn} text-red-500`"></div>'), errors: 1 },
    { filename: 'a.vue', code: vue('<div class="custom-thing"></div>'), errors: 1 },
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
    {
      filename: 'a.vue',
      code: vue('<div />', `import x from 'https://esm.sh/x'`),
      errors: 1,
    },
  ],
})

tester.run('pp/ds-icon-names', dsIconNames, {
  valid: [
    { filename: 'a.vue', code: vue('<UButton icon="i-ph-plus-duotone" />') },
    { filename: 'a.vue', code: vue('<UButton icon="plus" />') },
    { filename: 'a.vue', code: vue('<p>i-am-here</p>') },
  ],
  invalid: [
    { filename: 'a.vue', code: vue('<UButton icon="i-lucide-plus" />'), errors: 1 },
    { filename: 'a.vue', code: vue('<UButton trailing-icon="i-heroicons-x-mark" />'), errors: 1 },
    { filename: 'a.vue', code: vue(`<UButton :icon="ok ? 'i-lucide-x' : 'i-ph-x'" />`), errors: 1 },
    { filename: 'a.vue', code: vue('<div />', `const icon = 'i-lucide-check'`), errors: 1 },
  ],
})
