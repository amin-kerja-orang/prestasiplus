// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AttemptShell from '../AttemptShell.vue'
import { clearPosition, positionKey, readPosition, writePosition } from '../lib/photo-store'
import NavigatorPanel, { type NavState } from '../NavigatorPanel.vue'

const sections = [{ id: 's1', label: 'Bahagian A', rule: { type: 'all' } }] as never
const questions = [1, 2, 3].map((n) => ({ id: `q${n}`, number: n, sectionId: 's1' })) as never
const states: Record<string, NavState> = { q1: 'answered', q2: 'flagged', q3: 'none' }

function nav() {
  return mount(NavigatorPanel, {
    props: { sections, questions, states, current: 'q1' },
  })
}

describe('NavigatorPanel (FR-MUR-QP-16: status never by colour alone)', () => {
  it('FR-MUR-QP-16: every question button carries its own icon, one per state', () => {
    const w = nav()
    const icon = (n: number) => w.get(`[data-testid=nav-${n}-icon]`).attributes('data-icon') ?? ''
    expect(icon(1)).toContain('i-ph-check-bold')
    expect(icon(2)).toContain('i-ph-flag-fill')
    expect(icon(3)).toContain('i-ph-minus-bold')
    expect(new Set([icon(1), icon(2), icon(3)]).size).toBe(3)
  })

  it('FR-MUR-QP-16: the icon is decorative; the state stays in the accessible name', () => {
    const w = nav()
    expect(w.get('[data-testid=nav-1-icon]').attributes('aria-hidden')).toBe('true')
    expect(w.get('[data-testid=nav-2]').attributes('aria-label')).toBe('Soalan 2, Ditanda')
    expect(w.get('[data-testid=nav-3]').attributes('aria-label')).toBe('Soalan 3, Belum')
  })

  it('FR-MUR-QP-16: the legend is readable (no aria-hidden) and shows the same icons', () => {
    const w = nav()
    const legend = w.get('[data-testid=nav-legend]')
    expect(legend.attributes('aria-hidden')).toBeUndefined()
    expect(legend.text()).toContain('Dijawab')
    expect(legend.text()).toContain('Ditanda')
    expect(legend.text()).toContain('Belum')
    const html = legend.html()
    expect(html).toContain('data-icon="i-ph-check-bold"')
    expect(html).toContain('data-icon="i-ph-flag-fill"')
    expect(html).toContain('data-icon="i-ph-minus-bold"')
  })

  it('FR-MUR-QP-16: the question grid holds the buttons only, no stray text', () => {
    const w = nav()
    const grid = w.get('section .flex.flex-wrap')
    expect(grid.text().replace(/\s+/g, '')).toBe('123')
  })

  it('keeps the 44 px buttons and the counts line', () => {
    const w = nav()
    expect(w.get('[data-testid=nav-1]').classes()).toContain('size-11')
    expect(w.get('[data-testid=nav-counts]').text()).toBe('Dijawab 1 · Ditanda 1 · Belum 1')
  })
})

describe('AttemptShell (FR-X6-5/8, AC-X6-1)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('FR-X6-8: the frame follows the dynamic viewport height and keeps the three bars', () => {
    const w = mount(AttemptShell, {
      props: { hasStimulus: false },
      slots: { header: '<b>H</b>', footer: '<b>F</b>', main: '<i>M</i>' },
      attachTo: document.body,
    })
    const shell = document.body.querySelector('[data-testid=attempt-shell]')!
    expect(shell.classList.contains('h-dvh')).toBe(true)
    expect(shell.querySelector('[data-part=header]')?.textContent).toBe('H')
    expect(shell.querySelector('[data-part=footer]')?.textContent).toBe('F')
    expect(shell.querySelector('[data-testid=attempt-scroll]')?.textContent).toBe('M')
    w.unmount()
  })

  const css = readFileSync(
    resolve(process.cwd(), 'src/ds/states.css'),
    'utf8',
  )

  it('FR-X6-5: the footer adds the bottom safe-area inset to its padding', () => {
    expect(css).toMatch(/\[data-part='footer'\]\s*\{[^}]*env\(safe-area-inset-bottom/)
  })

  it('AC-X6-1: at heights up to 420 px the title folds, the banner compacts, the timer is not hidden', () => {
    const block = /@media \(max-height: 420px\) \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? ''
    expect(block).toContain('[data-short-hide]')
    expect(block).toContain('display: none')
    expect(block).toContain('[data-short-compact]')
    expect(block).toContain("[data-part='header']")
    // Only elements marked data-short-hide are hidden: the header itself and the clock never are.
    expect(block).not.toMatch(/\[data-part='header'\]\s*\{[^}]*display: none/)
    expect(block).not.toContain('clock')
  })
})

describe('attempt-position (FR-X6-10, FR-MUR-QP-12)', () => {
  beforeEach(() => window.sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('FR-X6-10: round trip under pp.qd.pos.{attemptId}', () => {
    writePosition('a1', { questionIndex: 4, scrollTop: 320 })
    expect(positionKey('a1')).toBe('pp.qd.pos.a1')
    expect(JSON.parse(window.sessionStorage.getItem('pp.qd.pos.a1')!)).toEqual({
      questionIndex: 4,
      scrollTop: 320,
    })
    expect(readPosition('a1')).toEqual({ questionIndex: 4, scrollTop: 320 })
    expect(readPosition('other')).toBeNull()
    clearPosition('a1')
    expect(readPosition('a1')).toBeNull()
  })

  it('FR-X6-10: bad JSON or wrong shape reads as no position', () => {
    window.sessionStorage.setItem('pp.qd.pos.a1', '{nope')
    expect(readPosition('a1')).toBeNull()
    window.sessionStorage.setItem(
      'pp.qd.pos.a1',
      JSON.stringify({ questionIndex: -1, scrollTop: 0 }),
    )
    expect(readPosition('a1')).toBeNull()
    window.sessionStorage.setItem('pp.qd.pos.a1', JSON.stringify({ questionIndex: 2 }))
    expect(readPosition('a1')).toBeNull()
  })

  it('FR-X6-10: blocked or full storage never throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => writePosition('a1', { questionIndex: 1, scrollTop: 1 })).not.toThrow()
    expect(readPosition('a1')).toBeNull()
    expect(() => clearPosition('a1')).not.toThrow()
  })
})
