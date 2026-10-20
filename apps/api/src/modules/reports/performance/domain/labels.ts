/** Exact BM copy (mock `student.ts`, `performance.ts`). */
export const NO_SUBJECT_LABEL = 'Tiada Subjek'
export const SCHOOL_CLASS_LABEL = 'Kelas Sekolah'

/** Up to 1 decimal without a trailing ".0". */
const num1 = (v: number): string => String(Math.round(v * 10) / 10)

export const START_SUGGESTION = 'Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!'

export const subjectSuggestion = (subjectName: string, accuracy: number): string =>
  `Tingkatkan prestasi ${subjectName} (purata ${num1(accuracy)}%) dengan 3 sesi latihan fokus minggu ini.`
