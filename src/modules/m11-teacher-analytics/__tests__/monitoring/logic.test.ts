// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import {
  accuracyBand,
  avg,
  dmyHm,
  pct,
  pct1,
  subscriptionDate,
} from '../../components/monitoring/monitoring-format'
import { buildCsv, csvCell, CSV_BOM } from '../../components/monitoring/monitoring-csv'
import { monitoringPaths } from '../../components/monitoring/monitoring-paths'
import { safeHtml } from '../../components/monitoring/safe-html'
import { formatCountdown, useAutoRefresh } from '../../components/monitoring/use-auto-refresh'

describe('monitoring paths (BR-M11-27, prefix as a prop)', () => {
  it('builds every link from the mount prefix', () => {
    const p = monitoringPaths('/guru/monitoring')
    expect(p.overview).toBe('/guru/monitoring')
    expect(p.school(8080)).toBe('/guru/monitoring/sekolah/8080')
    expect(p.student(8080, 2008)).toBe('/guru/monitoring/sekolah/8080/pelajar/2008')
    expect(p.teacher(8080, 2012)).toBe('/guru/monitoring/sekolah/8080/guru/2012')
    expect(p.kirkpatrickStudent(4664)).toBe('/guru/kirkpatrick/pelajar/4664')
    const a = monitoringPaths('/admin-sekolah/monitoring/')
    expect(a.overview).toBe('/admin-sekolah/monitoring')
    expect(a.kirkpatrickStudent(1)).toBeNull()
    expect(monitoringPaths('/admin/monitoring').school(940)).toBe('/admin/monitoring/sekolah/940')
  })

  it('export hrefs carry the set filters in order, "?" alone when none (FR-M11-31)', () => {
    const p = monitoringPaths('/guru/monitoring')
    expect(p.exportHref('pdf', { period: '', state: '', tahap: '' })).toBe(
      '/guru/monitoring/export/pdf?',
    )
    expect(p.exportHref('csv', { period: '7d', state: '', tahap: '' })).toBe(
      '/guru/monitoring/export/csv?period=7d',
    )
    expect(p.exportHref('csv', { period: '', state: 'Selangor', tahap: 'Kritikal' })).toBe(
      '/guru/monitoring/export/csv?state=Selangor&tahap=Kritikal',
    )
    expect(p.exportHref('pdf', { period: '', state: '', tahap: 'Tiada Langsung' })).toBe(
      '/guru/monitoring/export/pdf?tahap=Tiada%20Langsung',
    )
  })
})

describe('formats (BR-M11-11, 22)', () => {
  it('drops ".0" on monitoring figures and keeps it on S4 accuracy', () => {
    expect(pct(35.2)).toBe('35.2%')
    expect(pct(100)).toBe('100%')
    expect(avg(323.1)).toBe('323.1')
    expect(avg(323)).toBe('323')
    expect(pct1(100)).toBe('100.0%')
    expect(pct1(74.6)).toBe('74.6%')
  })

  it('subscription date keeps the English month; datetimes are MYT', () => {
    expect(subscriptionDate('2027-05-12T00:00:00+08:00')).toBe('12 Mei 2027')
    expect(dmyHm('2026-06-16T14:19:57+08:00')).toBe('16/06/2026 14:19')
    expect(dmyHm(null)).toBe('-')
  })

  it('accuracy bands: >= 70 good, 50-69.9 mid, < 50 low', () => {
    expect(accuracyBand(70)).toBe('good')
    expect(accuracyBand(69.9)).toBe('mid')
    expect(accuracyBand(50)).toBe('mid')
    expect(accuracyBand(49.9)).toBe('low')
  })
})

describe('safeHtml', () => {
  it('keeps text and simple tags, drops scripts, handlers and attributes', () => {
    const out = safeHtml(
      '<p onclick="x()">Hai <b>dunia</b><script>alert(1)</script><a href="javascript:x">pautan</a></p>',
    )
    expect(out).toBe('<p>Hai <b>dunia</b>pautan</p>')
  })

  const hostile: [string, string, string][] = [
    ['noscript is dropped with its content', 'a<noscript><p>x</p></noscript>b', 'ab'],
    ['template is dropped with its content', 'a<template><b>x</b></template>b', 'ab'],
    ['img onerror is unwrapped, no tag survives', 'a<img src="x" onerror="alert(1)">b', 'ab'],
    ['javascript: link keeps only its text', '<a href="javascript:alert(1)">klik</a>', 'klik'],
    ['data: link keeps only its text', '<a href="data:text/html,x">klik</a>', 'klik'],
    [
      'nested unknown tags are unwrapped',
      '<foo><bar>satu <i>dua</i></bar></foo>',
      'satu <i>dua</i>',
    ],
    ['svg with a script is dropped', 'a<svg><script>x</script><circle/></svg>b', 'ab'],
    [
      'iframe, object and embed are dropped',
      'a<iframe src="x"></iframe><object></object><embed>b',
      'ab',
    ],
    ['style is dropped', 'a<style>p{}</style>b', 'ab'],
    [
      'table tags are unwrapped to their text (known limitation)',
      '<table><tr><td>sel</td></tr></table>',
      'sel',
    ],
    ['every attribute is removed', '<span class="x" style="y" id="z">t</span>', '<span>t</span>'],
    ['markup in an attribute value stays inert', '<p title="<script>x</script>">t</p>', '<p>t</p>'],
  ]
  it.each(hostile)('%s', (_name, input, expected) => {
    expect(safeHtml(input)).toBe(expected)
  })

  it('returns an empty string without DOMParser', () => {
    vi.stubGlobal('DOMParser', undefined)
    try {
      expect(safeHtml('<p>x</p>')).toBe('')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('CSV export cells (formula-injection guard, BOM)', () => {
  it('prefixes text cells that start with = + - @ , tab or CR with an apostrophe', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"')
    expect(csvCell('+1')).toBe('"\'+1"')
    expect(csvCell('-cmd')).toBe('"\'-cmd"')
    expect(csvCell('@x')).toBe('"\'@x"')
    expect(csvCell('\tx')).toBe('"\'\tx"')
  })

  it('leaves normal text, numbers, null and the lone "-" placeholder alone; doubles quotes', () => {
    expect(csvCell('SMK Satu')).toBe('"SMK Satu"')
    expect(csvCell(-5)).toBe('"-5"')
    expect(csvCell(null)).toBe('""')
    expect(csvCell('-')).toBe('"-"')
    expect(csvCell('a"b')).toBe('"a""b"')
  })

  it('buildCsv starts with the UTF-8 BOM and joins rows with newlines', () => {
    const csv = buildCsv(
      ['#', 'Sekolah'],
      [
        [1, '=evil'],
        [2, 'SMK'],
      ],
    )
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv.slice(1).split('\n')).toEqual(['"#","Sekolah"', '"1","\'=evil"', '"2","SMK"'])
  })
})

describe('auto-refresh (BR-M11-25)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('formats m:ss', () => {
    expect(formatCountdown(300)).toBe('5:00')
    expect(formatCountdown(299)).toBe('4:59')
    expect(formatCountdown(61)).toBe('1:01')
    expect(formatCountdown(-3)).toBe('0:00')
  })

  function host(onReload: () => void) {
    let api!: ReturnType<typeof useAutoRefresh>
    const Host = defineComponent({
      setup() {
        api = useAutoRefresh(onReload)
        return () => h('div')
      },
    })
    const wrapper = mount(Host)
    return { wrapper, api: () => api }
  }

  it('counts down once per second, pauses, resumes and reloads at 0', () => {
    const reload = vi.fn()
    const { wrapper, api } = host(reload)
    expect(api().display.value).toBe('5:00')
    vi.advanceTimersByTime(1000)
    expect(api().display.value).toBe('4:59')
    api().toggle()
    vi.advanceTimersByTime(5000)
    expect(api().display.value).toBe('4:59')
    expect(api().running.value).toBe(false)
    api().toggle()
    vi.advanceTimersByTime(1000)
    expect(api().display.value).toBe('4:58')
    vi.advanceTimersByTime(298_000)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(api().display.value).toBe('5:00')
    wrapper.unmount()
    vi.advanceTimersByTime(5000)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
