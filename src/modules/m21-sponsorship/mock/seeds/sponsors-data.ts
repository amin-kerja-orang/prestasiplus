/**
 * Seed values of the `sponsors` store, moved unchanged from M17's provisional host (F-33, M21-T1).
 * OBSERVED values are marked; every other value is INFERRED and named as such. Sources: M17 SRS §6.4,
 * §6.8 XR-M17-16; M21 SRS v1.2 §6.11 A (sponsors).
 */

import type { SponsorRow } from '../repository/types'

const NONE = {
  tagline: null,
  logoUrl: null,
  registrationNumber: null,
  contactPersonName: null,
  contactPersonPosition: null,
  contactEmail: null,
  contactPhone: null,
  address: null,
  city: null,
  state: null,
  postcode: null,
} as const

/**
 * OBSERVED (M21 §6.11 A): six sponsors, all `SYARIKAT_SWASTA` and `SUSPENDED`; ids 6-11, names,
 * descriptions, websites and dates as observed on live; time of day 12:00 MYT is designed by the
 * M21 SRS. Linked logins are M02 sponsor users 5501-5505 and the canonical sponsor 7.
 * INFERRED: sponsor 11's contact person name is left empty (a person name is never seeded here;
 * M21 designs a fictitious one) and its contact e-mail, phone and address are the M21 fictitious
 * values.
 */
export const SPONSORS: readonly SponsorRow[] = [
  {
    ...NONE,
    id: 6,
    userId: 5501,
    name: 'Kedai Buku Popular',
    category: 'SYARIKAT_SWASTA',
    description:
      'Rangkaian kedai buku terbesar Malaysia. Menyediakan buku-buku pendidikan berkualiti untuk semua peringkat umur.',
    website: 'https://www.popular.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 7,
    userId: 5502,
    name: 'Faber-Castell Malaysia',
    category: 'SYARIKAT_SWASTA',
    description:
      'Penyedia alat tulis premium untuk pelajar. Pensil, pen warna, dan set lukisan berkualiti tinggi.',
    website: 'https://www.faber-castell.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 8,
    userId: 5503,
    name: 'KidZania Kuala Lumpur',
    category: 'SYARIKAT_SWASTA',
    description:
      'Taman tema pendidikan interaktif di mana kanak-kanak boleh bermain sambil belajar tentang pelbagai kerjaya.',
    website: 'https://www.kidzania.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 9,
    userId: 5504,
    name: 'Petrosains Discovery Centre',
    category: 'SYARIKAT_SWASTA',
    description:
      'Pusat penemuan sains interaktif di KLCC. Jelajahi dunia sains dan teknologi melalui pameran menarik.',
    website: 'https://www.petrosains.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 10,
    userId: 5505,
    name: 'PRESTASIPLUS Official',
    category: 'SYARIKAT_SWASTA',
    description: 'Ganjaran rasmi dari PRESTASIPLUS — hadiah eksklusif untuk pelajar cemerlang!',
    website: 'https://jombelajar.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 11,
    userId: 7,
    name: 'Alesa It Services',
    category: 'SYARIKAT_SWASTA',
    description: 'Syarikat IT',
    website: 'https://alesa.my',
    contactPersonPosition: 'Pengurus',
    contactEmail: 'pegawai.alesa@demo.test',
    contactPhone: '0100000011',
    address: 'No. 1, Jalan Contoh 1/1',
    city: 'Shah Alam',
    state: 'Selangor',
    postcode: '40000',
    status: 'SUSPENDED',
    createdAt: '2026-03-31T12:00:00+08:00',
  },
]
