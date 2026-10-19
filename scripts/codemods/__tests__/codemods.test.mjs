// Unit tests of the Wave 2 codemods (CM-1, CM-6, CM-7): pure functions on strings.
import { describe, expect, it } from 'vitest'

import { rewriteClassList } from '../cm1-tokens.mjs'
import { transformSource as cm6 } from '../cm6-props.mjs'
import { pruneUi, transformSource as cm7 } from '../cm7-ui.mjs'
import { Report } from '../lib.mjs'

const run = (fn, src) => fn('src/x/Test.vue', src, new Report('t'))

describe('CM-1 token class rewrites', () => {
  it('maps the ad-hoc alphas to the two tints, keeping variants', () => {
    expect(rewriteClassList('hover:bg-primary/10 bg-error/20 bg-info/40').text).toBe(
      'hover:bg-primary-soft bg-error-strong bg-info/40',
    )
  })
  it('text-primary becomes text-primary-t (D-H8) and text-primary-t stays', () => {
    expect(rewriteClassList('text-primary hover:text-primary').text).toBe(
      'text-primary-t hover:text-primary-t',
    )
    expect(rewriteClassList('text-primary-t').text).toBe('text-primary-t')
  })
  it('drops a weight the role already sets and a stock size next to a role', () => {
    expect(rewriteClassList('text-label font-semibold').text).toBe('text-label')
    expect(rewriteClassList('text-heading text-xl font-bold').text).toBe('text-heading')
    expect(rewriteClassList('text-body font-semibold').text).toBe('text-body font-semibold')
  })
  it('maps stock sizes, text-sm + semibold to the label role', () => {
    expect(rewriteClassList('flex text-xs text-muted').text).toBe('flex text-caption text-muted')
    expect(rewriteClassList('text-sm font-semibold').text).toBe('text-label')
    expect(rewriteClassList('sm:text-sm').text).toBe('sm:text-body')
    expect(rewriteClassList('text-xs', { keepStock: true }).text).toBe('text-xs')
  })
  it('is idempotent', () => {
    const once = rewriteClassList('text-sm font-semibold text-primary bg-primary/12').text
    expect(rewriteClassList(once).text).toBe(once)
  })
})

describe('CM-6 prop renames', () => {
  const t = (tpl) => run(cm6, `<template>${tpl}</template>`)
  it('rewrites the deprecated aliases', () => {
    expect(t('<DsStatTile compact value-class="text-success" />')).toContain(
      '<DsStatTile density="compact" value-tone="success" />',
    )
    expect(t('<DsPanel tone="float" flush />')).toContain('<DsPanel behavior="float" padding="none" />')
    expect(t('<DsLoadError inline />')).toContain('<DsLoadError variant="inline" />')
    expect(t('<DsFilterBar tone="plain" />')).toContain('<DsFilterBar surface="plain" />')
    expect(t('<DsCharacterCard variant="warning" />')).toContain('accent="heat"')
    expect(t('<DsFeedbackSheet :tone="ok ? \'good\' : \'bad\'" />')).toContain("ok ? 'success' : 'error'")
    expect(t('<DsDataTable compact-cells />')).toContain('density="compact"')
    expect(t('<DsIconChip icon="i-ph-fire-duotone" />')).toContain('icon="fire"')
  })
  it('leaves what it cannot map', () => {
    expect(t('<DsPanel :tone="x" />')).toContain(':tone="x"')
    expect(t('<DsStatTile :value-class="cls" />')).toContain(':value-class="cls"')
  })
  it('maps the surface layers, dimmed tone and all bundled icons', () => {
    expect(t('<DsPanel tone="inset" />')).toContain('<DsPanel level="inset" />')
    expect(t('<DsPanel tone="tint" />')).toContain('<DsPanel level="tint" />')
    expect(t('<DsStatTile value-class="text-dimmed" />')).toContain('value-tone="dimmed"')
    expect(t('<DsIconChip icon="i-ph-users-three-duotone" />')).toContain('icon="users-three"')
    expect(t('<DsIconChip icon="i-ph-lock" />')).toContain('icon="lock"')
  })
  it('rewrites object callers', () => {
    expect(run(cm6, "confirm({ message: 'x', tone: 'danger' })")).toContain("tone: 'error'")
    expect(run(cm6, "{ valueClass: 'text-error' }")).toContain("valueTone: 'error'")
  })
})

describe('CM-7 :ui removal', () => {
  it('removes covered tokens and keeps the rest', () => {
    const src = `<template><UTabs :ui="{ list: 'overflow-x-auto', content: 'pt-6' }" /></template>`
    expect(run(cm7, src)).toContain(`:ui="{ content: 'pt-6' }"`)
  })
  it('drops the attribute when nothing is left', () => {
    const src = `<template><UProgress :ui="{ base: 'bg-elevated rounded-full' }" /></template>`
    expect(run(cm7, src)).not.toContain(':ui')
  })
  it('turns UCard body padding into DsCard padding', () => {
    const src = `<script setup lang="ts">
import { DsPanel } from '@/ds'
</script>
<template><UCard :ui="{ body: 'flex gap-2 p-3 sm:p-3' }">x</UCard></template>`
    const out = run(cm7, src)
    expect(out).toContain(`<DsCard padding="sm" :ui="{ body: 'flex gap-2' }">x</DsCard>`)
    expect(out).toContain("import { DsPanel, DsCard } from '@/ds'")
    expect(run(cm7, `<template><UCard :ui="{ body: 'p-4' }">x</UCard></template>`)).toBe(
      '<template><UCard>x</UCard></template>',
    )
  })
  it('keeps overrides the defaults do not cover', () => {
    expect(pruneUi("{ body: 'p-3' }", 'UCard', { props: [] })).toBeNull()
  })
})
