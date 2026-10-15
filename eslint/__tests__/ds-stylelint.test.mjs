// Tests of stylelint.config.mjs (V2-T04): colour literals, lines and !important are rejected.
import { describe, expect, it } from 'vitest'
import stylelint from 'stylelint'

import config from '../../stylelint.config.mjs'

const lint = async (code, codeFilename = 'a.css') => {
  const { results } = await stylelint.lint({ code, codeFilename, config })
  return (results[0]?.warnings ?? []).map((w) => w.rule)
}

describe('stylelint ds config', () => {
  it('accepts token-based css', async () => {
    expect(await lint('.a { display: flex; color: var(--ui-text-muted); gap: 8px }')).toEqual([])
  })

  it.each([
    ['.a { color: #fff }', 'color-no-hex'],
    ['.a { color: red }', 'color-named'],
    ['.a { color: rgb(0 0 0) }', 'function-disallowed-list'],
    ['.a { color: oklch(0.5 0.1 200) }', 'function-disallowed-list'],
    ['.a { background: linear-gradient(red, blue) }', 'function-disallowed-list'],
    ['.a { border: 1px solid }', 'property-disallowed-list'],
    ['.a { border-bottom-width: 1px }', 'property-disallowed-list'],
    ['.a { outline: none }', 'property-disallowed-list'],
    ['.a { display: none !important }', 'declaration-no-important'],
  ])('rejects %s', async (code, rule) => {
    expect(await lint(code)).toContain(rule)
  })

  it('checks <style> blocks of .vue files', async () => {
    const code = '<template><div /></template>\n<style>\n.a { border: 0 }\n</style>\n'
    expect(await lint(code, 'a.vue')).toContain('property-disallowed-list')
  })
})
