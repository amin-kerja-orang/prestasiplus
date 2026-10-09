/**
 * S6 `/mohon-keluarga-angkat` static copy (SRS M21 v1.2 FR-M21-46..49; URS FN-M21-4.2.1..4.2.6;
 * discovery §2.6). Exact BM copy of live.
 */

import {
  APPLICATION_CATEGORIES,
  APPLICATION_CATEGORY_LABELS,
  FAMILY_INCOME_LABELS,
  FAMILY_INCOME_RANGES,
  type ApplicationCategory,
  type FamilyIncomeRange,
} from '../../api/types'

export const MOHON_COPY = {
  title: 'Mohon Keluarga Angkat',
  /** Header subtitle (FR-M21-05, DV-M21-06). */
  headerSubtitle: 'Selamat datang kembali',
  heroLead: 'Isi borang ini untuk memohon tajaan akses PrestasiPlus secara percuma.',
  emailLabel: 'Email Pelajar',
  emailPlaceholder: 'pelajar@email.com',
  hintBefore:
    'Email pelajar yang berdaftar dalam PrestasiPlus. Jika pelajar belum daftar, minta mereka daftar terlebih dahulu di ',
  hintLink: 'sini',
  hintAfter: '.',
  categoryLabel: 'Kategori Pelajar',
  categoryPlaceholder: 'Pilih kategori',
  incomeLabel: 'Anggaran Pendapatan Keluarga',
  incomePlaceholder: 'Pilih (pilihan)',
  reasonLabel: 'Sebab Permohonan',
  reasonPlaceholder: 'Terangkan kenapa pelajar ini memerlukan tajaan...',
  examplesTitle: 'Contoh sebab permohonan:',
  examplesNote:
    'Klik mana-mana contoh untuk guna sebagai template. Sila ubahsuai mengikut situasi sebenar.',
  submit: 'Hantar Permohonan',
  afterTitle: 'Apa yang berlaku selepas mohon?',
  afterSteps: [
    'Admin semak dan luluskan permohonan (1-3 hari bekerja)',
    'Pelajar masuk ke pool — sponsor/keluarga angkat boleh pilih',
    'Bila sponsor pilih, pelajar dapat akses PERCUMA PrestasiPlus selama 1 sesi persekolahan',
    'Keluarga angkat boleh pantau prestasi pelajar dari dashboard mereka',
  ],
  whoTitle: 'Siapa boleh mohon?',
  who: [
    { strong: 'Pelajar sendiri', rest: ' — mohon untuk diri sendiri' },
    { strong: 'Ibu bapa', rest: ' — mohon untuk anak' },
    {
      strong: 'Guru / Kaunselor',
      rest: ' — mohon untuk pelajar yang dikenal pasti memerlukan',
    },
  ],
} as const

/** The five clickable examples; the leading "• " is part of the text (DV-M21-09, replicated). */
export const REASON_EXAMPLES: readonly string[] = [
  '• Keluarga berpendapatan rendah (B40). Bapa bekerja sebagai buruh am, ibu suri rumah. Tidak mampu membayar yuran tuisyen tambahan untuk persediaan SPM.',
  '• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pendapatan tetap. Pelajar ini berpotensi tetapi tiada akses kepada bahan pembelajaran digital.',
  '• Anak asnaf yang menerima bantuan zakat. Keluarga mempunyai 6 orang anak dan pendapatan tidak mencukupi untuk perbelanjaan pendidikan tambahan.',
  '• Pelajar OKU (masalah penglihatan) yang memerlukan akses digital kerana sukar membaca buku teks biasa. Platform digital lebih mesra OKU dengan saiz teks boleh dilaraskan.',
  '• Pelajar cemerlang dari keluarga miskin. Mendapat 5A dalam PT3 tetapi ibu bapa tidak mampu hantar ke tuisyen. Dengan PrestasiPlus, pelajar ini boleh belajar sendiri dari rumah.',
]

export const CATEGORY_OPTIONS: ReadonlyArray<{ value: ApplicationCategory; label: string }> =
  APPLICATION_CATEGORIES.map((value) => ({ value, label: APPLICATION_CATEGORY_LABELS[value] }))

export const INCOME_OPTIONS: ReadonlyArray<{ value: FamilyIncomeRange; label: string }> =
  FAMILY_INCOME_RANGES.map((value) => ({ value, label: FAMILY_INCOME_LABELS[value] }))
