/**
 * M20 seed values (SRS M20 v1.2 §6.2, §6.11). Every value is the observed live value, except the
 * contact data (fictitious, DV-M20-09), the instant 2026-02-09 12:00 MYT (date observed, time
 * designed) and `views` (the values before the discovery run, ledger R04).
 */

import type { MarketplaceCategory } from '../../api/types'
import type { MpProduct, MpSeller } from '../repository/types'

/** One instant for every seeded `createdAt`: it reproduces the observed tie orders (R14). */
export const SEED_AT = '2026-02-09T12:00:00+08:00'

/** §6.2 (constant fixture). */
export const CATEGORY_SEED: readonly MarketplaceCategory[] = [
  { id: 1, slug: 'peralatan-sekolah', name: 'Peralatan Sekolah', icon: 'fa-pencil-ruler' },
  { id: 2, slug: 'buku-rujukan', name: 'Buku & Rujukan', icon: 'fa-book' },
  { id: 3, slug: 'uniform-pakaian', name: 'Uniform & Pakaian', icon: 'fa-tshirt' },
  { id: 4, slug: 'stationery', name: 'Stationery', icon: 'fa-pen' },
  { id: 5, slug: 'digital', name: 'Digital & E-Book', icon: 'fa-tablet-alt' },
  { id: 6, slug: 'lain-lain', name: 'Lain-lain', icon: 'fa-th-large' },
]

/** §6.11 A: the only seller, owned by canonical account 1 (M01). Contact data is fictitious. */
export const SELLER_SEED: readonly MpSeller[] = [
  {
    id: 1,
    userId: 1,
    shopName: 'JomBelajar Official',
    description:
      'Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾',
    phone: '0100000000',
    whatsapp: '60100000000',
    status: 'active',
    verifiedAt: SEED_AT,
    whatsappClicks: 16,
    createdAt: SEED_AT,
  },
]

type Row = readonly [
  id: number,
  slug: string,
  name: string,
  categoryId: number,
  price: string,
  originalPrice: string | null,
  condition: 'new' | 'used',
  shippingMethod: 'pickup' | 'postage' | 'cod' | 'free',
  shippingFee: string | null,
  location: string,
  views: number,
  description: string,
]

/** §6.11 B: the 10 observed products (all active, available, seller 1). */
const PRODUCT_ROWS: readonly Row[] = [
  [
    1,
    'beg-sekolah-anti-air-premium-vH1Fj',
    'Beg Sekolah Anti-Air Premium',
    1,
    '89.90',
    '129.90',
    'new',
    'postage',
    '8.00',
    'Kuala Lumpur',
    30,
    'Beg sekolah kalis air dengan 4 kompartmen, bahan nylon berkualiti tinggi. Sesuai untuk pelajar sekolah rendah dan menengah. Ringan dan tahan lama!',
  ],
  [
    2,
    'set-buku-latihan-matematik-tahun-6-5-buku-PAjPe',
    'Set Buku Latihan Matematik Tahun 6 (5 Buku)',
    2,
    '45.00',
    '65.00',
    'new',
    'free',
    null,
    'Selangor',
    14,
    'Set lengkap 5 buku latihan Matematik Tahun 6 mengikut silibus KSSR Semakan. Termasuk latihan UPSR, tips peperiksaan, dan jawapan penuh.',
  ],
  [
    3,
    'uniform-sekolah-baju-putih-lengan-panjang-saiz-m-hE8Jf',
    'Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)',
    3,
    '15.00',
    '35.00',
    'used',
    'cod',
    null,
    'Petaling Jaya, Selangor',
    13,
    'Baju sekolah putih lengan panjang, kain berkualiti, kolar bersih. Saiz M sesuai untuk pelajar 10-12 tahun. Terpakai tapi masih elok!',
  ],
  [
    4,
    'set-pensel-warna-faber-castell-48-warna-jj9F5',
    'Set Pensel Warna Faber-Castell 48 Warna',
    4,
    '32.90',
    '45.90',
    'new',
    'postage',
    '5.00',
    'Shah Alam',
    5,
    'Set pensel warna 48 batang Faber-Castell Classic. Warna terang dan mudah gaul. Sesuai untuk lukisan, seni, dan projek sekolah.',
  ],
  [
    5,
    'e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84',
    'E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)',
    2,
    '19.90',
    null,
    'new',
    'free',
    null,
    'Digital',
    7,
    'Koleksi 1001 soalan Sains Tingkatan 3 dalam format PDF. Termasuk jawapan dan penerangan lengkap. Boleh cetak atau baca di tablet!',
  ],
  [
    6,
    'kotak-pensel-3-tingkat-disney-frozen-strUX',
    'Kotak Pensel 3 Tingkat Disney Frozen',
    1,
    '22.90',
    '29.90',
    'new',
    'postage',
    '5.00',
    'Johor Bahru',
    3,
    'Kotak pensel 3 tingkat bertema Disney Frozen! Ada cermin, pengasah, dan pemadam. Kalis air dan sangat comel. Anak perempuan mesti suka!',
  ],
  [
    7,
    'kamus-dewan-edisi-keempat-terpakai-8axTV',
    'Kamus Dewan Edisi Keempat (Terpakai)',
    2,
    '25.00',
    '68.00',
    'used',
    'postage',
    '10.00',
    'Penang',
    5,
    'Kamus Dewan Bahasa dan Pustaka edisi keempat. Keadaan baik, tiada koyak atau conteng. Kulit keras, tahan lama. Wajib ada untuk pelajar!',
  ],
  [
    8,
    'botol-air-750ml-bpa-free-biru-KEz9H',
    'Botol Air 750ml BPA Free (Biru)',
    6,
    '18.90',
    '24.90',
    'new',
    'cod',
    null,
    'Klang Valley',
    19,
    'Botol air 750ml BPA-free, bahan Tritan tahan lama. Ada straw dan penutup kunci. Sesuai untuk ke sekolah, tuisyen, dan aktiviti sukan.',
  ],
  [
    9,
    'set-pembaris-t-square-jangka-lukis-matematik-36YYY',
    'Set Pembaris T-Square + Jangka Lukis Matematik',
    4,
    '14.50',
    '22.00',
    'new',
    'pickup',
    null,
    'Cyberjaya, Selangor',
    6,
    'Set lengkap alat lukisan geometri: pembaris T-square, jangka lukis, set square 30/60, protraktor, dan pensel 2B. Untuk kelas Matematik dan Lukisan.',
  ],
  [
    10,
    'kasut-sekolah-hitam-bata-saiz-5-jvPNC',
    'Kasut Sekolah Hitam BATA (Saiz 5)',
    3,
    '35.00',
    '79.90',
    'used',
    'cod',
    null,
    'Subang Jaya',
    9,
    'Kasut sekolah hitam jenama BATA, saiz 5 (UK). Baru pakai 2 bulan, masih dalam keadaan sangat baik. Tapak masih tebal, sesuai pelajar tingkatan 1-3.',
  ],
]

export const PRODUCT_SEED: readonly MpProduct[] = PRODUCT_ROWS.map(
  ([
    id,
    slug,
    name,
    categoryId,
    price,
    originalPrice,
    condition,
    shippingMethod,
    shippingFee,
    location,
    views,
    description,
  ]) => ({
    id,
    sellerId: 1,
    name,
    slug,
    categoryId,
    price,
    originalPrice,
    description,
    condition,
    stockStatus: 'available' as const,
    status: 'active' as const,
    shippingMethod,
    shippingFee,
    location,
    views,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  }),
)

/** §6.11 C / R15: images per product (Σ 45). */
export const IMAGE_COUNTS: readonly number[] = [4, 5, 5, 3, 4, 4, 5, 5, 5, 5]

/** Path of a seeded product photo (SRS §6.4, §6.11 C). The files are copied once, read-only, from live. */
export function imageUrl(productId: number, position: number): string {
  return `/images/marketplace/products/${String(productId)}/img_${String(position)}.jpg`
}
