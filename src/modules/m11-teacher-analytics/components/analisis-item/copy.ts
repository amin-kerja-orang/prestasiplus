/** S6 `/guru/analisis-item` copy (SRS M11 §8.1, exact BM; the table copy is PROPOSED, §8.2). */
export const ITEM_COPY = {
  filterLabel: 'Tapis:',
  subjectLabel: 'Mata Pelajaran',
  allSubjects: 'Semua Subjek',
  classLabel: 'Kelas',
  allClasses: 'Semua Kelas',
  reset: 'Reset',
  legendMudah: '> 70% (Mudah)',
  legendSederhana: '40–70% (Sederhana)',
  legendSukar: '< 40% (Sukar)',
  legendNote: 'Diskriminasi: >0.3 = baik, <0 = semak semula',
  emptyTitle: 'Tiada data analisis item untuk paparan ini.',
  emptyBody: 'Pelajar perlu membuat latihan dahulu.',
  // PROPOSED COPY: no M11 error copy in the SRS; same string as the other modules' local GENERIC_ERROR.
  loadFailed: 'Ralat berlaku. Sila cuba lagi.',
  colQuestion: 'Soalan',
  colSubject: 'Subjek',
  colAttempts: 'Percubaan',
  colPct: '% Betul',
  colDiscrimination: 'Diskriminasi',
  good: 'baik',
  review: 'semak semula',
} as const
