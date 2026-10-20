import { describe, expect, it } from 'vitest'

import { BULK_ACTION_TO_WIRE, STATUS_FILTER_TO_WIRE } from '../../api/questions'
import { parseMarkdown } from '../../lib/markdown'
import {
  complianceColor,
  bulkOptionsFor,
  notUpdatedLines,
  cut,
  statusOptionsFor,
  errorTextOf,
  excerpt,
  sourceLabel,
  statusColor,
  statusDs,
  statusLabel,
  tileName,
  upperWords,
} from '../../lib/question-list'

describe("status lookups accept the v2 wire lifecycle and never throw", () => {
  it("maps wire values", () => {
    expect(statusLabel("published")).toBe("Diterbitkan")
    expect(statusLabel("review")).toBe("Menunggu Semakan")
    expect(statusLabel("archived", true)).toBe("Arkib")
    expect(statusDs("published")).toBe("approved")
    expect(statusDs("review")).toBe("awaiting-review")
    expect(statusColor("published")).toBe("success")
  })
  it("falls back to a neutral badge for unknown, empty and prototype-key values", () => {
    for (const v of ["mystery", "", "constructor", undefined as unknown as string]) {
      expect(statusLabel(v)).toBe("Tidak diketahui")
      expect(statusDs(v)).toBe("draft")
      expect(statusColor(v)).toBe("neutral")
    }
    expect(complianceColor("weird")).toBe("neutral")
    expect(complianceColor(undefined as unknown as string)).toBe("neutral")
  })
})

describe('question list helpers', () => {
  it('cuts tile names at 12 characters and texts at 80', () => {
    expect(tileName('Bahasa Melayu')).toBe('Bahasa Melay...')
    expect(tileName('Sains')).toBe('Sains')
    expect(excerpt('a'.repeat(80))).toBe('a'.repeat(80))
    expect(excerpt('a'.repeat(81))).toBe(`${'a'.repeat(80)}...`)
  })

  it('labels source, compliance codes and status', () => {
    expect(sourceLabel(null)).toBe('TIADA')
    expect(sourceLabel('marking_scheme')).toBe('MARKING SCHEME')
    expect(upperWords('pending_mapping')).toBe('PENDING MAPPING')
    expect(statusLabel('archived', true)).toBe('Arkib')
    expect(statusLabel('archived')).toBe('Diarkibkan')
    expect(statusLabel('pending')).toBe('Menunggu')
  })

  it('cuts DSKP lines with "..."', () => {
    expect(cut('pendek')).toBe('pendek')
    expect(cut('a'.repeat(61))).toBe(`${'a'.repeat(60)}...`)
  })
})

describe('errorTextOf (FR-M04-46)', () => {
  it('uses the JSON message, else "HTTP {status}"', () => {
    expect(errorTextOf({ status: 500, body: { ok: false, message: 'Tidak tersedia' } })).toBe(
      'Tidak tersedia',
    )
    expect(errorTextOf({ status: 500, body: { ok: false } })).toBe('HTTP 500')
    expect(errorTextOf({ status: 200, body: { ok: false } })).toBe('HTTP 200')
  })

  it('uses the JSON-parse exception text for a non-JSON body', () => {
    expect(errorTextOf({ status: 500, body: '<!DOCTYPE html><html></html>' })).toContain(
      'is not valid JSON',
    )
  })
})

describe('parseMarkdown', () => {
  it('parses headings, lists, tables, code and bold into a tree', () => {
    const fence = '`'.repeat(3)
    const blocks = parseMarkdown(
      [
        '## Penjelasan',
        '',
        '**Jawapan betul:** A',
        '',
        '- satu',
        '- dua',
        '',
        '| a | b |',
        '| --- | --- |',
        '| 1 | 2 |',
        '',
        fence,
        'x < y',
        fence,
      ].join('\n'),
    )
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'table', 'code'])
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 })
    expect(blocks[1]).toMatchObject({
      kind: 'paragraph',
      lines: [
        [
          { kind: 'strong', text: 'Jawapan betul:' },
          { kind: 'text', text: ' A' },
        ],
      ],
    })
    expect(blocks[2]).toMatchObject({ kind: 'list', ordered: false })
    expect(blocks[3]).toMatchObject({ kind: 'table' })
    expect(blocks[4]).toEqual({ kind: 'code', text: 'x < y' })
  })
})

describe('http mode wire values (BE-09 status, bulk actions)', () => {
  it('maps each mock filter value and bulk action to its wire value', () => {
    expect(STATUS_FILTER_TO_WIRE).toEqual({
      draft: 'draft',
      pending_review: 'review',
      approved: 'approved',
      published: 'published',
      archived: 'archived',
    })
    expect(BULK_ACTION_TO_WIRE).toEqual({
      pending_review: 'review',
      approve: 'approved',
      publish: 'published',
      archive: 'archived',
      delete: 'delete',
    })
  })
  it('adds the Diterbitkan filter option in http mode only', () => {
    expect(statusOptionsFor(true).map((o) => o.value)).toEqual([
      'draft',
      'pending_review',
      'approved',
      'published',
      'archived',
    ])
    expect(statusOptionsFor(true).find((o) => o.value === 'published')?.label).toBe('Diterbitkan')
    expect(statusOptionsFor(false).map((o) => o.value)).not.toContain('published')
  })
  it('hides options with no wire equivalent in http mode only', () => {
    expect(statusOptionsFor(true).map((o) => o.value)).not.toContain('rejected')
    expect(statusOptionsFor(false).map((o) => o.value)).toContain('rejected')
    expect(bulkOptionsFor(true).map((o) => o.value)).not.toContain('reject')
    expect(bulkOptionsFor(false).map((o) => o.value)).toContain('reject')
    expect(bulkOptionsFor(true).map((o) => o.value)).toEqual([
      'approve',
      'publish',
      'archive',
      'delete',
    ])
    expect(bulkOptionsFor(true).find((o) => o.value === 'publish')?.label).toBe('Terbitkan')
    expect(bulkOptionsFor(false).map((o) => o.value)).not.toContain('publish')
  })
})

describe('notUpdatedLines', () => {
  it('lists one line per question not updated', () => {
    const lines = notUpdatedLines(1, [8, 9], 'menerbitkan')
    expect(lines[0]).toBe('1 soalan berjaya dikemaskini, 2 tidak dikemaskini.')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('#8')
    expect(lines[2]).toContain('#9')
  })
})
