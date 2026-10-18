/**
 * Fictional sample paper text (never real trial-paper text): the demo batch and the mock extractor
 * tests are built from it. Two pages: questions, then the mark scheme.
 */
import type { PageText } from '../types'

export const SAMPLE_PAGE_1 = `Kertas Contoh Matematik Kertas 2 (fiksyen, bukan kertas sebenar)
Bahagian A
1. Selesaikan persamaan 2x + 6 = 14. [2 markah]
2. Antara berikut, yang manakah nilai min bagi 2, 4, 6, 8?
A. 4
B. 5
C. 6
D. 8
Rajah 1: Segi tiga bersudut tegak ABC dengan AB = 6 cm dan BC = 8 cm.
Gunakan Rajah 1 untuk menjawab soalan 3 dan 4.
3. Berdasarkan Rajah 1,
(a) hitung panjang AC dalam cm. [2 markah]
(b) hitung luas segi tiga ABC dalam cm2. [2 markah]
4. Nyatakan teorem yang digunakan untuk mencari panjang AC. [1 markah]
5. Nyatakan dua kebaikan menggunakan carta palang. [2 markah]`

export const SAMPLE_PAGE_2 = `Skema Pemarkahan
Jawapan: 2-B
Skema 1
K1 2x = 14 - 6 [1]
N1 x = 4 [1]
Skema 3(a)
K1 AC^2 = 6^2 + 8^2 [1]
N1 10 [1]
Skema 3(b)
K1 1/2 x 6 x 8 atau 0.5 x 6 x 8 [1]
N1 24 [1]
Skema 4
N1 Teorem Pythagoras [1]
Skema 5
P1 Mudah dibandingkan [1]
P2 Mudah dibaca [1]
P3 Menjimatkan ruang [1]
Mana-mana 2 x 1 m`

export const SAMPLE_PAGES: PageText[] = [
  { page: 1, text: SAMPLE_PAGE_1, source: 'text-layer' },
  { page: 2, text: SAMPLE_PAGE_2, source: 'text-layer' },
]
