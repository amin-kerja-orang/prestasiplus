import { describe, expect, it } from 'vitest'

import { Chart, registerChartComponents } from '../register'

describe('registerChartComponents (F-17)', () => {
  it('registers the line chart pieces the SRS configs use', () => {
    registerChartComponents()
    registerChartComponents() // idempotent
    expect(Chart.registry.getController('line')).toBeDefined()
    expect(Chart.registry.getElement('line')).toBeDefined()
    expect(Chart.registry.getElement('point')).toBeDefined()
    expect(Chart.registry.getScale('category')).toBeDefined()
    expect(Chart.registry.getScale('linear')).toBeDefined()
    expect(Chart.registry.getPlugin('filler')).toBeDefined()
    expect(Chart.registry.getPlugin('legend')).toBeDefined()
    expect(Chart.registry.getPlugin('tooltip')).toBeDefined()
  })

  it('does not register unused controllers (tree-shaking)', () => {
    registerChartComponents()
    expect(() => Chart.registry.getController('bar')).toThrow()
    expect(() => Chart.registry.getController('doughnut')).toThrow()
  })
})
