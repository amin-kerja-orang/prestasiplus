// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import TableFillGrid, { type TableFillGridData } from '../TableFillGrid.vue'

const grid: TableFillGridData = {
  rows: 2,
  cols: 3,
  cells: [
    [
      { type: 'tajuk', text: 'Negeri' },
      { type: 'tajuk', text: 'Ibu negeri' },
      { type: 'tajuk', text: 'Kod' },
    ],
    [{ type: 'diberi', text: 'Perak' }, { type: 'kosong' }, { type: 'kosong' }],
  ],
}

describe('TableFillGrid', () => {
  it('tajuk is a read-only th, diberi read-only text, only kosong cells are inputs', () => {
    const w = mount(TableFillGrid, { props: { grid } })
    expect(w.findAll('th').map((t) => t.text())).toEqual(['Negeri', 'Ibu negeri', 'Kod'])
    expect(w.findAll('td')[0]!.text()).toBe('Perak')
    expect(w.findAll('td')[0]!.find('input').exists()).toBe(false)
    expect(w.findAll('input')).toHaveLength(2)
  })

  it.each([375, 768, 1280])(
    'inputs are >= 44px and the grid scrolls in its own container at %ipx',
    (width) => {
      window.innerWidth = width
      const wide: TableFillGridData = {
        rows: 1,
        cols: 10,
        cells: [Array.from({ length: 10 }, () => ({ type: 'kosong' as const }))],
      }
      const w = mount(TableFillGrid, { props: { grid: wide } })
      for (const i of w.findAll('input')) expect(i.classes()).toContain('min-h-11')
      const box = w.find('[data-testid=table-fill-scroll]')
      expect(box.classes()).toContain('overflow-x-auto')
      expect(box.classes()).toContain('max-w-full')
    },
  )

  it('v-model keys are r{row}c{col}, 1-based, and keep other cells', async () => {
    const w = mount(TableFillGrid, { props: { grid, modelValue: { r2c3: 'K1' } } })
    expect((w.find('[data-testid=cell-r2c3]').element as HTMLInputElement).value).toBe('K1')
    await w.find('[data-testid=cell-r2c2]').setValue('Ipoh')
    expect(w.emitted('update:modelValue')![0]).toEqual([{ r2c3: 'K1', r2c2: 'Ipoh' }])
  })

  it('readonly locks the inputs; caption renders when given', () => {
    const w = mount(TableFillGrid, { props: { grid, readonly: true, caption: 'Jadual 1' } })
    expect(w.findAll('input').every((i) => i.attributes('readonly') !== undefined)).toBe(true)
    expect(w.find('caption').text()).toBe('Jadual 1')
  })

  it('given text is sanitised markup, not raw HTML', () => {
    const g: TableFillGridData = {
      rows: 1,
      cols: 1,
      cells: [[{ type: 'diberi', text: '<script>x</script><b>ok</b>' }]],
    }
    const w = mount(TableFillGrid, { props: { grid: g } })
    expect(w.find('script').exists()).toBe(false)
    expect(w.find('td b').text()).toBe('ok')
  })
})
