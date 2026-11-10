/**
 * A fictional past-year style paper used by the real-extraction tests (T-C4): two pages, six multiple-choice
 * questions, an answer key, a rajah with a caption shared by two questions, a rajah printed inside a stem, and a rajah
 * that is only mentioned (the figure is an image). Latin-1 only so the generated PDF text layer is exact.
 */
export const SAMPLE_PAGE_1: string[] = [
  'SULIT',
  '4531/1',
  'KERTAS PERCUBAAN SAINS CONTOH',
  'Jawab semua soalan.',
  '1. Apakah unit SI bagi daya?',
  'A. Joule',
  'B. Newton',
  'C. Watt',
  'D. Pascal',
  '2. Rajah 1 menunjukkan sebuah litar ringkas.',
  'Rajah 1',
  'Antara berikut, yang manakah benar tentang litar itu?',
  'A. Arus mengalir ke kiri',
  'B. Arus mengalir ke kanan',
  'C. Tiada arus mengalir',
  'D. Arus berselang-seli',
  'Gunakan Rajah 2 untuk menjawab soalan 3 dan 4.',
  'Rajah 2',
  '3. Apakah nilai X pada Rajah 2?',
  'A. 2 cm',
  'B. 4 cm',
  'C. 6 cm',
  'D. 8 cm',
  'E. 10 cm',
  '4. Berapakah luas bentuk dalam Rajah 2?',
  'A. 8 cm2   B. 16 cm2   C. 24 cm2   D. 32 cm2',
  '[Lihat halaman sebelah',
]

export const SAMPLE_PAGE_2: string[] = [
  '5. Antara berikut, yang manakah logam?',
  'A. Kayu',
  'B. Besi',
  'C. Getah',
  'D. Kaca',
  '6. Merujuk Rajah 3, nyatakan arah gerakan zarah itu.',
  'A. Ke atas',
  'B. Ke bawah',
  'C. Ke kiri',
  'D. Ke kanan',
  'Jawapan: 1-B 2-B 3-C 4-B 5-B 6-D',
]

/** What a correct extraction finds. */
export const SAMPLE_EXPECTED = {
  questions: 6,
  options: { '1': 4, '2': 4, '3': 5, '4': 4, '5': 4, '6': 4 } as Record<string, number>,
  key: { '1': 'B', '2': 'B', '3': 'C', '4': 'B', '5': 'B', '6': 'D' } as Record<string, string>,
  /** question label to stimulus label */
  stimulus: { '2': 'Rajah 1', '3': 'Rajah 2', '4': 'Rajah 2', '6': 'Rajah 3' } as Record<string, string>,
  stimuli: ['Rajah 1', 'Rajah 2', 'Rajah 3'],
}
