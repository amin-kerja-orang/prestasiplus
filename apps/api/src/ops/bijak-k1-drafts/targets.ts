/**
 * The K1 (Kertas 1, objective) papers of the draft script. One row per subject.
 *
 * Sources of the numbers (repo docs, none of them verified against an official LPM document):
 *  - docs/requirements/v2-exam-schema.md D7: Matematik 1449/1, Fizik 4531/1 and Sejarah 1249/1 are one section "all", 40 MCQ,
 *    1 mark each; Sains K1 is "DB only": 40 MCQ, 75 min, and no paper code in the repo.
 *  - Duration: Fizik printed 75 min, Sejarah printed 90 min, Matematik 75 min (INFERRED; one scheme cover prints 90), Sains 75 min (DB).
 *  - Level quota per paper (questions from Tingkatan 1-3, 4, 5): Matematik 17/13/10 from the layer-2 blueprint data of
 *    docs/reference/blueprints/1449-1.json (PR #400, single source, INFERRED); Sejarah 20 on Tingkatan 4 and 20 on Tingkatan 5
 *    (D7, "2 per Bab, 10 Bab per form"); Fizik and Sains: an even Tingkatan 4 / 5 split (default, no source states it).
 * A paper's duration and title stay editable in Admin Pusat while the paper is a draft.
 */

export interface K1Target {
  /** Bijak subject code (the API speaks MAT / SN / SEJ / PHY). */
  subject: string
  /** Printed paper code, or null when the repo does not say (then `--sn-code` or an existing blueprint must give it). */
  code: string | null
  durationMin: number
  /** Questions per paper (= marks, 1 mark each). */
  count: number
  /** Questions per paper from each school level (`t1_t3`, `t4`, `t5`). */
  quota: Readonly<Record<string, number>>
}

export const KERTAS = 1

export const K1_TARGETS: readonly K1Target[] = [
  { subject: 'MAT', code: '1449/1', durationMin: 75, count: 40, quota: { t1_t3: 17, t4: 13, t5: 10 } },
  { subject: 'SEJ', code: '1249/1', durationMin: 90, count: 40, quota: { t4: 20, t5: 20 } },
  { subject: 'PHY', code: '4531/1', durationMin: 75, count: 40, quota: { t4: 20, t5: 20 } },
  { subject: 'SN', code: null, durationMin: 75, count: 40, quota: { t4: 20, t5: 20 } },
]

/** Stable title of draft number `n` of a subject; the re-run finds its earlier drafts by it. `name` is the subject name (BM). */
export const paperTitle = (name: string, n: number): string => `Latihan SPM ${name} Kertas ${String(KERTAS)} Set ${String(n)}`

/** The Spec blueprint that the script creates when the subject has none (section label and pool follow the PoC K1 blueprint). */
export function blueprintBody(t: K1Target, code: string) {
  return {
    subject: t.subject,
    kertas: KERTAS,
    source: 'Spec' as const,
    code,
    durationMin: t.durationMin,
    instructions: [
      `Kertas ini mengandungi ${String(t.count)} soalan objektif.`,
      'Jawab semua soalan. Pilih satu jawapan sahaja bagi setiap soalan.',
    ],
    sections: [
      {
        label: 'Objektif',
        markBudget: t.count,
        questionCount: t.count,
        rule: { type: 'all' as const },
        pool: `${t.subject}${String(KERTAS)}-A`,
      },
    ],
  }
}
