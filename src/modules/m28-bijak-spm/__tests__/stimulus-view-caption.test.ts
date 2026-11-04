// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { StimulusView } from '../../../components/question-display'
import type { StimulusDef } from '../domain/types'

const passage = (over: Partial<StimulusDef>): StimulusDef =>
  ({ id: 's1', kind: 'passage', label: 'Petikan 1', alt: '', page: 1, ...over }) as StimulusDef

describe('StimulusView passage caption (REQ-B-036)', () => {
  it('shows the passage text once when caption equals the body', () => {
    const t = 'Ali pergi ke pasar.'
    const w = mount(StimulusView, { props: { stimulus: passage({ text: t, caption: ` ${t} ` }) } })
    expect(w.text().split(t).length - 1).toBe(1)
    expect(w.find('figcaption').text()).toBe('Petikan 1')
  })
  it('keeps a caption that differs from the body', () => {
    const w = mount(StimulusView, {
      props: { stimulus: passage({ text: 'Ali pergi ke pasar.', caption: 'Sumber: buku' }) },
    })
    expect(w.find('figcaption').text()).toContain('Sumber: buku')
  })
})
