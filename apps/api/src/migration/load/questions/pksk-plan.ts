/**
 * Pure side of the PKSK loader (OC-4, PO rule of 10 Nov: V3 continues V2's management). A V2 `pksk_questions` row has a body only: no
 * options and no answer. It is loaded as a DRAFT PKSK question, the same shape the "Soalan PKSK" editor writes (`PkskQuestionsService`):
 * one `pksk_choice` leaf with 0 options and an empty correct list, tags `pksk_domain` (a code of `PKSK_DOMAIN_CODES`) and `pksk_level`
 * (`T1` or `T4`), no curriculum tag. A draft is never served to a pupil (only an approved, active question is), so an admin completes
 * the options and the key in the editor and approves it. The V2 status is counted (`pksk.v2_status.<code>`), never kept: nothing in V2
 * says which answer is right, so no row can be served as it came. Everything else is the shared tree writer (`bank-writer.ts`).
 */
import { ok, reject, enumKey, stamps, text, type Outcome, type Staged } from '../../transform/common'
import { htmlHoldOf, MAX_BODY_CHARS, piiKindsOf, plainFromHtml, type Curriculum } from '../../transform/question-bank'
import type { IssuePlan, QuestionTreePlan } from './bank-writer'

export const PKSK_RULES_VERSION = 'pksk-1'

/** The 15 fixed domains of V3 (`PKSK_DOMAIN_CODES`, migration 0028): the Malay and English names and the code. */
const DOMAIN_NAMES: readonly (readonly [code: string, ms: string, en: string])[] = [
  ['PKSK_INSANIAH', 'Kecerdasan Insaniah', 'Soft Skills Intelligence'],
  ['PKSK_MATH', 'Matematik', 'Mathematics'],
  ['PKSK_SCI', 'Sains', 'Science'],
  ['PKSK_ENG', 'Bahasa Inggeris', 'English Language'],
  ['PKSK_SEJ', 'Sejarah Malaysia', 'Malaysian History'],
  ['PKSK_GEO', 'Geografi', 'Geography'],
  ['PKSK_BUDAYA', 'Kebudayaan Kaum', 'Cultural Heritage'],
  ['PKSK_SUKAN', 'Sukan & Pencapaian', 'Sports & Achievements'],
  ['PKSK_MERCU', 'Mercu Tanda Malaysia', 'Malaysian Landmarks'],
  ['PKSK_ALAM', 'Alam Sekitar', 'Environment'],
  ['PKSK_TECH', 'Teknologi & IT', 'Technology & IT'],
  ['PKSK_EKON', 'Ekonomi Malaysia', 'Malaysian Economy'],
  ['PKSK_INOV', 'Inovasi & Pencipta', 'Innovation & Inventors'],
  ['PKSK_GLOBAL', 'Isu Global', 'Global Issues'],
  ['PKSK_ESSAY', 'Artikulasi Penulisan', 'Writing Articulation'],
]

/** Folds case, `&`/`dan`/`and`, punctuation and spacing so a V2 domain text and a V3 name compare equal. */
export function foldDomain(value: string): string {
  return value
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/\s*(?:&|\bdan\b|\band\b)\s*/g, ' dan ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const BY_TEXT: ReadonlyMap<string, string> = new Map(
  DOMAIN_NAMES.flatMap(([code, ms, en]) => [[foldDomain(ms), code], [foldDomain(en), code], [foldDomain(code), code]] as const),
)

/** The V3 domain code of a V2 domain text (a name in either language or the code itself); null when it is none of the 15. */
export function domainCodeOf(raw: string | null | undefined): string | null {
  const t = text(raw)
  return t === null ? null : (BY_TEXT.get(foldDomain(t)) ?? null)
}

/** PKSK is offered at Tingkatan 1 and Tingkatan 4: forms 1 to 3 are `T1`, forms 4 and 5 are `T4`; any other level is none. */
export function pkskLevelOf(levelCode: string | undefined): 'T1' | 'T4' | null {
  switch (levelCode) {
    case 'T1':
    case 'T2':
    case 'T3':
      return 'T1'
    case 'T4':
    case 'T5':
      return 'T4'
    default:
      return null
  }
}

/** Plan of one V2 PKSK question, or the reject. */
export function transformPksk(row: Staged, cur: Curriculum, userOf: ReadonlyMap<string, string> = new Map()): Outcome<QuestionTreePlan> {
  void userOf
  const notes: string[] = []
  const id = (row.id ?? '').trim()
  const domain = domainCodeOf(row.domain)
  if (domain === null) return reject('UNKNOWN_ENUM', 'domain')
  const raw = text(row.body)
  if (raw === null) return reject('INVALID_VALUE', 'body')
  if (raw.length > MAX_BODY_CHARS) return reject('INVALID_VALUE', 'body')
  const plain = plainFromHtml(raw)
  if (plain.text === '') return reject('INVALID_VALUE', 'body')
  const issues: IssuePlan[] = []
  const hold = htmlHoldOf(plain.text)
  if (hold !== null) {
    issues.push({ code: hold, target: 'stem' })
    notes.push(`held_${hold}`)
  }
  if (piiKindsOf(plain.text).length > 0) {
    issues.push({ code: 'pii_suspect', target: 'stem' })
    notes.push('held_pii_suspect')
  }
  const levelRaw = text(row.education_level_id)
  const levelId = levelRaw === null ? undefined : cur.levels.get(levelRaw)
  const level = pkskLevelOf(levelId === undefined ? undefined : cur.levelCodes.get(levelId))
  if (level === null) notes.push('level_defaulted_t1')
  const finalLevel = level ?? 'T1'
  const v2Status = enumKey(row.status)
  notes.push(`v2_status.${v2Status !== null && /^[a-z0-9_]{1,24}$/.test(v2Status) ? v2Status : 'other'}`)
  notes.push(`domain.${domain}`)
  const t = stamps(row)
  return ok({
    idEntity: 'pksk_questions',
    idKey: id,
    legacyId: null,
    type: 'mcq',
    status: 'draft',
    is_active: issues.length === 0,
    created_at: t.created_at,
    updated_at: t.updated_at,
    subject_id: null,
    education_level_id: null,
    chapter_id: null,
    topic_id: null,
    form_origin: finalLevel === 'T1' ? 't1_t3' : 't4',
    difficulty_tp: null,
    kbat: null,
    number_label: null,
    stem: plain.text,
    explanation: null,
    declared_marks: null,
    rejection_reason: null,
    import_issues: issues.length > 0 ? issues : null,
    created_by_id: null,
    spm_pool: false,
    tags: [
      { kind: 'pksk_domain', code: domain },
      { kind: 'pksk_level', code: finalLevel },
    ],
    tree: [
      {
        kind: 'leaf',
        label: '1',
        prompt: plain.text,
        marks: 1,
        mode: 'pksk_choice',
        options: [],
        key: { kind: 'options', correct: [] },
      },
    ],
    notes,
  })
}
