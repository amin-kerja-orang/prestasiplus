/**
 * OC-4 pure transform: a body-only V2 PKSK question becomes a draft PKSK question (domain and level tags, one empty pksk_choice leaf).
 * Synthetic text only.
 */
import { PKSK_DOMAIN_CODES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { domainCodeOf, foldDomain, pkskLevelOf, transformPksk } from '../../../src/migration/load/questions/pksk-plan'
import type { Curriculum } from '../../../src/migration/transform/question-bank'

const cur: Curriculum = {
  subjects: new Map(),
  levels: new Map([['1', '21'], ['2', '22'], ['3', '23']]),
  chapters: new Map(),
  topics: new Map(),
  levelCodes: new Map([['21', 'T1'], ['22', 'T4'], ['23', 'D1']]),
  topicChapter: new Map(),
}

const row = (over: Record<string, string | null> = {}) => ({
  id: '5', bahagian: 'B', domain: 'Matematik', body: 'Soalan contoh.', status: 'approved', education_level_id: '1', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-02T00:00:00Z', ...over,
})

describe('domain mapping', () => {
  it('maps the 15 V3 domain names (either language) and codes, folding case, spacing and the ampersand', () => {
    expect(domainCodeOf('Matematik')).toBe('PKSK_MATH')
    expect(domainCodeOf('  kecerdasan   INSANIAH ')).toBe('PKSK_INSANIAH')
    expect(domainCodeOf('Sukan & Pencapaian')).toBe('PKSK_SUKAN')
    expect(domainCodeOf('Sukan dan Pencapaian')).toBe('PKSK_SUKAN')
    expect(domainCodeOf('Teknologi &amp; IT')).toBe('PKSK_TECH')
    expect(domainCodeOf('Malaysian History')).toBe('PKSK_SEJ')
    expect(domainCodeOf('PKSK_ESSAY')).toBe('PKSK_ESSAY')
    expect(domainCodeOf('Tidak dikenali')).toBeNull()
    expect(domainCodeOf(null)).toBeNull()
    expect(foldDomain('A  &  B')).toBe('a dan b')
  })

  it('reaches every one of the 15 PKSK_DOMAIN_CODES', () => {
    for (const code of PKSK_DOMAIN_CODES) expect(domainCodeOf(code), code).toBe(code)
  })
})

describe('level', () => {
  it('forms 1 to 3 are T1, forms 4 and 5 are T4, anything else is none', () => {
    expect(['T1', 'T2', 'T3', 'T4', 'T5', 'D1', undefined].map(pkskLevelOf)).toEqual(['T1', 'T1', 'T1', 'T4', 'T4', null, null])
  })
})

describe('transformPksk', () => {
  it('is a draft with the tags and one empty pksk_choice leaf, whatever the V2 status', () => {
    for (const status of ['approved', 'pending', 'rejected', 'xyz']) {
      const out = transformPksk(row({ status }), cur)
      expect(out.ok).toBe(true)
      if (!out.ok) continue
      expect(out.value).toMatchObject({
        idEntity: 'pksk_questions', idKey: '5', legacyId: null, status: 'draft', is_active: true, type: 'mcq', form_origin: 't1_t3',
        subject_id: null, education_level_id: null, stem: 'Soalan contoh.',
        tags: [{ kind: 'pksk_domain', code: 'PKSK_MATH' }, { kind: 'pksk_level', code: 'T1' }],
        tree: [{ kind: 'leaf', label: '1', prompt: 'Soalan contoh.', marks: 1, mode: 'pksk_choice', options: [], key: { kind: 'options', correct: [] } }],
      })
    }
  })

  it('counts the V2 status and domain as codes, never as text', () => {
    const out = transformPksk(row({ status: 'Ditolak' }), cur)
    expect(out.ok && out.value.notes).toEqual(['v2_status.ditolak', 'domain.PKSK_MATH'])
  })

  it('level T4 gives t4 form origin; an unmapped or missing level defaults to T1 and is counted', () => {
    const t4 = transformPksk(row({ education_level_id: '2' }), cur)
    expect(t4.ok && t4.value.form_origin).toBe('t4')
    expect(t4.ok && t4.value.tags).toContainEqual({ kind: 'pksk_level', code: 'T4' })
    for (const level of [null, '3', '99']) {
      const d = transformPksk(row({ education_level_id: level }), cur)
      expect(d.ok && d.value.tags).toContainEqual({ kind: 'pksk_level', code: 'T1' })
      expect(d.ok && d.value.notes).toContain('level_defaulted_t1')
    }
  })

  it('strips markup from the body', () => {
    const out = transformPksk(row({ body: '<p>Satu<br/>dua</p>' }), cur)
    expect(out.ok && out.value.stem).toBe('Satu\ndua')
  })

  it('rejects an unknown domain, an empty body and an oversized body', () => {
    const rejectOf = (r: ReturnType<typeof row>) => {
      const out = transformPksk(r, cur)
      return out.ok ? null : [out.reject.reason, out.reject.column]
    }
    expect(rejectOf(row({ domain: 'Lain' }))).toEqual(['UNKNOWN_ENUM', 'domain'])
    expect(rejectOf(row({ body: null }))).toEqual(['INVALID_VALUE', 'body'])
    expect(rejectOf(row({ body: '<p> </p>' }))).toEqual(['INVALID_VALUE', 'body'])
    expect(rejectOf(row({ body: 'x'.repeat(20_001) }))).toEqual(['INVALID_VALUE', 'body'])
  })
})
