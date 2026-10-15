// Tests of stylelint.config.mjs (V2-T04): colour literals, lines, remote urls and !important are
// rejected; the ds level additionally allows colour-mix and gradients.
import { describe, expect, it } from 'vitest'
import stylelint from 'stylelint'

import config, { dsConfig } from '../../stylelint.config.mjs'

const lint = async (code, codeFilename = 'a.css', cfg = config) => {
  const { results } = await stylelint.lint({ code, codeFilename, config: cfg })
  return (results[0]?.warnings ?? []).map((w) => w.rule)
}

describe('stylelint ds config', () => {
  it('accepts token-based css', async () => {
    expect(await lint('.a { display: flex; color: var(--ui-text-muted); gap: 8px }')).toEqual([])
  })

  const both = [
    ['.a { color: #fff }', 'color-no-hex'],
    ['.a { color: red }', 'color-named'],
    ['.a { color: rgb(0 0 0) }', 'function-disallowed-list'],
    ['.a { color: oklch(0.5 0.1 200) }', 'function-disallowed-list'],
    ['.a { border: 1px solid }', 'property-disallowed-list'],
    ['.a { border-bottom-width: 1px }', 'property-disallowed-list'],
    ['.a { outline: none }', 'property-disallowed-list'],
    ['.a { display: none !important }', 'declaration-no-important'],
    [
      '.a { background: url(https://cdn.example.com/a.png) }',
      'function-url-scheme-disallowed-list',
    ],
    ['.a { background: url(http://cdn.example.com/a.png) }', 'function-url-scheme-disallowed-list'],
    ['@import url("./other.css");', 'at-rule-disallowed-list'],
    ['@import "https://fonts.example.com/x.css";', 'at-rule-disallowed-list'],
  ]
  it.each(both)('page level rejects %s', async (code, rule) => {
    expect(await lint(code)).toContain(rule)
  })
  it.each(both)('ds level rejects %s', async (code, rule) => {
    expect(await lint(code, 'a.css', dsConfig)).toContain(rule)
  })

  it('local url() is fine', async () => {
    expect(await lint('.a { background: url(/assets/a.webp) }')).toEqual([])
  })

  it('page level rejects gradients and color-mix, ds level allows token-based ones', async () => {
    const grad = '.a { background: linear-gradient(135deg, var(--ds-c1), var(--ds-primary-2)) }'
    const mix = '.a { color: color-mix(in oklab, var(--ui-primary) 10%, transparent) }'
    expect(await lint(grad)).toContain('function-disallowed-list')
    expect(await lint(mix)).toContain('function-disallowed-list')
    expect(await lint(grad, 'a.css', dsConfig)).toEqual([])
    expect(await lint(mix, 'a.css', dsConfig)).toEqual([])
  })

  it('ds level still rejects colour literals inside gradients', async () => {
    const bad = '.a { background: linear-gradient(135deg, #fff, red) }'
    const rules = await lint(bad, 'a.css', dsConfig)
    expect(rules).toContain('color-no-hex')
    expect(rules).toContain('color-named')
  })

  it('checks <style> blocks of .vue files', async () => {
    const code = '<template><div /></template>\n<style>\n.a { border: 0 }\n</style>\n'
    expect(await lint(code, 'a.vue')).toContain('property-disallowed-list')
  })
})
