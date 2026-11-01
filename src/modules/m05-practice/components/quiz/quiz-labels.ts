/**
 * Label sets of the quiz hosts (SRS M05 v1.19 §7.1 `labels`; §8.2 observed S7 copy, §8.3 PROPOSED COPY).
 * M05-T5 / T7 and M06 import these and override single keys where their SRS says so.
 */

import type { QuizLabels } from './quiz-types'

/**
 * Result copy of Latih Tubi SPM, Databank Soalan SPM and Soalan by Chapter, from the V2 .cloud Latih Tubi view (REQ-A-005,
 * S-53 / S-62): "Kuiz Selesai!", "Tahniah, anda telah lengkapkan {subject}.", "Cuba Lagi", "Senarai Subjek" (the chapter
 * host overrides `back`). The other quiz hosts keep PRACTICE_LABELS.
 */
export const LATIH_TUBI_LABELS: Partial<QuizLabels> = {
  resultTitle: 'Kuiz Selesai!',
  completed: 'Tahniah, anda telah lengkapkan {subject}.',
  retry: 'Cuba Lagi',
  back: 'Senarai Subjek',
}

/** S7 `/practice/revision/{CODE}` (SOURCE-DERIVED from the captured page source). */
export const REVISION_LABELS: QuizLabels = {
  loadingTitle: 'Memuat Soalan Ulang Kaji...',
  loadingText: 'Menyediakan soalan yang pernah dijawab salah',
  resultTitle: 'Keputusan Ulang Kaji',
  messages: {
    perfect: 'Sempurna! Semua soalan salah berjaya diperbetulkan!',
    high: 'Cemerlang! Hampir semua berjaya diperbetulkan!',
    mid: 'Bagus! Teruskan ulang kaji!',
    low: 'Jangan putus asa! Cuba ulang kaji lagi!',
  },
  retry: 'Ulang Kaji Lagi',
  back: 'Senarai Subjek',
  correctTitle: 'Betul! Kali ini berjaya!',
  wrongTitle: 'Masih belum tepat',
  startErrorFallback: 'Failed to load revision quiz',
  networkErrorFallback: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.',
}

/** Q1 and Q2 (PROPOSED COPY, §8.3, LS-1 / LS-2; the S7 pattern without "Ulang Kaji"). */
export const PRACTICE_LABELS: QuizLabels = {
  loadingTitle: 'Memuat Soalan...',
  loadingText: 'Menyediakan soalan latihan',
  resultTitle: 'Keputusan Latihan',
  messages: {
    perfect: 'Sempurna! Semua jawapan betul!',
    high: 'Cemerlang!',
    mid: 'Bagus! Teruskan berlatih!',
    low: 'Jangan putus asa! Cuba lagi!',
  },
  retry: 'Ulang Lagi',
  back: 'Kembali',
  correctTitle: 'Betul!',
  wrongTitle: 'Salah',
  // INFERRED: the S7 fallbacks without the revision wording (live Q1 never opened).
  startErrorFallback: 'Failed to load quiz',
  networkErrorFallback: 'Maaf, terdapat masalah memuatkan kuiz.',
}
