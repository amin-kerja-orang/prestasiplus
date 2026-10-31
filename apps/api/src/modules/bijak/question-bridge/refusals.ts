/**
 * Why the Bijak bridge does not serve a bank question (ADR-0030 section 4: "no silent drops").
 *
 * One exported map keeps every reason in one place, in BM, so the admin "Dilihat murid di" panel can show
 * `notServedLine(reason)` ("Tidak dihidangkan kerana {sebab}.") without re-deriving anything. The reason is a
 * phrase that continues "kerana ..."; it names the shape, never the question content.
 *
 * The wire code of a refusal is `shape_unsupported:<code>` (`BridgeRefusal.reasonCode`).
 */
export const BRIDGE_REFUSAL_REASONS_MS = {
  no_parts: 'soalan tidak mempunyai bahagian untuk dijawab',
  reveal_never: 'skema jawapan tidak boleh didedahkan selepas hantar (reveal: never)',
  stimulus_outside_group: 'rangsangan soalan berada di luar kumpulan rangsangannya dan tidak dapat dipaparkan',
  group_too_many_stimuli: 'kumpulan rangsangan mempunyai lebih daripada 3 rangsangan',
  group_no_stimulus: 'kumpulan rangsangan tidak mempunyai rangsangan yang boleh dipaparkan (audio atau kosong)',
  stimulus_kind_unsupported: 'jenis rangsangan tidak disokong oleh Bijak SPM',
  stimulus_empty: 'rangsangan tidak mempunyai teks, jadual atau gambar untuk dipaparkan',
  file_missing: 'fail gambar rangsangan atau pilihan tidak dijumpai',
  stem_images_many: 'soalan mempunyai lebih daripada satu gambar soalan',
  mcq_in_structured: 'bahagian aneka pilihan di dalam soalan berstruktur tidak disokong',
  pksk_not_bijak: 'soalan PKSK bukan item Bijak SPM',
  table_fill: 'mod isi jadual (table_fill) belum disokong',
  short_text_any_order: 'jawapan pendek dengan susunan bebas (anyOrder) belum disokong',
  short_text_multi_blank: 'jawapan pendek dengan lebih daripada satu ruang kosong belum disokong',
  numeric_precision: 'jawapan angka dengan angka bererti atau tempat perpuluhan belum disokong',
  numeric_exponent: 'jawapan angka dalam bentuk eksponen belum disokong',
  match_letter_multi: 'padanan huruf dengan lebih daripada satu item dalam satu bahagian belum disokong',
  points_unsupported: 'skema markah mempunyai peraturan yang belum disokong (laluan alternatif, tolakan atau unit)',
  label_clash: 'dua bahagian yang setara mempunyai label yang menjadi id yang sama',
  essay_choice_no_topics: 'esei pilihan tidak mempunyai tajuk untuk dipilih',
} as const

export type BridgeRefusalCode = keyof typeof BRIDGE_REFUSAL_REASONS_MS

/** `Tidak dihidangkan kerana {sebab}.` for a code. */
export function refusalLineMs(code: BridgeRefusalCode): string {
  return `Tidak dihidangkan kerana ${BRIDGE_REFUSAL_REASONS_MS[code]}.`
}

/** A refused question as the admin read sees it (no content). */
export interface BridgeRefusal {
  questionId: string
  /** Label path of the part (`(a).(ii)`), or `''` for the question itself. */
  path: string
  code: BridgeRefusalCode
  /** `shape_unsupported:<code>` (ADR-0030 section 4). */
  reasonCode: string
  /** BM phrase continuing "kerana ...". */
  reasonMs: string
}
