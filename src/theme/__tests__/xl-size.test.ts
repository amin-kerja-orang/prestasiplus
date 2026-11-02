import { describe, expect, it } from 'vitest'

import { uiConfig } from '@/theme/ui.config'

type SizeMap = Record<string, { base?: string }>
const sizes = (cfg: unknown): SizeMap => (cfg as { variants: { size: SizeMap } }).variants.size

describe('theme size variants keep the 44px touch floor', () => {
  it('button xl, lg and md contain min-h-11 or taller', () => {
    for (const size of ['md', 'lg', 'xl']) {
      expect(sizes(uiConfig.button)[size]?.base, `button ${size}`).toMatch(
        /\bmin-h-(11|12|13|14)\b/,
      )
    }
  })

  it('button xl has a learner floor', () => {
    expect(sizes(uiConfig.button).xl?.base).toMatch(/learner:min-h-/)
  })

  it('every field component defines xl with min-h-11 and the learner min-h-13', () => {
    const fields = [
      'input',
      'textarea',
      'select',
      'selectMenu',
      'inputMenu',
      'inputNumber',
      'inputDate',
      'inputTime',
      'inputTags',
    ] as const
    for (const name of fields) {
      expect(sizes(uiConfig[name]).xl?.base, `${name} xl`).toContain('min-h-11')
      expect(sizes(uiConfig[name]).xl?.base, `${name} xl learner`).toContain('learner:min-h-13')
    }
  })
})
