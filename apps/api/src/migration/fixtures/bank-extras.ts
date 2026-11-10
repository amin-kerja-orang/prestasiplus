/**
 * Synthetic question-bank extras of the fixture generator (T-B9-6, T-B9-7, T-B10): structured questions with sub-questions and rubric points,
 * subjective questions, SPM sets, blueprints, papers with sections and placements, and canonical-only questions with parts, options and keys.
 * Deterministic (no randomness), obviously fictitious text, every planted case named so a rehearsal and a test can find it:
 *   structured: one per V2 status (diluluskan, diarkib, draf, ditolak, menunggu), one approved without a scheme, one whose rubric does not
 *   sum to the marks, one with an unknown status (reject); subjective: archived, approved with and without explanation;
 *   SPM sets: ramalan, past_year, a `subjektif` kind (left out), a cross-subject member, a repeated member (INV-26), an unmapped member;
 *   blueprints: confirmed, derived and one with no duration; papers: published, draft, one with no subject.
 * Appends to the tables the main generator made; ids of appended rows start above the base ids so nothing existing moves.
 */
type Row = Record<string, unknown>

const STATUSES = ['diluluskan', 'diarkib', 'draf', 'ditolak', 'menunggu'] as const

export function addBankExtras(tables: Map<string, Row[]>, scale: number): void {
  const put = (name: string, rows: Row[]) => void tables.set(name, [...(tables.get(name) ?? []), ...rows])
  const baseQuestions = (tables.get('questions') ?? []).length
  const stamp = { created_at: '2025-03-01T08:00:00Z', updated_at: '2025-03-01T08:00:00Z' }

  // Structured
  const n = 8 * scale
  const sq: Row[] = []
  const subs: Row[] = []
  const rubric: Row[] = []
  for (let i = 1; i <= n; i++) {
    const status = i === 6 % n + 1 && n >= 7 ? 'status_tidak_dikenali' : STATUSES[(i - 1) % STATUSES.length]
    sq.push({ id: i, subject_id: ((i - 1) % 6) + 1, education_level_id: 3 + (i % 2), status, stimulus: `Petikan struktur contoh ${i}.`, kbat_level: i % 3 === 0 ? 'menganalisis' : 'lots', total_marks: 3, created_by: null, ...stamp })
    const noScheme = i % 7 === 0
    for (const [k, [num, marks]] of ([['(a)', 1], ['(b)', 2]] as const).entries()) {
      const id = i * 10 + k
      subs.push({ id, structured_question_id: i, number: num, body: `Sub soalan ${num} bagi ${i}.`, marks, scheme: noScheme ? null : `Skema ${num} bagi ${i}.`, ...stamp })
      if (k === 1 && !noScheme) {
        const mismatch = i % 5 === 0
        rubric.push({ id: id * 10, structured_sub_question_id: id, code: 'A1', text: `Titik satu bagi ${i}`, marks: 1, position: 0, ...stamp })
        rubric.push({ id: id * 10 + 1, structured_sub_question_id: id, code: 'A2', text: `Titik dua bagi ${i}`, marks: mismatch ? 2 : 1, position: 1, ...stamp })
      }
    }
  }
  put('structured_questions', sq)
  put('structured_sub_questions', subs)
  put('structured_rubric_points', rubric)

  // Subjective, appended to the legacy questions (ids above the base).
  const sj: Row[] = []
  for (let i = 0; i < 3 * scale; i++) {
    sj.push({ id: baseQuestions + 1 + i, subject_id: (i % 6) + 1, education_level_id: 3, chapter_id: null, topic_id: null, difficulty_level: '3', type: 'subjektif', status: i % 3 === 2 ? 'diluluskan' : 'diarkib', body: `Huraikan satu contoh subjektif ${i + 1}.`, explanation: i % 3 === 1 ? null : `Jawapan model contoh ${i + 1}.`, ...stamp })
  }
  put('questions', sj)

  // SPM sets over the first base questions (all MCQ of subject/level as generated; membership is by id).
  const sets: Row[] = []
  const members: Row[] = []
  for (let i = 1; i <= 6 * scale; i++) {
    sets.push({ id: i, subject_id: ((i - 1) % 6) + 1, year: 2023 + (i % 3), set_number: Math.ceil(i / 6) + (i % 6 === 0 ? 0 : 0), kind: i % 6 === 5 ? 'subjektif' : i % 2 ? 'ramalan' : 'past_year', target_count: 40, ...stamp })
    for (let k = 0; k < 3; k++) members.push({ spm_set_id: i, question_id: ((i * 3 + k) % Math.max(1, baseQuestions)) + 1, position: k === 2 ? null : k + 1 })
  }
  put('spm_sets', sets)
  put('spm_set_question', members)

  // Blueprints (one per subject and kertas) and papers.
  const bps: Row[] = []
  const bsec: Row[] = []
  for (let i = 1; i <= 3 * scale; i++) {
    bps.push({ id: i, subject_id: ((i - 1) % 6) + 1, kertas: 1 + Math.floor((i - 1) / 6), paper_code: i % 3 === 0 ? null : `9${i}/1`, duration_minutes: i % 4 === 0 ? null : 90 + i, total_marks: 100, auto_markable: '1', source: ['confirmed', 'derived', 'spec'][i % 3], ...stamp })
    bsec.push({ id: i * 2, paper_blueprint_id: i, label: 'Bahagian A', position: 1, selection_rule_id: 1, instruction: null, select_count: 10, mark_budget: 10, expected_answer_modes: ['mcq', 'cloze'], ...stamp })
    bsec.push({ id: i * 2 + 1, paper_blueprint_id: i, label: 'Bahagian B', position: 2, selection_rule_id: 2, instruction: null, select_count: 2, mark_budget: 20, expected_answer_modes: ['extended_essay'], ...stamp })
  }
  put('paper_blueprints', bps)
  put('paper_blueprints', [])
  put('blueprint_sections', bsec)

  const papers = tables.get('exam_papers') ?? []
  papers.forEach((p, i) => Object.assign(p, { subject_id: (i % 6) + 1, kertas: String(1 + (i % 3)), duration_minutes: 60 + i, instructions: ['Jawab semua soalan.'], created_by: null, ...stamp }))
  const secs: Row[] = []
  const pivot: Row[] = []
  const map = tables.get('legacy_canonical_map') ?? []
  papers.forEach((p, i) => {
    secs.push({ id: i + 1, exam_paper_id: p.id, label: 'Bahagian A', position: 1, selection_rule_id: 1, instruction_text: null, select_count: null, mark_budget: null, ...stamp })
    for (let k = 0; k < 3 && map.length > 0; k++) {
      const m = map[(i * 3 + k) % map.length] as Row
      pivot.push({ id: i * 3 + k + 1, exam_question_id: m.canonical_id, paper_section_id: i + 1, sort_order: k + 1, number_label: String(k + 1), marks_override: null, ...stamp })
    }
  })
  // The pivot's canonical questions exist as exam_questions rows (the V2 projection of the legacy question), so nothing is orphaned.
  put('exam_questions', [...new Set(pivot.map((p) => p.exam_question_id as number))].map((id) => ({ id, exam_paper_id: null, paper_section_id: null, status_id: 3, number_label: null, position: 0, stem: null, chapter_id: null, topic: null, difficulty: null, source_paper_id: null, ...stamp })))
  put('paper_sections', secs)
  put('exam_paper_questions', pivot)

  // Canonical-only questions (ids far above the map's canonical ids).
  const eq: Row[] = []
  const parts: Row[] = []
  const opts: Row[] = []
  const keys: Row[] = []
  for (let i = 0; i < 3 * scale; i++) {
    const id = 100_000 + i
    eq.push({ id, exam_paper_id: papers[0]?.id ?? null, paper_section_id: null, status_id: 3, number_label: String(i + 1), position: i + 1, stem: { ms: `Soalan kanonik contoh ${i + 1}.` }, chapter_id: null, topic: null, difficulty: '3', source_paper_id: null, ...stamp })
    if (i % 2 === 0) {
      parts.push({ id: id, exam_question_id: id, answer_mode_id: 1, marks: 1, parent_part_id: null, position: 1, label: '1', prompt: { ms: 'Pilih satu jawapan.' }, word_limit: null, config: null, stimulus_id: null, ...stamp })
      for (const [k, l] of ['A', 'B', 'C', 'D'].entries()) opts.push({ id: id * 10 + k, question_part_id: id, label: l, body: { ms: `Pilihan ${l}` }, is_correct: k === 0 ? '1' : '0', is_distractor: k === 0 ? '0' : '1', position: k + 1, ...stamp })
    } else {
      parts.push({ id: id, exam_question_id: id, answer_mode_id: 5, marks: 2, parent_part_id: null, position: 1, label: '1', prompt: { ms: 'Huraikan.' }, word_limit: 100, config: null, stimulus_id: null, ...stamp })
      keys.push({ id, question_part_id: id, answer_key_kind_id: 3, content: { points: [{ text: 'Isi satu', marks: 1 }, { text: 'Isi dua', marks: 1 }] }, marks: 2, ...stamp })
    }
  }
  put('exam_questions', eq)
  put('question_parts', parts)
  put('part_options', opts)
  put('part_answer_keys', keys)
}
