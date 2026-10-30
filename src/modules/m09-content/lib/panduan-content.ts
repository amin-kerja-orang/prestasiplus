/**
 * S26/S27 guide copy (discovery M09 §2.26 and Appendix B; SRS FR-M09-113, FR-M09-114). Exact live
 * BM text. A step or feature description is a list of segments: a plain string or `{ b }` for the
 * bold phrase live puts inside the sentence (the inventory splits those phrases into their own
 * text rows).
 */

export type RoleId = 'pelajar' | 'guru' | 'ibubapa' | 'admin' | 'ppd'

export type Segment = string | { b: string }

export interface GuideStep {
  title: string
  text: readonly Segment[]
}

export interface GuideFeature {
  emoji: string
  title: string
  text: string
}

export interface GuideFaq {
  q: string
  a: string
}

export type RoleIconKey = 'user-plus' | 'presentation'
export type RoleSectionIconKey = 'gamepad' | 'wrench'

export interface GuideRole {
  id: RoleId
  emoji: string
  label: string
  sub: string
  stepsTitle: string
  /** Heading icon, only where a screenshot shows one (Pelajar, Guru); none for the other roles. */
  stepsIcon?: RoleIconKey
  /**
   * Step-number colour (design tokens only). OBSERVED: Pelajar blue, Guru green (panduan-desktop and
   * panduan-guru screenshots). INFERRED: purple, amber, teal (no screenshot of those panels).
   */
  accent: 'blue' | 'green' | 'purple' | 'amber' | 'teal'
  steps: readonly GuideStep[]
  /** The final "done" step (green tick). */
  done: GuideStep
  featuresTitle: string
  featuresIcon?: RoleSectionIconKey
  features: readonly GuideFeature[]
  faqTitle: string
  faqs: readonly GuideFaq[]
}

const b = (text: string): Segment => ({ b: text })

export const ROLE_IDS: readonly RoleId[] = ['pelajar', 'guru', 'ibubapa', 'admin', 'ppd']

export const GUIDE_ROLES: readonly GuideRole[] = [
  {
    id: 'pelajar',
    emoji: '👨‍🎓',
    label: 'Pelajar',
    sub: 'Tingkatan 1 – Tingkatan 5',
    stepsTitle: 'Cara Daftar Akaun Pelajar',
    stepsIcon: 'user-plus',
    accent: 'blue',
    steps: [
      {
        title: 'Buka Laman Web',
        text: ['Layari ', b('prestasiplus.my'), ' menggunakan pelayar web (Chrome/Safari).'],
      },
      {
        title: 'Klik "Daftar"',
        text: [
          'Di halaman utama, klik butang ',
          b('"Daftar Percuma"'),
          ' atau minta guru daftarkan anda.',
        ],
      },
      {
        title: 'Isi Maklumat',
        text: [
          'Masukkan ',
          b('nama penuh, e-mel, kata laluan'),
          ', dan pilih tingkatan anda.',
        ],
      },
      {
        title: 'Masuk Kelas',
        text: ['Minta ', b('kod kelas'), ' daripada guru anda dan masukkan untuk sertai kelas.'],
      },
    ],
    done: {
      title: 'Siap! Mula Berlatih',
      text: ['Anda kini boleh mula latih tubi, kumpul kombo, dan naik ranking!'],
    },
    featuresTitle: 'Apa Yang Boleh Anda Buat',
    featuresIcon: 'gamepad',
    features: [
      {
        emoji: '📝',
        title: 'Latih Tubi',
        text: 'Jawab soalan mengikut subjek dan topik. Semakin banyak latihan, semakin pandai!',
      },
      {
        emoji: '🔥',
        title: 'Kombo Harian',
        text: 'Latih tubi setiap hari untuk kekalkan kombo anda. Jangan putus!',
      },
      {
        emoji: '⚔️',
        title: 'Battle',
        text: 'Cabaran masa nyata — lawan kawan atau pelajar lain secara langsung!',
      },
      {
        emoji: '📊',
        title: 'Prestasi 360',
        text: 'Lihat kemajuan anda: ketepatan, subjek kuat/lemah, dan cadangan latihan.',
      },
      {
        emoji: '🏆',
        title: 'Ranking & Lencana',
        text: 'Naik ranking sekolah dan kumpul lencana pencapaian!',
      },
      {
        emoji: '🪙',
        title: 'Koin & Ganjaran',
        text: 'Setiap latihan beri koin. Kumpul dan tukar dengan ganjaran menarik.',
      },
    ],
    faqTitle: 'Soalan Lazim Pelajar',
    faqs: [
      {
        q: 'Macam mana nak reset kata laluan?',
        a: 'Pergi ke halaman login, klik "Lupa Kata Laluan", masukkan e-mel anda, dan ikut arahan dalam e-mel yang dihantar.',
      },
      {
        q: 'Saya tak ada e-mel. Boleh daftar?',
        a: 'Ya! Minta guru anda daftarkan akaun untuk anda melalui panel guru. Guru boleh import senarai pelajar.',
      },
      {
        q: 'Apa itu Kombo?',
        a: 'Kombo bermaksud hari berturut-turut anda berlatih. Jika anda berlatih setiap hari tanpa putus, kombo akan bertambah. Putus sehari = mula dari 0!',
      },
      {
        q: 'Boleh tukar kelas?',
        a: 'Minta guru baru anda tambahkan anda ke kelas baharu. Anda boleh berada dalam lebih dari satu kelas.',
      },
      {
        q: 'Macam mana nak naikkan ketepatan?',
        a: 'Fokus pada topik yang lemah (lihat di Prestasi 360), ulang latihan topik tersebut. Kualiti lebih penting dari kuantiti!',
      },
    ],
  },
  {
    id: 'guru',
    emoji: '👩‍🏫',
    label: 'Guru',
    sub: 'Guru Mata Pelajaran',
    stepsTitle: 'Cara Daftar Akaun Guru',
    stepsIcon: 'presentation',
    accent: 'green',
    steps: [
      {
        title: 'Daftar di prestasiplus.my',
        text: [
          'Klik ',
          b('"Daftar"'),
          ', pilih peranan ',
          b('"Guru"'),
          ', dan isi nama, e-mel, serta kata laluan.',
        ],
      },
      {
        title: 'Pilih Sekolah',
        text: ['Cari dan pilih sekolah anda dari senarai. Jika tiada, hubungi admin untuk tambah.'],
      },
      {
        title: 'Cipta Kelas',
        text: [
          'Pergi ke ',
          b('"Kelas Saya"'),
          ', klik ',
          b('"Cipta Kelas"'),
          '. Masukkan nama kelas, subjek, dan tingkatan.',
        ],
      },
      {
        title: 'Kongsi Kod Kelas',
        text: [
          'Setiap kelas ada ',
          b('kod unik'),
          ' (contoh: LZ0942). Beri kod ini kepada pelajar untuk sertai kelas.',
        ],
      },
    ],
    done: {
      title: 'Siap!',
      text: ['Kini anda boleh mula pantau prestasi pelajar dan urus kelas anda.'],
    },
    featuresTitle: 'Alat-Alat Guru',
    featuresIcon: 'wrench',
    features: [
      {
        emoji: '📋',
        title: 'Kelas Saya',
        text: 'Cipta kelas, tambah/import pelajar, tengok senarai dan status aktiviti setiap pelajar.',
      },
      {
        emoji: '📊',
        title: 'Prestasi Kelas',
        text: 'Dashboard kelas — purata ketepatan, ranking murid, trend prestasi 30 hari.',
      },
      {
        emoji: '🎯',
        title: 'Headcount',
        text: 'Set sasaran peperiksaan (TOV, OTR, ETR), jejak kemajuan dalam format rasmi KPM.',
      },
      {
        emoji: '⚠️',
        title: 'Amaran Awal',
        text: 'Kenal pasti murid berisiko berdasarkan skor risiko — ketepatan, penglibatan, penguasaan.',
      },
      {
        emoji: '📝',
        title: 'Log Intervensi',
        text: 'Rekod tindakan untuk pelajar berisiko — kaunseling, kelas tambahan, hubungi ibu bapa.',
      },
      {
        emoji: '🔥',
        title: 'Kombo Kelas',
        text: 'Pantau pelajar dormant (3+ hari tak aktif) dan lihat kombo setiap murid.',
      },
      {
        emoji: '🔬',
        title: 'Analisa Item',
        text: 'Analisis soalan yang paling salah dijawab, topik yang perlu ditekankan.',
      },
      {
        emoji: '✏️',
        title: 'Sumbang Soalan',
        text: 'Sumbang soalan dari Databank atau cipta soalan baharu untuk murid anda.',
      },
    ],
    faqTitle: 'Soalan Lazim Guru',
    faqs: [
      {
        q: 'Macam mana nak import pelajar secara pukal?',
        a: 'Pergi ke Kelas Saya → pilih kelas → klik "Import Pelajar". Muat naik fail CSV dengan nama dan e-mel pelajar.',
      },
      {
        q: 'Boleh saya ada lebih dari satu kelas?',
        a: 'Ya! Anda boleh cipta berapa kelas pun — setiap kelas ada kod unik sendiri.',
      },
      {
        q: 'Apa itu Headcount?',
        a: 'Headcount adalah format rasmi KPM untuk menjejak sasaran peperiksaan. Anda set TOV, OTR, dan ETR untuk setiap murid.',
      },
      {
        q: 'Macam mana nak tengok murid yang tak aktif?',
        a: 'Pergi ke Kombo → pilih kelas anda. Bahagian "Pelajar Dormant" akan tunjuk murid yang tak berlatih 3+ hari.',
      },
      {
        q: 'Bagaimana Log Intervensi berfungsi?',
        a: 'Dari Amaran Awal → klik "Intervensi" di sebelah nama murid → rekod jenis tindakan, tarikh, dan catatan.',
      },
    ],
  },
  {
    id: 'ibubapa',
    emoji: '👪',
    label: 'Ibu Bapa',
    sub: 'Pemantauan Anak',
    stepsTitle: 'Cara Daftar Akaun Ibu Bapa',
    accent: 'purple',
    steps: [
      {
        title: 'Daftar Akaun',
        text: [
          'Layari ',
          b('prestasiplus.my'),
          ', klik ',
          b('"Daftar"'),
          ', dan pilih peranan ',
          b('"Ibu Bapa"'),
          '.',
        ],
      },
      {
        title: 'Link Anak Anda',
        text: [
          'Selepas daftar, pergi ke profil dan masukkan ',
          b('e-mel anak'),
          ' untuk menghubungkan akaun.',
        ],
      },
      {
        title: 'Anak Terima Permintaan',
        text: ['Anak anda perlu ', b('menerima'), ' permintaan penghubungan dari akaun mereka.'],
      },
    ],
    done: {
      title: 'Siap! Pantau Anak Anda',
      text: ['Anda kini boleh lihat Prestasi 360 anak — ketepatan, aktiviti harian, dan cadangan.'],
    },
    featuresTitle: 'Apa Yang Ibu Bapa Boleh Lihat',
    features: [
      {
        emoji: '📊',
        title: 'Prestasi 360 Anak',
        text: 'Ketepatan keseluruhan, sesi latihan, koin, dan kombo harian anak anda.',
      },
      {
        emoji: '📚',
        title: 'Penguasaan Subjek',
        text: 'Lihat subjek kuat dan lemah, peratusan ketepatan setiap subjek.',
      },
      {
        emoji: '📅',
        title: 'Peta Aktiviti',
        text: 'Heatmap 90 hari — hari mana anak rajin berlatih dan skip.',
      },
      {
        emoji: '💡',
        title: 'Cadangan Pintar',
        text: 'Sistem beri cadangan subjek/topik yang anak patut fokuskan.',
      },
    ],
    faqTitle: 'Soalan Lazim Ibu Bapa',
    faqs: [
      {
        q: 'Boleh pantau lebih dari seorang anak?',
        a: 'Ya! Anda boleh link beberapa akaun anak dan pilih mana satu untuk dilihat.',
      },
      {
        q: 'Saya tak nampak data anak?',
        a: 'Pastikan anak sudah menerima permintaan link dari akaun mereka.',
      },
      {
        q: 'Adakah guru boleh lihat bahawa saya pantau?',
        a: 'Tidak. Data anda peribadi. Guru hanya nampak data prestasi anak sahaja.',
      },
    ],
  },
  {
    id: 'admin',
    emoji: '🏫',
    label: 'Admin Sekolah',
    sub: 'Pengetua / GPK',
    stepsTitle: 'Cara Mula Sebagai Admin Sekolah',
    accent: 'amber',
    steps: [
      {
        title: 'Hubungi Admin PRESTASIPLUS',
        text: [
          'Akaun Admin Sekolah perlu didaftarkan oleh pentadbir sistem. Hubungi kami untuk setup.',
        ],
      },
      {
        title: 'Daftar Guru',
        text: [
          'Dari panel admin, pergi ke ',
          b('"Senarai Guru"'),
          ' → ',
          b('"Cipta Pengguna"'),
          '.',
        ],
      },
      {
        title: 'Import Pelajar',
        text: [
          'Gunakan ',
          b('"Import Pelajar"'),
          ' untuk muat naik senarai pelajar secara pukal menggunakan CSV.',
        ],
      },
    ],
    done: {
      title: 'Siap!',
      text: ['Sekolah kini aktif. Guru boleh cipta kelas dan pelajar boleh mula berlatih.'],
    },
    featuresTitle: 'Fungsi Admin Sekolah',
    features: [
      {
        emoji: '👨‍🏫',
        title: 'Urus Guru',
        text: 'Daftar guru, edit profil, aktif/nyahaktif akaun guru.',
      },
      {
        emoji: '👨‍🎓',
        title: 'Urus Pelajar',
        text: 'Import pelajar pukal, edit maklumat, pantau senarai seluruh sekolah.',
      },
      {
        emoji: '📊',
        title: 'Prestasi Sekolah',
        text: 'Dashboard seluruh sekolah — prestasi mengikut kelas, subjek, tingkatan.',
      },
      {
        emoji: '⚠️',
        title: 'Amaran Awal',
        text: 'Ringkasan risiko seluruh sekolah, senarai pelajar berisiko.',
      },
      {
        emoji: '📑',
        title: 'Ringkasan Eksekutif',
        text: 'Laporan 1 halaman boleh dicetak — KPI, taburan risiko, pecahan subjek.',
      },
      {
        emoji: '📊',
        title: 'Statistik Penggunaan',
        text: 'Pelajar aktif, sesi latihan, soalan dijawab — gambaran engagement.',
      },
    ],
    faqTitle: 'Soalan Lazim Admin',
    faqs: [
      {
        q: 'Format CSV untuk import pelajar?',
        a: 'CSV perlu ada lajur: name, email, grade (T4, T5, D1-D6). Baris pertama adalah header. E-mel mesti unik.',
      },
      {
        q: 'Boleh reset kata laluan guru/pelajar?',
        a: 'Ya! Dari senarai guru/pelajar, klik nama pengguna, kemudian "Reset Kata Laluan".',
      },
      {
        q: 'Macam mana nak cetak Ringkasan Eksekutif?',
        a: 'Amaran Awal → Ringkasan Eksekutif → Cetak / PDF.',
      },
    ],
  },
  {
    id: 'ppd',
    emoji: '📊',
    label: 'PPD / JPN',
    sub: 'Pegawai Daerah / Negeri',
    stepsTitle: 'Cara Mula Sebagai PPD / JPN',
    accent: 'teal',
    steps: [
      {
        title: 'Hubungi Admin PRESTASIPLUS',
        text: ['Akaun PPD/JPN didaftarkan oleh pentadbir sistem. Nyatakan daerah dan negeri anda.'],
      },
      {
        title: 'Login & Akses Dashboard',
        text: [
          'Selepas akaun aktif, login dan akses menu ',
          b('Amaran Awal'),
          ' untuk data daerah/negeri.',
        ],
      },
    ],
    done: {
      title: 'Siap!',
      text: ['Anda kini boleh pantau data risiko seluruh daerah atau negeri anda.'],
    },
    featuresTitle: 'Fungsi PPD / JPN',
    features: [
      {
        emoji: '📊',
        title: 'Dashboard Daerah (PPD)',
        text: 'Ringkasan semua sekolah dalam daerah — taburan risiko, ranking sekolah.',
      },
      {
        emoji: '🗺️',
        title: 'Dashboard Negeri (JPN)',
        text: 'Gambaran seluruh negeri — perbandingan daerah dan sekolah.',
      },
      {
        emoji: '📑',
        title: 'Ringkasan Eksekutif',
        text: 'Laporan 1 halaman untuk mesyuarat — KPI, taburan risiko. Boleh cetak/PDF.',
      },
      {
        emoji: '📥',
        title: 'Muat Turun CSV',
        text: 'Export data risiko dalam CSV untuk analisis lanjut.',
      },
      {
        emoji: '🏫',
        title: 'Direktori Sekolah',
        text: 'Cari dan lihat data mana-mana sekolah dalam kawasan anda.',
      },
      {
        emoji: '🔥',
        title: 'Kombo & Penglibatan',
        text: 'Pantau kadar penglibatan — purata kombo, pelajar aktif vs dormant.',
      },
    ],
    faqTitle: 'Soalan Lazim PPD / JPN',
    faqs: [
      {
        q: 'Data dari mana?',
        a: 'Semua data dijana automatik dari aktiviti latih tubi pelajar. Tiada input manual diperlukan.',
      },
      {
        q: 'Berapa kerap data dikemas kini?',
        a: 'Data dikemas kini secara masa nyata. Setiap kali pelajar selesai latihan, data terus dikira.',
      },
      {
        q: 'Boleh muat turun laporan?',
        a: 'Ya! Gunakan "Muat Turun CSV" atau "Ringkasan Eksekutif" untuk cetak PDF.',
      },
      {
        q: 'Saya nampak 0 pelajar. Kenapa?',
        a: 'Belum ada sekolah dalam daerah/negeri anda yang aktif menggunakan platform.',
      },
    ],
  },
]

/** The role whose panel shows for a URL hash: the hash without "#", or `pelajar` when empty. */
export function roleFromHash(hash: string): string {
  return hash.replace('#', '') || 'pelajar'
}
