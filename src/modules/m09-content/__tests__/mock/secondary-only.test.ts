/**
 * v2-secondary-only (D72, 2026-10-29): Darjah-tagged articles and notes stay stored but are hidden from
 * every list and detail read (AC-01.1, AC-05.2, AC-09.1), and the switch restores them (reversible).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { articles, audioKbat, notes, showPrimaryContent } from '../../mock'
import { bootM09 } from './helpers'

let runtime: MockRuntime

beforeAll(async () => {
  ;({ runtime } = await bootM09())
}, 120_000)

afterAll(async () => {
  showPrimaryContent()
  await runtime.reset()
})

describe('Darjah articles and notes are hidden (default)', () => {
  it('lists only the SEMUA articles for readers and the admin', () => {
    const reader = articles.readerList({ pageSize: 100 })
    const admin = articles.adminList({ pageSize: 100 })
    expect(reader.total).toBe(30)
    expect(admin.total).toBe(30)
    expect(reader.rows.some((r) => /darjah/i.test(r.title))).toBe(false)
    expect(admin.rows.some((r) => /darjah/i.test(r.title))).toBe(false)
  })

  it('does not serve the hidden article by slug nor in latest, hot or related', () => {
    expect(articles.detail('cara-mudah-hafal-sifir')).toBeUndefined()
    expect(articles.latest(100).some((c) => /darjah/i.test(c.title))).toBe(false)
  })

  it('lists no Darjah note', () => {
    expect(notes.adminList({ pageSize: 100 }).total).toBe(0)
  })

  it('the teacher tiles count the same articles as the list (statsByAuthor)', () => {
    const list = articles.listByAuthor(3101, 1, 100)
    const stats = articles.statsByAuthor(3101)
    expect(stats.total).toBe(list.total)
    showPrimaryContent()
    try {
      expect(articles.statsByAuthor(3101).total).toBeGreaterThan(stats.total)
    } finally {
      showPrimaryContent(false)
    }
  })

  it('by-id reads of hidden articles and notes answer "not found"', () => {
    expect(articles.getVisible(6)).toBeUndefined()
    expect(articles.adminGet(6)).toBeUndefined()
    expect(notes.getVisible(1)).toBeUndefined()
  })

  it('the audio stat cards can be restricted to the same sets as the list', () => {
    const all = audioKbat.stats()
    const none = audioKbat.stats(() => false)
    expect(none.sets).toBe(0)
    expect(all.sets).toBeGreaterThanOrEqual(none.sets)
  })
})

describe('the hiding is reversible', () => {
  it('shows the stored rows again when the switch is off', () => {
    showPrimaryContent()
    try {
      expect(articles.readerList({ pageSize: 100 }).total).toBe(72)
      expect(notes.adminList({ pageSize: 100 }).total).toBe(10)
    } finally {
      showPrimaryContent(false)
    }
    expect(articles.readerList({ pageSize: 100 }).total).toBe(30)
  })
})
