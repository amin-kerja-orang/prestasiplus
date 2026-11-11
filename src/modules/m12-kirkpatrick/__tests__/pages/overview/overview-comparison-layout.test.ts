// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OverviewComparison from '../../../components/kirkpatrick/overview/OverviewComparison.vue'
import { overview } from '../fixtures'

describe('C-55 comparison panels structure', () => {
  it('SEBELUM and SELEPAS are the two children of one panels container', () => {
    const w = mount(OverviewComparison, {
      props: { comparison: overview().comparison },
      global: {
        stubs: {
          DsPanel: { template: '<div><slot /></div>' },
          UCard: { template: '<div><slot /></div>' },
          UAlert: true,
          UIcon: true,
        },
      },
    })
    const box = w.get('[data-testid="kirk-panels"]')
    const kids = Array.from(box.element.children).map((c) => c.getAttribute('data-testid'))
    expect(kids).toEqual(['kirk-panel-before', 'kirk-panel-after'])
  })
})
