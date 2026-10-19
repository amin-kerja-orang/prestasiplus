import { describe, expect, it } from 'vitest'

import { parseMarkdown } from '../../lib/markdown'
import {
  cut,
  errorTextOf,
  excerpt,
  sourceLabel,
  statusLabel,
  tileName,
  upperWords,
} from '../../lib/question-list'

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
