import { describe, expect, it } from 'vitest'

import {
  barWidths,
  bannerKind,
  bannerStyle,
  chestDots,
  COUNT_RULES,
  cutText,
  greetingText,
  questBarPct,
  questPct,
  QUEST_DIFFICULTY,
  revisionBadge,
  showKombo,
  starStates,
  subjectColorByName,
} from '../../components/dashboard/dashboard-lib'

describe('dashboard-lib', () => {
  it('maps the banner type to the live icon family and falls back to FEATURE', () => {
    expect(bannerKind({ type: 'HERO' })).toBe('HERO')
    expect(bannerKind({ type: 'announcement' })).toBe('ANNOUNCEMENT')
    expect(bannerKind({ type: 'SOMETHING_ELSE' })).toBe('FEATURE')
    expect(bannerStyle({ type: 'PROMOTIONAL' }).card).toContain('pink')
  })

  it('draws quest bars as progress ÷ target clamped to 0–100 and full when completed', () => {
    expect(questPct(2, 3)).toBeCloseTo(66.67, 1)
    expect(questPct(9, 3)).toBe(100)
    expect(questPct(1, 0)).toBe(0)
    expect(questBarPct({ progress: 3, target: 3, completed: true })).toBe(100)
    expect(questBarPct({ progress: 1, target: 4, completed: false })).toBe(25)
  })

  it('scales the difficulty bars by the maximum (FR-M05-27)', () => {
    const w = barWidths([39694, 47138, 33720, 9600, 0])
    expect(w[1]).toBe(100)
    expect(w[4]).toBe(0)
    expect(w[0]).toBeCloseTo(84.208, 2)
    expect(barWidths([0, 0])).toEqual([0, 0])
  })

  it('fills the star rows (amber) and the chest dots (FR-M05-14, 26, 28)', () => {
    expect(starStates(3)).toEqual([true, true, true, false, false])
    expect(starStates(2.4)).toEqual([true, true, false, false, false])
    expect(starStates(0)).toEqual([false, false, false, false, false])
    expect(starStates(9)).toEqual([true, true, true, true, true])
    expect(chestDots(4).filter(Boolean)).toHaveLength(4)
    expect(chestDots(0)).toHaveLength(10)
  })

  it('shows the Kombo reminder only for a live streak without practice today (FR-M05-09)', () => {
    expect(showKombo({ count: 1, practisedToday: false })).toBe(true)
    expect(showKombo({ count: 3, practisedToday: true })).toBe(false)
    expect(showKombo({ count: 0, practisedToday: false })).toBe(false)
  })

  it('renders the revision badge only when there are queued questions (FR-M05-18)', () => {
    expect(revisionBadge(72)).toBe('72')
    expect(revisionBadge(0)).toBeNull()
  })

  it('builds the greeting, the difficulty chips and the colour lookup', () => {
    expect(greetingText('Petang', 'Admin Demo')).toBe('Selamat Petang, Admin Demo')
    expect(QUEST_DIFFICULTY.easy.label).toBe('Mudah')
    expect(QUEST_DIFFICULTY.medium.label).toBe('Sederhana')
    expect(QUEST_DIFFICULTY.hard.chip).toContain('red')
    expect(subjectColorByName([{ name: 'Sains', color: '#10B981' }], 'Sains')).toBe('#10B981')
    expect(subjectColorByName([], 'Sains')).toBe('#64748B')
  })

  it('cuts text at 100 characters + "..."', () => {
    expect(cutText('a'.repeat(100))).toHaveLength(100)
    expect(cutText('a'.repeat(101))).toBe(`${'a'.repeat(100)}...`)
  })

  it('keeps the live count-up steps (FN-M05-1.3.3 / 1.7.2)', () => {
    expect(COUNT_RULES.coins.step(256)).toBe(13)
    expect(COUNT_RULES.points.delayMs).toBe(150)
    expect(COUNT_RULES.streak.step()).toBe(1)
    expect(COUNT_RULES.accuracy.step(70)).toBe(3)
    expect(COUNT_RULES.totalQuestions.step(130152)).toBe(4339)
    expect(COUNT_RULES.approvedQuestions.intervalMs).toBe(30)
  })
})
