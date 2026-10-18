/**
 * Hero header cards of the main Pentadbiran pages (exact path match). The card is drawn by the
 * layout, so the pages themselves stay untouched.
 */
import type { Art3DName } from '@/ds/assets'

export interface PentadbiranHeroSpec {
  overline: string
  title: string
  subtitle: string
  art: Art3DName
}

const HEROES: Record<string, PentadbiranHeroSpec> = {
  '/admin/command-center': {
    overline: 'Pemantauan',
    title: 'Pemantauan Langsung',
    subtitle: 'Pantau aktiviti pelajar, guru dan sekolah di seluruh negara secara langsung.',
    art: 'rocket',
  },
  '/admin/users': {
    overline: 'Pengguna & Sekolah',
    title: 'Pengguna',
    subtitle: 'Cari, tapis dan urus akaun pelajar, guru dan pentadbir.',
    art: 'party',
  },
  '/admin/schools': {
    overline: 'Pengguna & Sekolah',
    title: 'Sekolah',
    subtitle: 'Senarai sekolah berdaftar beserta status dan langganan.',
    art: 'trophy',
  },
  '/admin/questions': {
    overline: 'Bank Soalan',
    title: 'Bank Soalan',
    subtitle: 'Semak, tapis dan kemas kini soalan dalam bank soalan.',
    art: 'books',
  },
  '/admin/curriculum': {
    overline: 'Kurikulum & Kandungan',
    title: 'Kurikulum',
    subtitle: 'Struktur tahap, subjek, bab dan topik pembelajaran.',
    art: 'cap',
  },
  '/admin/school-subscriptions': {
    overline: 'Kewangan',
    title: 'Langganan Sekolah',
    subtitle: 'Pantau langganan, tempoh dan pembaharuan setiap sekolah.',
    art: 'coin',
  },
}

export function heroFor(path: string): PentadbiranHeroSpec | undefined {
  return HEROES[path.length > 1 ? path.replace(/\/+$/, '') : path]
}
