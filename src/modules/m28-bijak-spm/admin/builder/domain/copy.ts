/**
 * BM copy of the Set Builder and Semak Kertas screens. Strings marked V2 are verbatim from the
 * V2 Panel / .cloud (docs/discovery/cloud-student-mechanism.md 3.4, docs/design/v2-admin-student-pipeline.md
 * S4.1 to S4.4). Strings marked [PROPOSED] have no V2 counterpart (the backend contract differs or the
 * design spec proposes them).
 */
export const builderCopy = {
  // Landing (S4.1)
  landingTitle: 'Set Builder', // V2
  landingSubtitle: 'Kertas latihan daripada bank soalan percubaan', // V2
  introKicker: 'Bank soalan', // V2
  introTitle: 'Bina set soalan', // V2
  introText: 'Ambil soalan daripada kertas percubaan mengikut subjek, tahun dan negeri.', // V2
  blankTitle: 'Mula kosong', // V2
  blankTitleField: 'Tajuk set kosong', // V2
  subject: 'Subjek', // V2
  subjectPlaceholder: 'Pilih subjek', // V2
  kertas: 'Kertas', // [PROPOSED] D83 D-6
  kertasPlaceholder: 'Pilih kertas', // [PROPOSED]
  blankCreated: 'Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula.', // V2
  generateTitle: 'Jana set', // V2
  generateSub: 'Ambil soalan secara rawak', // V2
  countField: 'Bilangan soalan', // V2
  countHint: (subject: string, kertas: number): string => `Mengikut kontrak ${subject} Kertas ${kertas}.`, // [PROPOSED]
  poolTitle: 'Kolam soalan', // V2
  poolAvailable: (n: number): string => `${n} soalan tersedia`, // V2
  poolRequested: (k: number): string => `Anda meminta ${k} daripadanya.`, // V2
  poolNoScheme: 'Subjek ini tiada soalan berskema, jadi set tidak boleh dijana.', // V2
  poolSame: 'Sama dengan jumlah kolam — setiap set akan serupa.', // V2
  poolReduce: 'Kurangkan bilangan soalan atau longgarkan penapis.', // V2
  generated: (n: number): string => `${n} soalan dijana secara rawak. Semak sebelum menerbitkan.`, // V2
  generateBlocked: 'Kolam tidak mencukupi — lihat Pratonton kolam.', // [PROPOSED]
  poolPreview: 'Pratonton kolam', // [PROPOSED label per design brief]
  poolOk: 'Kolam mencukupi untuk kontrak ini.', // [PROPOSED]
  poolUncertain: 'Kolam belum dapat disahkan. Cuba lagi.', // [PROPOSED]
  poolOpenFull: 'Buka pratonton penuh', // [PROPOSED]
  noBlueprint: 'Tiada kontrak untuk subjek/kertas ini.', // V2
  listTitle: 'Senarai set', // [PROPOSED]
  listEmpty: 'Belum ada set.', // V2 (design S4.1)
  open: 'Buka', // [PROPOSED]
  copy: 'Salin set', // V2
  statusTerbit: 'Terbit', // V2
  statusDraf: 'Draf', // V2
  loadError: 'Tidak dapat memuatkan senarai set.', // [PROPOSED]

  // Builder (S4.2)
  back: 'Kembali', // V2 "← Kembali"
  totalMarks: (n: number): string => `Jumlah markah keseluruhan: ${n} markah`, // V2
  publish: 'Terbitkan', // V2
  publishing: 'Menerbitkan…', // V2
  renamed: (t: string): string => `Set '${t}' telah dinamakan semula.`, // V2
  titleAria: 'Tajuk set', // V2
  bank: 'Bank Soalan', // V2
  search: 'Cari teks soalan…', // V2
  destination: 'Bahagian destinasi', // V2
  levelAll: 'Semua tingkatan', // [PROPOSED]
  levelT4: 'Tingkatan 4', // [PROPOSED]
  levelT5: 'Tingkatan 5', // [PROPOSED]
  levelT13: 'Tingkatan 1-3', // [PROPOSED]
  unitAll: 'Semua unit', // [PROPOSED]
  add: 'Tambah', // V2
  remove: 'Buang', // V2
  published: 'Terbit', // V2 badge
  inSet: 'Dalam set', // V2 (Panel)
  noMatch: 'Tiada soalan sepadan.', // V2
  fill: (n: number, total: number): string => `${n} / ${total} dipilih`, // V2
  sectionEmpty: "Tiada soalan dalam bahagian ini. Gunakan butang 'Tambah' pada senarai bank.", // [PROPOSED] (V2 says "Lepaskan soalan di sini", no drag here)
  up: 'Naik', // D83 D-9
  down: 'Turun', // D83 D-9
  upAria: (n: number): string => `Naikkan soalan ${n}`, // [PROPOSED] design D-9
  downAria: (n: number): string => `Turunkan soalan ${n}`, // [PROPOSED] design D-9
  groupBadge: (label: string, n: number): string => `Kumpulan rangsangan ${label} · ${n} soalan bergerak bersama`, // existing editor copy
  contractTitle: 'Kontrak Simulasi', // V2
  editContract: 'Sunting kontrak', // V2
  blockedCount: (n: number): string => `${n} masalah menghalang penerbitan.`, // V2 design
  published_ok: 'Set ini telah diterbitkan.', // V2
  visibleDraft: 'Belum boleh dibuka murid — set ini masih draf.', // V2 design [PROPOSED]
  visibleLive: 'Murid boleh membuka set ini di: Simulasi, Simulasi — Kuiz, Tracking A (jika ditanda).', // V2 design [PROPOSED]
  paneBank: 'Bank Soalan', // V2
  paneSet: 'Set', // V2
  paneNav: 'Paparan pembina', // [PROPOSED]
  poolMore: 'Muat lagi', // [PROPOSED]
  // error toasts (V2 verbatim, used when the server sent no BM line)
  errAdd: 'Soalan gagal ditambah — cuba lagi.',
  errOrder: 'Susunan gagal disimpan — muat semula halaman dan cuba lagi.',
  errRemove: 'Soalan gagal dibuang — cuba lagi.',
  errPool: 'Ralat semasa mencari bank soalan.',
  errValidate: 'Set ini tidak lulus pengesahan.',
  errPublish: 'Ralat tidak dijangka semasa menerbitkan.',
  errNetwork: 'Ralat rangkaian semasa menerbitkan.',
  errRename: 'Bahagian gagal dikemas kini.',
  errLoad: 'Tidak dapat memuatkan set ini.', // [PROPOSED]
  errGenerate: 'Set tidak dapat dijana. Sila cuba lagi.', // [PROPOSED]
  errGenerateShortage: 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.', // existing K3 copy

  // Semak Kertas (S4.4)
  meta: 'Kemas kini metadata', // V2
  fTitle: 'Tajuk', // V2
  fYear: 'Tahun', // [PROPOSED] (contract field)
  fDuration: 'Tempoh (minit)', // V2
  fCode: 'Kod kertas (kulit)', // V2 (read-only here: not in the contract)
  fInstructions: 'Arahan kulit kertas', // V2
  fInstructionsHint: 'Satu baris = satu arahan bernombor di kulit kertas.', // V2
  metaSave: 'Kemas kini', // [PROPOSED]
  metaSaved: (t: string): string => `Kertas '${t}' telah dikemas kini.`, // V2
  review: 'Semakan kertas', // [PROPOSED]
  blockers: 'Belum boleh diterbitkan', // V2 ("Belum boleh diterbitkan" blockers)
  notes: 'Nota (tidak menghalang penerbitan)', // [PROPOSED]
  blueprintNeedsReview: 'Blueprint perlu semakan', // contract copy
  reviewOk: 'Tiada masalah menghalang penerbitan.', // [PROPOSED]
  publishPanel: 'Penerbitan', // V2
  publishCheckFailed: 'Terbitkan dinyahaktifkan: semakan kertas tidak dapat dijalankan. Muat semula dan cuba lagi.', // [PROPOSED]
  publishDisabledWhy: (n: number): string => `Terbitkan dinyahaktifkan: ${n} masalah perlu dibetulkan.`, // [PROPOSED]
  notPublishable: (n: number): string => `Kertas ini belum boleh diterbitkan — ${n} masalah perlu dibetulkan.`, // V2
  publishedFlash: (t: string): string => `Kertas '${t}' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi.`, // V2
  withdraw: 'Tarik balik', // task label
  withdrawnFlash: (t: string): string => `Kertas '${t}' ditarik balik ke DRAF — tidak lagi diakses pelajar.`, // V2
  live: 'Kertas ini sedang DITERBITKAN — pelajar boleh mengaksesnya di Simulasi.', // V2
  lockedNote: 'Kertas ini sudah diterbitkan — tekan “Salin set” di atas untuk menyunting salinan draf.', // V2
  copied: 'Set disalin sebagai draf. Sunting dan terbitkan salinan baharu.', // V2
  studentView: 'Pratonton sebagai pelajar', // existing
  studentViewDesc: 'Paparan kertas tanpa skema.', // existing
  studentViewError: 'Tidak dapat memuatkan paparan pelajar.', // [PROPOSED]
  seen: 'Dilihat murid', // task label
  notServed: 'Tidak disajikan', // V2 design S4.2 chip
  loading: 'Memuatkan…', // [PROPOSED]
  poolEnd: 'Tiada lagi soalan.', // [PROPOSED]
  unitNoMarks: 'Kumpulan rangsangan: markah ada pada setiap soalan.', // [PROPOSED] D90
  groupMembers: (n: number): string => `${n} soalan dalam kumpulan`, // [PROPOSED] D90
  sectionFull: 'Bahagian ini sudah penuh.', // [PROPOSED]
  reviewStale: 'Simpan draf untuk menyegarkan semakan.', // [PROPOSED]
  reviewError: 'Tidak dapat memuatkan semakan kertas.', // [PROPOSED]
  titleRequired: 'Tajuk diperlukan (paling banyak 200 aksara).', // [PROPOSED]
  sectionsEdit: 'Sunting bahagian', // V2
  sectionLabel: 'Label bahagian', // V2
  sectionInstruction: 'Arahan bahagian', // V2
  sectionCompulsory: 'Soalan ini mesti dijawab', // V2
  sectionRule: 'Peraturan menjawab', // V2 (read-only: set by the blueprint)
  sectionCount: 'Bilangan soalan dipilih', // V2 (read-only: set by the blueprint)
  sectionSaved: (l: string): string => `Bahagian '${l}' telah dikemas kini.`, // V2
  sectionSave: 'Kemas kini bahagian', // [PROPOSED]
  passagesEdit: 'Sunting petikan', // V2
  passageTitle: 'Tajuk petikan', // V2
  passageSaved: (l: string): string => `Petikan '${l}' telah dikemas kini.`, // [PROPOSED]
  passageSave: 'Kemas kini petikan', // [PROPOSED]
  passageShared: 'Tajuk ini dikongsi oleh semua kertas yang menggunakan kumpulan rangsangan ini.', // [PROPOSED] D90 deviation
  overrideTick: 'Terbitkan walaupun tidak memenuhi kontrak blueprint', // V2
  overrideReason: 'Sebab (sekurang-kurangnya 5 aksara)', // [PROPOSED]
  overriddenFlash: (n: number): string => `Diterbitkan dengan ${n} pengecualian kontrak (direkodkan).`, // [PROPOSED]
  addQuestion: 'Tambah soalan', // V2
  deleteQuestion: 'Padam soalan', // V2
  deleteConfirm: 'Soalan tambahan ini, termasuk bahagian, pilihan jawapan dan skemanya, akan dibuang dari kertas. Tindakan ini tidak boleh dibatalkan.', // V2
  questionAdded: 'Soalan ditambah ke kertas.', // [PROPOSED]
  questionDeleted: 'Soalan dipadam dari kertas.', // [PROPOSED]
  semak: 'Semak Kertas', // V2
  openBuilder: 'Buka di Set Builder', // [PROPOSED]
  contractNone: 'Tiada kontrak untuk subjek/kertas ini.', // V2
  metaYearAria: 'Tahun kertas', // [PROPOSED]
} as const

/** Option labels of the level filter. */
export const LEVEL_ITEMS = [
  { label: builderCopy.levelAll, value: '' },
  { label: builderCopy.levelT4, value: 't4' },
  { label: builderCopy.levelT5, value: 't5' },
  { label: builderCopy.levelT13, value: 't1_t3' },
] as const
