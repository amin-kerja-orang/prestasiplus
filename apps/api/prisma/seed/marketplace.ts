/**
 * Marketplace seed (BE-46): the one observed shop "JomBelajar Official", the
 * 10 observed products and their 45 image paths. Values are the observed ones of the M20 mock seed
 * (`src/modules/m20-marketplace/mock/data/seed-data.ts`, SRS M20 6.11); the seller contact data is
 * fictitious. Idempotent (plan 14.9 item 4): the 6 categories are the reference seed core-marketplace-categories; the seller is matched by its owner,
 * a product by slug and an image by (product, position); an existing row is never updated, so a
 * counter that moved since the first run survives. `legacy_*` is never set. Needs the identity seed
 * (the shop belongs to the seeded Admin Pusat account, BE-46 open question 6).
 */
import type { PrismaClient } from '../../src/db/client'
import type { SeedModule } from './index'
import { MARKETPLACE_CATEGORIES } from './core/marketplace-categories'

/** One instant for every seeded `created_at`: it reproduces the observed tie orders. */
const SEED_AT = new Date('2026-02-09T12:00:00+08:00')
/** Natural key of the owner: the canonical Admin Pusat demo account. */
const SELLER_OWNER_EMAIL = 'admin@demo.test'

const SELLER = {
  shopName: 'JomBelajar Official',
  description: 'Kedai rasmi JomBelajar — peralatan sekolah berkualiti untuk semua pelajar Malaysia 🇲🇾',
  phone: '0100000000',
  whatsapp: '60100000000',
  whatsappClicks: 16,
} as const

type Shipping = 'pickup' | 'postage' | 'cod' | 'free'

interface ProductSeed {
  slug: string
  name: string
  /** 1-based index into MARKETPLACE_CATEGORIES. */
  category: number
  price: string
  originalPrice: string | null
  condition: 'new' | 'used'
  shippingMethod: Shipping
  shippingFee: string | null
  location: string
  views: number
  description: string
  images: number
}

export const PRODUCTS: readonly ProductSeed[] = [
  { slug: 'beg-sekolah-anti-air-premium-vH1Fj', name: 'Beg Sekolah Anti-Air Premium', category: 1, price: '89.90', originalPrice: '129.90', condition: 'new', shippingMethod: 'postage', shippingFee: '8.00', location: 'Kuala Lumpur', views: 30, images: 4,
    description: 'Beg sekolah kalis air dengan 4 kompartmen, bahan nylon berkualiti tinggi. Sesuai untuk pelajar sekolah rendah dan menengah. Ringan dan tahan lama!' },
  { slug: 'set-buku-latihan-matematik-tahun-6-5-buku-PAjPe', name: 'Set Buku Latihan Matematik Tahun 6 (5 Buku)', category: 2, price: '45.00', originalPrice: '65.00', condition: 'new', shippingMethod: 'free', shippingFee: null, location: 'Selangor', views: 14, images: 5,
    description: 'Set lengkap 5 buku latihan Matematik Tahun 6 mengikut silibus KSSR Semakan. Termasuk latihan UPSR, tips peperiksaan, dan jawapan penuh.' },
  { slug: 'uniform-sekolah-baju-putih-lengan-panjang-saiz-m-hE8Jf', name: 'Uniform Sekolah Baju Putih Lengan Panjang (Saiz M)', category: 3, price: '15.00', originalPrice: '35.00', condition: 'used', shippingMethod: 'cod', shippingFee: null, location: 'Petaling Jaya, Selangor', views: 13, images: 5,
    description: 'Baju sekolah putih lengan panjang, kain berkualiti, kolar bersih. Saiz M sesuai untuk pelajar 10-12 tahun. Terpakai tapi masih elok!' },
  { slug: 'set-pensel-warna-faber-castell-48-warna-jj9F5', name: 'Set Pensel Warna Faber-Castell 48 Warna', category: 4, price: '32.90', originalPrice: '45.90', condition: 'new', shippingMethod: 'postage', shippingFee: '5.00', location: 'Shah Alam', views: 5, images: 3,
    description: 'Set pensel warna 48 batang Faber-Castell Classic. Warna terang dan mudah gaul. Sesuai untuk lukisan, seni, dan projek sekolah.' },
  { slug: 'e-book-1001-soalan-sains-tingkatan-3-pdf-tqd84', name: 'E-Book: 1001 Soalan Sains Tingkatan 3 (PDF)', category: 2, price: '19.90', originalPrice: null, condition: 'new', shippingMethod: 'free', shippingFee: null, location: 'Digital', views: 7, images: 4,
    description: 'Koleksi 1001 soalan Sains Tingkatan 3 dalam format PDF. Termasuk jawapan dan penerangan lengkap. Boleh cetak atau baca di tablet!' },
  { slug: 'kotak-pensel-3-tingkat-disney-frozen-strUX', name: 'Kotak Pensel 3 Tingkat Disney Frozen', category: 1, price: '22.90', originalPrice: '29.90', condition: 'new', shippingMethod: 'postage', shippingFee: '5.00', location: 'Johor Bahru', views: 3, images: 4,
    description: 'Kotak pensel 3 tingkat bertema Disney Frozen! Ada cermin, pengasah, dan pemadam. Kalis air dan sangat comel. Anak perempuan mesti suka!' },
  { slug: 'kamus-dewan-edisi-keempat-terpakai-8axTV', name: 'Kamus Dewan Edisi Keempat (Terpakai)', category: 2, price: '25.00', originalPrice: '68.00', condition: 'used', shippingMethod: 'postage', shippingFee: '10.00', location: 'Penang', views: 5, images: 5,
    description: 'Kamus Dewan Bahasa dan Pustaka edisi keempat. Keadaan baik, tiada koyak atau conteng. Kulit keras, tahan lama. Wajib ada untuk pelajar!' },
  { slug: 'botol-air-750ml-bpa-free-biru-KEz9H', name: 'Botol Air 750ml BPA Free (Biru)', category: 6, price: '18.90', originalPrice: '24.90', condition: 'new', shippingMethod: 'cod', shippingFee: null, location: 'Klang Valley', views: 19, images: 5,
    description: 'Botol air 750ml BPA-free, bahan Tritan tahan lama. Ada straw dan penutup kunci. Sesuai untuk ke sekolah, tuisyen, dan aktiviti sukan.' },
  { slug: 'set-pembaris-t-square-jangka-lukis-matematik-36YYY', name: 'Set Pembaris T-Square + Jangka Lukis Matematik', category: 4, price: '14.50', originalPrice: '22.00', condition: 'new', shippingMethod: 'pickup', shippingFee: null, location: 'Cyberjaya, Selangor', views: 6, images: 5,
    description: 'Set lengkap alat lukisan geometri: pembaris T-square, jangka lukis, set square 30/60, protraktor, dan pensel 2B. Untuk kelas Matematik dan Lukisan.' },
  { slug: 'kasut-sekolah-hitam-bata-saiz-5-jvPNC', name: 'Kasut Sekolah Hitam BATA (Saiz 5)', category: 3, price: '35.00', originalPrice: '79.90', condition: 'used', shippingMethod: 'cod', shippingFee: null, location: 'Subang Jaya', views: 9, images: 5,
    description: 'Kasut sekolah hitam jenama BATA, saiz 5 (UK). Baru pakai 2 bulan, masih dalam keadaan sangat baik. Tapak masih tebal, sesuai pelajar tingkatan 1-3.' },
]

/** Relative path of a seeded product photo; the files stay frontend assets (BE-46 open question 2). */
export const imageUrl = (productNumber: number, position: number): string => `/images/marketplace/products/${String(productNumber)}/img_${String(position)}.jpg`

async function run(prisma: PrismaClient): Promise<void> {
  const categoryIds: bigint[] = []
  // The categories are reference data (core-marketplace-categories) and must already exist.
  for (const c of MARKETPLACE_CATEGORIES) {
    const row = await prisma.marketplaceCategory.findUnique({ where: { slug: c.slug } })
    if (!row) throw new Error(`marketplace seed: category ${c.slug} is missing (run core-marketplace-categories first).`)
    categoryIds.push(row.id)
  }

  const owner = await prisma.user.findFirst({ where: { email: SELLER_OWNER_EMAIL }, select: { id: true } })
  if (!owner) throw new Error(`marketplace seed: the owner account ${SELLER_OWNER_EMAIL} is missing (run the identity seed first).`)
  const seller =
    (await prisma.marketplaceSeller.findUnique({ where: { userId: owner.id } })) ??
    (await prisma.marketplaceSeller.create({ data: { ...SELLER, userId: owner.id, status: 'active', verifiedAt: SEED_AT, createdAt: SEED_AT } }))

  for (const [i, p] of PRODUCTS.entries()) {
    const existing = await prisma.marketplaceProduct.findUnique({ where: { slug: p.slug } })
    const product =
      existing ??
      (await prisma.marketplaceProduct.create({
        data: {
          sellerId: seller.id,
          name: p.name,
          slug: p.slug,
          categoryId: categoryIds[p.category - 1]!,
          price: p.price,
          originalPrice: p.originalPrice,
          description: p.description,
          condition: p.condition,
          stockStatus: 'available',
          status: 'active',
          shippingMethod: p.shippingMethod,
          shippingFee: p.shippingFee,
          location: p.location,
          views: p.views,
          createdAt: SEED_AT,
          updatedAt: SEED_AT,
        },
      }))
    await prisma.marketplaceProductImage.createMany({
      data: Array.from({ length: p.images }, (_, n) => ({ productId: product.id, position: n + 1, url: imageUrl(i + 1, n + 1) })),
      skipDuplicates: true,
    })
  }
}

export const marketplaceSeed: SeedModule = {
  name: 'marketplace',
  async run(ctx) {
    await run(ctx.prisma)
  },
}
