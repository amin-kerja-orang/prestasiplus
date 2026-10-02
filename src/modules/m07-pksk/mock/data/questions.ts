/**
 * The 763 PKSK question rows as M04 anchors (SRS M07 v1.7 §6.8): ids 177698-178460, contiguous, all
 * approved. Observed anchors carry their live domain, level, text, difficulty, explanation and
 * options; every other row's domain and level are SEED-ASSIGNED so the per-domain x level totals of
 * §6.8 hold (the anchors count towards them), and its text, options, explanation and difficulty come
 * from M04's deterministic derivation (fictitious; Q-PKSK-DIFFICULTY 253/253/191/66/0 is filled by
 * `questions.anchorRow`, which takes the cell with room). Exactly 13 texts contain "inovasi" (the 13
 * live records); the derived texts never do.
 *
 * `createdAt` (list order, BR-M07-06): page 1 and page 39 reproduce the observed order; between them
 * the order is INFERRED (pairs of ids sharing one timestamp, ties by id ascending), see `createdAtOf`.
 */

import { fnv1a32 } from '@/mock/determinism/hash'
import { mulberry32 } from '@/mock/determinism/prng'

import type { PkskLevel } from '../repository/types'
import { DOMAIN_LEVEL_TOTALS } from './domains'

export const PKSK_FIRST_ID = 177698
export const PKSK_LAST_ID = 178460

export interface PkskOptionSeed {
  text: string
  isCorrect: boolean
}

/** An observed question (facts OBSERVED unless the SRS marks them seed-assigned). */
export interface ObservedQuestion {
  id: number
  domainId: number
  level: PkskLevel
  text: string
  difficulty?: number
  explanation?: string
  options?: PkskOptionSeed[]
}

const opts = (correct: number, ...texts: string[]): PkskOptionSeed[] =>
  texts.map((text, i) => ({ text, isCorrect: i === correct }))

const EKONOMI_T4 = [
  'Bagi calon T4, apakah maksud belanjawan peribadi?',
  'Bagi calon T4, mengapakah tabungan penting?',
  'Bagi calon T4, apakah perbezaan keperluan dan kehendak?',
  'Bagi calon T4, bagaimanakah usahawan membantu ekonomi?',
  'Bagi calon T4, apakah kesan inflasi kepada pengguna?',
  'Bagi calon T4, apakah maksud belanjawan peribadi dalam konteks T4?',
  'Bagi calon T4, mengapakah tabungan penting dalam konteks T4?',
  'Bagi calon T4, apakah perbezaan keperluan dan kehendak dalam konteks T4?',
  'Bagi calon T4, bagaimanakah usahawan membantu ekonomi dalam konteks T4?',
]

const INOVASI_T4 = [
  'Bagi calon T4, apakah maksud inovasi?',
  'Bagi calon T4, mengapakah prototaip penting?',
  'Bagi calon T4, apakah ciri pencipta yang berjaya?',
  'Bagi calon T4, mengapakah hak cipta perlu dihormati?',
  'Bagi calon T4, apakah contoh inovasi sosial?',
  'Bagi calon T4, apakah maksud inovasi dalam konteks T4?',
  'Bagi calon T4, mengapakah prototaip penting dalam konteks T4?',
  'Bagi calon T4, apakah ciri pencipta yang berjaya dalam konteks T4?',
  'Bagi calon T4, mengapakah hak cipta perlu dihormati dalam konteks T4?',
]

const obs = (
  id: number,
  domainId: number,
  level: PkskLevel,
  text: string,
  extra: Partial<ObservedQuestion> = {},
): ObservedQuestion => ({ id, domainId, level, text, ...extra })

export const OBSERVED_QUESTIONS: readonly ObservedQuestion[] = [
  obs(
    178460,
    7,
    'T4',
    'Bagi calon T4, apakah tindakan terbaik apabila berlaku salah faham antara rakan berlainan budaya di sekolah?',
    {
      difficulty: 3,
      explanation:
        'Dialog berhemah dan rujukan kepada guru membantu menyelesaikan salah faham tanpa menjejaskan perpaduan.',
      options: opts(
        0,
        'Mengadakan dialog secara sopan dan mendapatkan bantuan guru jika perlu.',
        'Menyebarkan cerita kepada kumpulan lain.',
        'Menyalahkan budaya rakan tersebut.',
        'Mengelak terus daripada bergaul dengannya.',
      ),
    },
  ),
  ...EKONOMI_T4.map((t, i) => obs(178432 + i, 12, 'T4', t)),
  obs(178441, 13, 'T1', 'Bagi calon T1, apakah maksud inovasi?'),
  ...INOVASI_T4.map((t, i) => obs(178442 + i, 13, 'T4', t)),
  obs(
    178359,
    1,
    'T1',
    'Bagi calon T1, apabila rakan berlainan kaum menyambut perayaan, tindakan terbaik ialah ...',
    {
      difficulty: 2,
      explanation: 'Menghormati kepelbagaian budaya ialah asas keharmonian.',
      options: opts(
        3,
        'Memaksa rakan mengikut budaya sendiri.',
        'Mengejek amalan tersebut.',
        'Mengelak daripada bercakap dengannya.',
        'Mengucapkan tahniah dan menghormati amalan perayaannya.',
      ),
    },
  ),
  obs(
    178349,
    15,
    'T1',
    'Tulis karangan tentang cara pelajar boleh membantu rakan yang menghadapi masalah pembelajaran. (150-200 patah perkataan)',
    {
      explanation:
        'Dinilai berdasarkan kejelasan idea, susunan hujah, contoh relevan dan ketepatan bahasa.',
    },
  ),
  obs(178174, 14, 'T4', 'Apakah peranan Malaysia dalam PBB?', {
    difficulty: 2,
    explanation:
      'Malaysia aktif dalam PBB melalui misi pengaman, hak asasi manusia dan pembangunan lestari.',
  }),
  obs(177919, 4, 'T1', 'What is the antonym of "generous"?', {
    difficulty: 2,
    explanation: 'The antonym (opposite) of generous is selfish.',
  }),
  obs(178175, 14, 'T4', 'Bagaimanakah perubahan iklim mempengaruhi negara-negara pulau kecil?', {
    difficulty: 3,
    // Only the prefix up to "pant" is OBSERVED; the tail "ai." is seed-assigned (Perlu pengesahan).
    explanation:
      'Kenaikan paras laut mengancam kewujudan negara pulau kecil melalui banjir dan hakisan pantai.',
  }),
  obs(178148, 13, 'T1', 'Apakah maksud inovasi?'),
  obs(178149, 13, 'T1', 'Apakah perbezaan antara ciptaan (invention) dan inovasi?'),
  obs(178159, 13, 'T4', 'Bagaimanakah Malaysia boleh menjadi hab inovasi di Asia Tenggara?'),
  obs(178161, 13, 'T4', 'Analisakan peranan universiti dalam ekosistem inovasi Malaysia.'),
  obs(178323, 13, 'T1', 'Apakah contoh inovasi sosial?'),
  obs(178324, 13, 'T1', 'Apakah maksud inovasi dalam konteks T1?'),
  obs(178328, 13, 'T1', 'Apakah contoh inovasi sosial dalam konteks T1?'),
  obs(178329, 13, 'T4', 'Apakah maksud inovasi dalam konteks T4?'),
  obs(178333, 13, 'T4', 'Apakah contoh inovasi sosial dalam konteks T4?'),
]

/** The 13 live "inovasi" records (BR-M07-06 search results). */
export const INOVASI_IDS: readonly number[] = [
  178441, 178442, 178446, 178447, 178148, 178149, 178159, 178161, 178323, 178324, 178328, 178329,
  178333,
]

// --- createdAt ---------------------------------------------------------------------------------

const T0_MS = Date.parse('2026-04-22T12:00:00+08:00')
const STEP_MS = 600_000

const SPECIAL_LOW = new Set([177918, 177919])
const PAIR_FIRST = 177698
const PAIR_LAST = 177953
const PAIR_GAP = 256

/** Rank 0 = newest. Returns the timestamp rank of each id (see the file header). */
function buildRanks(): Map<number, number> {
  const ranks = new Map<number, number>()
  let r = 0
  ranks.set(178460, r++)
  for (let id = 178432; id <= 178450; id++) ranks.set(id, r)
  r++
  for (let i = PAIR_FIRST; i <= PAIR_LAST; i++) {
    if (SPECIAL_LOW.has(i)) continue
    ranks.set(i, r)
    ranks.set(i + PAIR_GAP, r)
    r++
  }
  const singles: number[] = []
  for (let id = PKSK_FIRST_ID; id <= PKSK_LAST_ID; id++) if (!ranks.has(id)) singles.push(id)
  const lone = singles.filter(
    (id) => id !== 177918 && id !== 177919 && id !== 178174 && id !== 178175,
  )
  for (const id of lone.sort((a, b) => b - a)) ranks.set(id, r++)
  ranks.set(177918, r)
  ranks.set(178174, r)
  r++
  ranks.set(177919, r)
  ranks.set(178175, r)
  return ranks
}

const RANKS = buildRanks()

export function createdAtMsOf(id: number): number {
  const rank = RANKS.get(id)
  if (rank === undefined) throw new Error(`PKSK id ${String(id)} is outside 177698-178460`)
  return T0_MS - rank * STEP_MS
}

// --- domain / level assignment -----------------------------------------------------------------

/**
 * Domain and level of every id: the observed ones as given; the rest take the remaining room of the
 * §6.8 domain x level totals, in a deterministic shuffle (SEED-ASSIGNED).
 */
export function assignDomainsAndLevels(): Map<number, { domainId: number; level: PkskLevel }> {
  const out = new Map<number, { domainId: number; level: PkskLevel }>()
  const room = new Map<string, number>()
  for (const [d, [t1, t4]] of Object.entries(DOMAIN_LEVEL_TOTALS)) {
    room.set(`${d}:T1`, t1)
    room.set(`${d}:T4`, t4)
  }
  for (const o of OBSERVED_QUESTIONS) {
    out.set(o.id, { domainId: o.domainId, level: o.level })
    const key = `${String(o.domainId)}:${o.level}`
    room.set(key, (room.get(key) ?? 0) - 1)
  }
  const slots: string[] = []
  for (const [key, n] of room) {
    if (n < 0) throw new Error(`PKSK anchors over-fill ${key}`)
    for (let i = 0; i < n; i++) slots.push(key)
  }
  mulberry32(fnv1a32('m07:pksk:assign')).shuffle(slots)
  let k = 0
  for (let id = PKSK_FIRST_ID; id <= PKSK_LAST_ID; id++) {
    if (out.has(id)) continue
    const [d, level] = (slots[k++] as string).split(':') as [string, PkskLevel]
    out.set(id, { domainId: Number(d), level })
  }
  if (k !== slots.length) throw new Error('PKSK domain x level slots do not match the id range')
  return out
}
