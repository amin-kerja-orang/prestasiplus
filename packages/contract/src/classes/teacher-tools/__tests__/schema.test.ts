import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import {
  isHttpUrl,
  PERSONAL_QUESTION_MESSAGES as M,
  PersonalQuestionSchema,
  PersonalQuestionWriteSchema,
  personalDskpFields,
} from '../schema'

const valid = {
  subjectId: '1',
  educationLevelId: '4',
  difficulty: 3,
  text: 'Berapakah 2 + 2?',
  options: [{ text: '3' }, { text: '4' }, { text: '5' }, { text: '6' }],
  correctIndex: 1,
}
const fieldsOf = (over: Record<string, unknown>): Record<string, string> => {
  const res = PersonalQuestionWriteSchema.safeParse({ ...valid, ...over })
  if (res.success) return {}
  const out: Record<string, string> = {}
  for (const i of res.error.issues) out[i.path.join('.')] ??= i.message
  return out
}

describe('PersonalQuestionWrite (API-GUR-24)', () => {
  it('accepts the AC-GUR-44a-1 body with an https link', () => {
    expect(PersonalQuestionWriteSchema.safeParse({ ...valid, referenceUrl: 'https://example.org/rujukan' }).success).toBe(true)
    expect(PersonalQuestionWriteSchema.safeParse(valid).success).toBe(true)
    expect(PersonalQuestionWriteSchema.safeParse({ ...valid, referenceUrl: null }).success).toBe(true)
  })

  it('refuses javascript:, ftp:, a bare host and spaces with the BM link message (AC-GUR-44a-3, AC-GUR-44a-8)', () => {
    for (const bad of ['javascript:alert(1)', 'ftp://contoh', 'example.org', 'https://', 'https://a b', 'data:text/html,x', '//example.org', 'https://user:pass@example.org/', 'https://user@example.org/', 'https://example.org/a\u0001b', 'https://example.org/\u007f']) {
      expect(fieldsOf({ referenceUrl: bad }).referenceUrl, bad).toBe(M.referenceUrl)
      expect(isHttpUrl(bad), bad).toBe(false)
    }
  })

  it('caps the link at 2048 characters', () => {
    const url = (n: number) => `https://example.org/${'a'.repeat(n - 'https://example.org/'.length)}`
    expect(fieldsOf({ referenceUrl: url(2048) }).referenceUrl).toBeUndefined()
    expect(fieldsOf({ referenceUrl: url(2049) }).referenceUrl).toBe(M.referenceUrlLong)
  })

  it('has one BM message per required field', () => {
    expect(fieldsOf({ subjectId: '' }).subjectId).toBe(M.subject)
    expect(fieldsOf({ educationLevelId: undefined }).educationLevelId).toBe(M.level)
    expect(fieldsOf({ difficulty: undefined }).difficulty).toBe(M.difficulty)
    expect(fieldsOf({ difficulty: 6 }).difficulty).toBe(M.difficulty)
    expect(fieldsOf({ text: '  ' }).text).toBe(M.text)
    expect(fieldsOf({ text: 'x'.repeat(2001) }).text).toBe(M.textLong)
    expect(fieldsOf({ correctIndex: undefined }).correctIndex).toBe(M.correct)
    expect(fieldsOf({ correctIndex: 4 }).correctIndex).toBe(M.correct)
    expect(fieldsOf({ tp: 7 }).tp).toBe(M.tpRange)
  })

  it('needs four options and names the empty one by letter', () => {
    expect(fieldsOf({ options: [{ text: 'a' }] }).options).toBe(M.options)
    expect(fieldsOf({ options: [{ text: 'a' }, { text: 'b' }, { text: ' ' }, { text: 'd' }] }).options).toBe('Sila isi pilihan C.')
    expect(fieldsOf({ options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'x'.repeat(501) }] }).options).toBe('Pilihan D tidak boleh melebihi 500 aksara.')
  })
})

describe('personalDskpFields (FR-GUR-44a-7, D112: the same rule as the bank form)', () => {
  it('requires nothing where the Subjek + Tingkatan has no chapters and no DSKP nodes', () => {
    expect(personalDskpFields({}, { hasChapters: false, hasDskpNodes: false })).toEqual({})
  })
  it('names Bab, SP, TP and Aras where they exist (AC-GUR-44a-7)', () => {
    expect(personalDskpFields({}, { hasChapters: true, hasDskpNodes: true })).toEqual({
      chapterId: 'Sila pilih bab.',
      spIds: 'Sila pilih Standard Pembelajaran (SP).',
      tp: 'Sila pilih TP.',
      cognitiveLevel: 'Sila pilih aras pemikiran.',
    })
  })
  it('passes a complete tag and refuses a TP outside 1 to 6 even when optional', () => {
    expect(personalDskpFields({ chapterId: '9', spIds: ['3'], tp: 4, cognitiveLevel: 'memahami' }, { hasChapters: true, hasDskpNodes: true })).toEqual({})
    expect(personalDskpFields({ tp: 9 }, { hasChapters: false, hasDskpNodes: false })).toEqual({ tp: M.tpRange })
  })
})

describe('contract document', () => {
  it('registers the five routes of API-GUR-24 and the PersonalQuestion shape', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>>; components: { schemas: Record<string, unknown> } }
    expect(Object.keys(doc.paths['/guru/personal-questions'] ?? {}).sort()).toEqual(['get', 'post'])
    expect(Object.keys(doc.paths['/guru/personal-questions/{id}'] ?? {}).sort()).toEqual(['delete', 'get', 'put'])
    expect(doc.components.schemas.PersonalQuestion).toBeDefined()
    const ok = PersonalQuestionSchema.safeParse({
      id: '1', subjectId: '2', subjectName: 'Matematik', educationLevelId: '4', difficulty: 3, text: 't', chapterId: null, spIds: [], tp: null, cognitiveLevel: null,
      options: [{ text: 'a' }, { text: 'b' }, { text: 'c' }, { text: 'd' }], correctIndex: 0, referenceUrl: null, createdAt: '2026-11-05T10:00:00+08:00',
    })
    expect(ok.success).toBe(true)
  })
})
