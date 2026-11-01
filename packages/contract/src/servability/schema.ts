import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * R1-B03 (lite) / R1-B11: "Dilihat murid di". Where a bank question is served to pupils and, when it is not, why, in plain BM
 * (cause and fix, design v2-admin-student-pipeline section 9). The rules live in `apps/api/src/modules/questions/serving`; this
 * file holds the wire shapes and ALL the copy in two tables so the wording is changed in one place.
 *
 * Every sentence is [PROPOSED] (no .cloud equivalent) except where the design quotes .cloud ("Tidak dihidangkan kerana ...");
 * decision Q1 of the design keeps them open for sign-off.
 */

/** The six activities the question-level rules cover (T29). Tracking A, Struktur and Permainan are R2 or other lanes. */
export const SERVABILITY_ACTIVITIES = ['databank', 'latih_tubi_spm', 'bab', 'simulasi_paper', 'simulasi_kuiz', 'jana_kertas'] as const
export const ServabilityActivitySchema = z.enum(SERVABILITY_ACTIVITIES).meta({ id: 'ServabilityActivity' })
export type ServabilityActivity = z.infer<typeof ServabilityActivitySchema>

/** BM name of an activity, as the admin reads it in "Dilihat murid di". */
export const SERVABILITY_ACTIVITY_LABELS: Readonly<Record<ServabilityActivity, string>> = {
  databank: 'Databank Soalan',
  latih_tubi_spm: 'Latih Tubi SPM',
  bab: 'Latihan Bab',
  simulasi_paper: 'Simulasi (kertas)',
  simulasi_kuiz: 'Simulasi Kuiz',
  jana_kertas: 'Jana Kertas',
}

/**
 * Why a question is not served in an activity. The first block are the nine causes of the design table 9.3; the rest are the
 * finer causes the rules need. `paper_not_published`, `not_in_tracking_set` and `image_games` are not produced by the six
 * activities above; they live here so paper reads (T30) and the later lanes use the same table.
 */
export const SERVABILITY_REASON_CODES = [
  'not_approved',
  'archived',
  'dskp_incomplete',
  'untagged_legacy',
  'image_games',
  'image_missing',
  'level_inactive',
  'no_key',
  'no_scheme',
  'paper_not_published',
  'not_on_published_paper',
  'not_in_tracking_set',
  'shape_unsupported',
  'withdrawn',
  'pksk',
  'level_primary',
  'level_not_offered',
  'subject_unavailable',
  'subject_not_listed',
  'no_chapter',
  'has_stimulus',
  'has_option_image',
  'bridge_refused',
  'no_marks',
  'tag_review',
  'stimulus_shared_ungrouped',
] as const
export const ServabilityReasonCodeSchema = z.enum(SERVABILITY_REASON_CODES).meta({ id: 'ServabilityReasonCode' })
export type ServabilityReasonCode = z.infer<typeof ServabilityReasonCodeSchema>

/**
 * THE copy table. `{aktiviti}` is replaced by the activity label. A sentence ends with a full stop and names the cause and the
 * fix where the admin can act. `bridge_refused` has no sentence of its own: it wraps the Bijak bridge reason (`detail`).
 */
export const SERVABILITY_REASON_MS: Readonly<Record<ServabilityReasonCode, string>> = {
  not_approved: 'Belum diluluskan — tekan Terbitkan untuk memaparkannya.',
  archived: 'Diarkibkan — pulihkan ke draf dahulu.',
  dskp_incomplete: 'DSKP belum lengkap — lengkapkan Tag dan TP di borang soalan.',
  untagged_legacy: 'Belum ditanda DSKP — tidak dimasukkan dalam kertas blueprint dan Jana set.',
  image_games: 'Ada imej dan permainan ini tidak memaparkan imej.',
  image_missing: 'Imej belum dimuat naik — muat naik di borang sunting.',
  level_inactive: 'Tahap tidak aktif untuk murid.',
  no_key: 'Tiada kunci jawapan.',
  no_scheme: 'Tiada skema — tidak disajikan.',
  paper_not_published: 'Kertas belum diterbitkan.',
  not_on_published_paper: 'Tiada dalam mana-mana kertas diterbitkan.',
  not_in_tracking_set: 'Tiada dalam mana-mana set Tracking A.',
  shape_unsupported: 'Bentuk soalan ini tidak dipaparkan di {aktiviti}.',
  withdrawn: 'Soalan ditarik balik (tidak aktif) — aktifkan semula di senarai soalan.',
  pksk: 'Soalan PKSK dipaparkan di modul PKSK sahaja.',
  level_primary: 'Tahap sekolah rendah tidak dipaparkan kepada murid.',
  level_not_offered: 'Hanya soalan Tingkatan 4 dan 5 dipaparkan di {aktiviti}.',
  subject_unavailable: 'Subjek tidak aktif atau tidak dipautkan kepada tahap soalan ini.',
  subject_not_listed: 'Subjek ini tiada dalam senarai {aktiviti}.',
  no_chapter: 'Belum dipautkan kepada bab — pilih Bab di borang soalan.',
  has_stimulus: 'Ada rangsangan atau imej — {aktiviti} hanya memaparkan soalan teks.',
  has_option_image: 'Ada imej pada pilihan jawapan — {aktiviti} hanya memaparkan soalan teks.',
  bridge_refused: 'Tidak dapat dihidangkan di {aktiviti}.',
  no_marks: 'Tiada markah pada bahagian soalan.',
  tag_review: 'Perlu semakan tag DSKP.',
  // [PROPOSED] (V2 has no phrase; D90: a stimulus shared by several questions must be a group).
  stimulus_shared_ungrouped: 'Rangsangan ini dikongsi oleh beberapa soalan tetapi bukan kumpulan rangsangan — jadikan soalan-soalan itu satu kumpulan rangsangan (D90).',
}

/** "Tidak dihidangkan kerana {sebab}." (design 9.3, the .cloud exclusion line). `phrase` continues "kerana ...". */
export const notServedLine = (phrase: string): string => `Tidak dihidangkan kerana ${phrase}.`

/** The sentence of a reason for an activity; `detail` (a BM phrase, for `bridge_refused`) is appended as "kerana ...". */
export function servabilityReasonMs(code: ServabilityReasonCode, activity: ServabilityActivity, detailMs?: string): string {
  if (code === 'bridge_refused' && detailMs) return notServedLine(detailMs)
  return SERVABILITY_REASON_MS[code].replaceAll('{aktiviti}', SERVABILITY_ACTIVITY_LABELS[activity])
}

export const ServabilityReasonSchema = z
  .strictObject({
    code: ServabilityReasonCodeSchema,
    message: z.string().meta({ description: 'BM sentence for the admin (cause and fix).', example: 'Belum diluluskan — tekan Terbitkan untuk memaparkannya.' }),
    detail: z
      .string()
      .optional()
      .meta({ description: 'Machine detail for support: the Bijak bridge reason code (`shape_unsupported:<code>`) or the practice shape reason.' }),
  })
  .meta({ id: 'ServabilityReason' })
export type ServabilityReason = z.infer<typeof ServabilityReasonSchema>

export const ServabilityActivityResultSchema = z
  .strictObject({
    activity: ServabilityActivitySchema,
    label: z.string().meta({ example: 'Latih Tubi SPM' }),
    served: z.boolean(),
    reasons: z.array(ServabilityReasonSchema).meta({ description: 'Empty when served. In the order the rules are checked; the first is the main cause.' }),
  })
  .meta({ id: 'ServabilityActivityResult' })
export type ServabilityActivityResult = z.infer<typeof ServabilityActivityResultSchema>

/**
 * "Dilihat murid di {servedCount} daripada {total}". `total` is always the number of rows returned (`activities.length`, 6 in R1),
 * never a literal: design section 9.1/9.2 says "7" because it also counts the Tracking A, Struktur/Subjektif, Permainan and PKSK
 * families, which R1 does not serve from the bank (D92). The sentence stays honest by counting rows (design 9.2 counting rule);
 * a client must print `total`, not a constant.
 */
export const ServabilityReportSchema = z
  .strictObject({
    questionId: IdSchema,
    versionNo: z.number().int().min(1).nullable().meta({ description: 'The live version evaluated; null while no version is live.' }),
    activities: z.array(ServabilityActivityResultSchema).length(SERVABILITY_ACTIVITIES.length),
    servedCount: z.number().int().min(0),
    total: z.number().int().min(1),
  })
  .meta({ id: 'ServabilityReport' })
export type ServabilityReport = z.infer<typeof ServabilityReportSchema>
