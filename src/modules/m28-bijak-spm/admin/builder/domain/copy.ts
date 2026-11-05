/**
 * BM copy of the Set Builder and Semak Kertas screens. Strings marked V2 are verbatim from the
 * V2 Panel / .cloud (docs/discovery/cloud-student-mechanism.md 3.4, docs/design/v2-admin-student-pipeline.md
 * S4.1 to S4.4). Strings marked [PROPOSED] have no V2 counterpart (the backend contract differs or the
 * design spec proposes them). The texts of card S3-T02 with no PRD source are the one constant `BIJAK_SET_BUILDER_PROPOSED` of the contract.
 */
import {
  BIJAK_BUILDER_MESSAGES as MSG,
  BIJAK_LEVEL_SCOPE_LABELS,
  BIJAK_LEVEL_SCOPES,
  BIJAK_SET_BUILDER_PROPOSED as PROPOSED,
} from '@pp/contract'

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
  blankSubjectPlaceholder: 'Subjek', // PRD30 13-02
  kertas: 'Kertas', // [PROPOSED] D83 D-6
  kertasPlaceholder: 'Pilih kertas', // [PROPOSED]
  blankCreated: 'Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula.', // V2
  generateTitle: 'Jana set', // V2
  generateSub: 'Ambil soalan secara rawak', // V2
  genTitleField: 'Tajuk set', // PRD30 13-04
  genTitlePlaceholder: 'cth: Latih Tubi Sejarah Mac', // PRD30 13-04
  defaultTitle: (subject: string, kertas: number): string => `Percubaan SPM ${subject} Kertas ${kertas} (draf)`, // the server's default
  titleRequiredSet: MSG.setTitleRequired, // PRD30 13-01
  subjectRequired: MSG.subjectRequired, // PRD30 13-02
  kertasInvalid: MSG.kertasInvalid, // PRD30 13-06
  countRange: MSG.countRange, // PRD30 13-07
  countAbove: PROPOSED.countAboveContract,
  scaledHint: PROPOSED.scaledHint,
  poolGroups: PROPOSED.poolGroups,
  tahunField: 'Tahun', // PRD30 14-01
  tahunAll: 'Tahun — semua jika tiada pilihan', // PRD30 13-08
  negeriField: 'Negeri', // PRD30 14-02
  negeriAll: 'Negeri — semua jika tiada pilihan', // PRD30 13-09
  negeriPicked: (n: number): string => `${n} pilihan`, // PRD30 14-02
  levelField: 'Dilihat murid', // FR-ADM-Q13.1
  contractButton: 'Kontrak Simulasi', // FR-ADM-Q13.4
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
  listTitle: 'Set sedia ada', // PRD30 Q-13
  listEmpty: 'Tiada set lagi.', // PRD30 Q-13
  listLine: (subject: string, kertas: number, questions: number, marks: number): string => `${subject} · Kertas ${kertas} · ${questions} soalan · ${marks} markah`, // V2 + D83 D-6
  moreOrigins: (n: number): string => `+${n} lagi`, // V2 (Q-13)
  deleteSet: 'Padam', // PRD30 Q-13
  deleteSetTitle: 'Padam set ini?', // PRD30 Q-13
  deleteSetBody: 'Set draf akan dipadam. Tindakan ini tidak boleh dibatalkan.', // PRD30 Q-13
  deleteSetOk: 'Ya, Padam', // PRD30 Q-13
  deleteTerbit: MSG.deleteTerbitSet, // PRD30 Q-13
  open: 'Buka', // [PROPOSED]
  copy: 'Salin set', // V2
  loadError: 'Tidak dapat memuatkan senarai set.', // [PROPOSED]

  // Builder (S4.2)
  back: 'Kembali', // V2 "← Kembali"
  totalMarks: (n: number): string => `Jumlah markah keseluruhan: ${n} markah`, // V2
  publish: 'Terbitkan', // V2
  publishing: 'Menerbitkan…', // V2
  renamed: (t: string): string => `Set '${t}' telah dinamakan semula.`, // V2
  titleAria: 'Tajuk set', // V2
  bank: 'Bank Soalan', // V2
  search: 'Cari soalan…', // V2 (P4: admin.md A18, scope R1-21.6)
  destination: 'Bahagian destinasi', // V2
  levelAll: 'Semua tingkatan', // [PROPOSED]
  levelT4: 'Tingkatan 4', // [PROPOSED]
  levelT5: 'Tingkatan 5', // [PROPOSED]
  levelT13: 'Tingkatan 1-3', // [PROPOSED]
  unitAll: 'Semua unit', // [PROPOSED]
  add: 'Tambah', // V2
  remove: 'Buang', // V2
  inSet: 'Dalam set', // V2 (Panel)
  noMatch: 'Tiada soalan sepadan.', // V2
  fill: (n: number, total: number): string => `${n} / ${total} dipilih`, // V2
  sectionEmpty: "Tiada soalan dalam bahagian ini. Gunakan butang 'Tambah' pada senarai bank.", // [PROPOSED] (V2 says "Lepaskan soalan di sini", no drag here)
  upAria: (n: number): string => `Naik soalan ${n}`, // PRD30 14-08
  downAria: (n: number): string => `Turun soalan ${n}`, // PRD30 14-08
  groupCard: (label: string, n: number): string => `${label.trim() || 'Kumpulan rangsangan'} · ${n} soalan`, // FR-ADM-Q14.3 ("Rajah 3 · 4 soalan")
  bankCount: (total: number, shown: number): string => `${total} soalan (dipaparkan ${shown} pertama)`, // PRD30 14-03
  questionsChip: (n: number, need: number): string => `Soalan ${n} / ${need}`, // ported from Semak Kertas
  marksChip: (n: number, budget: number): string => `Markah ${n} / ${budget}`, // ported from Semak Kertas
  budgetOk: 'Sepadan dengan blueprint', // ported from Semak Kertas
  budgetIssues: (n: number): string => `Belum sepadan dengan blueprint (${n} perkara)`, // ported from Semak Kertas
  writeQuestion: 'Tulis soalan baharu', // ported from Semak Kertas
  viewInBijak: 'Lihat di Bijak SPM', // ported from Semak Kertas
  ruleAll: 'Jawab Semua', // OPT-PERATURAN
  ruleChoose: 'Pilih N', // OPT-PERATURAN
  ruleNInvalid: MSG.chooseNRange, // PRD30 14-05
  compulsoryChip: 'Wajib dijawab', // 45 section 5.3
  editInBuilder: 'Sunting di Set Builder', // card S3-T02
  importQueue: 'Buka Import & Semakan', // PO decision 2026-11-05 item 9
  terbitFromPreview: PROPOSED.terbitFromPreview,
  groupBadge: (label: string, n: number): string =>
    `Kumpulan rangsangan${label.trim() ? ` ${label.trim()}` : ''} · ${n} soalan bergerak bersama`, // existing editor copy
  contractTitle: 'Kontrak Simulasi', // V2
  editContract: 'Sunting kontrak', // V2
  published_ok: 'Set ini telah diterbitkan.', // V2
  publishRefused: 'Set ini tidak lulus pengesahan.', // PRD30 Q-14
  errPublishNetwork: 'Ralat rangkaian semasa menerbitkan.', // PRD30 Q-14
  fixFirst: (n: number): string => `Betulkan ${n} masalah dahulu`, // AC-ADM-Q15.1
  visibleDraft: 'Belum boleh dibuka murid — set ini masih draf.', // V2 design [PROPOSED]
  visibleLive: 'Murid boleh membuka set ini di: Simulasi, Simulasi — Kuiz, Tracking A (jika ditanda).', // V2 design [PROPOSED]
  paneBank: 'Bank Soalan', // V2
  paneSet: 'Set', // V2
  paneNav: 'Paparan pembina', // [PROPOSED]
  poolMore: 'Muat lagi', // [PROPOSED]
  // error toasts (V2 verbatim, used when the server sent no BM line)
  errAdd: 'Soalan gagal ditambah — cuba lagi.', // V2
  errOrder: 'Susunan gagal disimpan — muat semula halaman dan cuba lagi.', // V2
  errRemove: 'Soalan gagal dibuang — cuba lagi.', // V2
  errPool: 'Ralat semasa mencari bank soalan.', // V2
  retry: 'Cuba lagi', // existing picker copy
  errPublish: 'Ralat tidak dijangka semasa menerbitkan.', // V2
  errRename: 'Bahagian gagal dikemas kini.', // V2 (Sunting bahagian)
  errMeta: 'Kertas gagal dikemas kini.', // [PROPOSED] (Kemas kini metadata)
  errPassage: 'Petikan gagal dikemas kini.', // [PROPOSED] (Sunting petikan)
  errReference: 'Bahan rujukan gagal dikemas kini.', // [PROPOSED]
  titleInvalid: 'Tajuk diperlukan (paling banyak 200 aksara).', // [PROPOSED] contract title 1..200
  errLoad: 'Tidak dapat memuatkan set ini.', // [PROPOSED]
  errGenerate: 'Set tidak dapat dijana. Sila cuba lagi.', // [PROPOSED]
  errGenerateShortage: 'Kertas tidak dapat dijana kerana soalan tidak mencukupi.', // existing K3 copy

  // Semak Kertas (S4.4)
  meta: 'Kemas kini metadata', // V2
  fTitle: 'Tajuk', // V2
  fYear: 'Tahun', // [PROPOSED] (contract field)
  fDuration: 'Tempoh (minit)', // V2
  fCode: 'Kod kertas (kulit)', // V2
  fCodeHint: (subject: string): string => `Dipapar di kulit kertas (cth. 1449/1). Kosong = kod subjek “${subject}”.`, // PRD30 15-03
  fInstructions: 'Arahan kulit kertas', // V2
  fInstructionsHint: 'Satu baris = satu arahan bernombor. Kosongkan untuk tiada arahan.', // PRD30 15-04
  metaSave: 'Simpan', // V2 (R1)
  metaSaved: (t: string): string => `Kertas '${t}' telah dikemas kini.`, // V2
  review: 'Semakan kertas', // [PROPOSED]
  blockers: 'Belum boleh diterbitkan', // V2 ("Belum boleh diterbitkan" blockers)
  notes: 'Nota (tidak menghalang penerbitan)', // [PROPOSED]
  blueprintNeedsReview: 'Blueprint perlu semakan', // contract copy
  reviewOk: 'Tiada masalah menghalang penerbitan.', // [PROPOSED]
  publishCheckFailed: 'Terbitkan dinyahaktifkan: semakan kertas tidak dapat dijalankan. Muat semula dan cuba lagi.', // [PROPOSED]
  publishDisabledWhy: (n: number): string => `Terbitkan dinyahaktifkan: ${n} masalah perlu dibetulkan.`, // [PROPOSED]
  notPublishable: (n: number): string => `Kertas ini belum boleh diterbitkan — ${n} masalah perlu dibetulkan.`, // V2
  publishedFlash: (t: string): string => `Kertas '${t}' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi.`, // V2
  withdraw: 'Tarik balik ke draf', // PRD30 Q-14, Q-15 (defect 7; Semak Kertas keeps its `Sembunyikan`)
  hide: 'Sembunyikan', // PRD30 Q-15: the withdraw control of Semak Kertas (defect 8)
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
  sectionFull: 'Bahagian ini sudah penuh.', // [PROPOSED]
  reviewStale: 'Simpan draf untuk menyegarkan semakan.', // [PROPOSED]
  reviewError: 'Tidak dapat memuatkan semakan kertas.', // [PROPOSED]
  titleRequired: 'Tajuk diperlukan (paling banyak 200 aksara).', // [PROPOSED]
  sectionsEdit: 'Sunting bahagian', // V2
  sectionLabel: 'Label bahagian', // V2
  sectionInstruction: 'Arahan bahagian', // V2
  sectionCompulsory: 'Wajib dijawab', // PRD30 15-13
  sectionRule: 'Peraturan menjawab', // V2 (read-only: set by the blueprint)
  sectionCount: 'Bilangan soalan dipilih', // V2 (read-only: set by the blueprint)
  sectionSaved: (l: string): string => `Bahagian '${l}' telah dikemas kini.`, // V2
  sectionSave: 'Simpan bahagian', // V2 (R2)
  passagesEdit: 'Sunting petikan', // V2
  passageTitle: 'Tajuk petikan', // V2
  passageSaved: (l: string): string => `Petikan '${l}' telah dikemas kini.`, // [PROPOSED]
  passageSave: 'Simpan petikan', // V2 (R3)
  passageShared: 'Tajuk ini dikongsi oleh semua kertas yang menggunakan kumpulan rangsangan ini.', // [PROPOSED] D90 deviation
  overrideTick: 'Terbitkan walaupun tidak memenuhi kontrak Simulasi', // V2 Panel / design S4.4 (Blade: "kontrak blueprint")
  overrideGone: 'Pengecualian tidak lagi tersedia selepas menyimpan. Semak masalah yang tinggal.', // [PROPOSED]
  overrideReason: 'Sebab', // PRD30 14-07
  overrideReasonRequired: MSG.overrideReasonRequired, // PRD30 14-07
  overriddenFlash: (n: number): string => `Diterbitkan dengan ${n} pengecualian kontrak (direkodkan).`, // [PROPOSED]
  contractLine: (subject: string, kertas: number, source: string): string => `${subject} Kertas ${kertas} · ${source}`, // [PROPOSED]
  pinned: 'Disematkan', // V2 chip (P5): the question version pinned at Terbit
  pinnedTip: 'Versi soalan ini dibekukan untuk kertas ini.', // FR-ADM-Q14.7
  poolCap: 'Menunjukkan 150 teratas — tapis lagi untuk menyempitkan.', // V2 (P4)
  copyForEdit: 'Salin untuk sunting', // V2 live banner button (R6)
  withdrawConfirm: 'Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya.', // V2 (AC-07.7)
  withdrawConfirmLabel: 'Tarik balik',
  publishConfirm: 'Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi.', // V2 native paper (R8)
  refTitle: 'Bahan rujukan (kulit kertas)', // V2 (R4)
  refAddPanel: 'Tambah panel', // V2
  refAddImage: 'Tambah gambar', // V2
  refAddText: 'Tambah teks / rumus', // V2
  refPanelTitle: 'Tajuk panel', // V2
  refRemovePanel: 'Buang panel', // V2
  refSave: 'Simpan bahan rujukan', // V2
  refSaved: 'Bahan rujukan kertas telah dikemas kini.', // V2
  refLine: 'Teks / rumus', // [PROPOSED]
  refUploadFailed: 'Gambar gagal dimuat naik.', // existing upload copy
  refImageAttached: 'Gambar dilampirkan', // [PROPOSED]
  refRemoveImage: 'Buang gambar', // [PROPOSED]
  listTitleCol: 'Tajuk', // V2 (R12)
  listStatusCol: 'Status', // V2
  listAttentionCol: 'Perhatian', // V2
  listActionsCol: 'Tindakan', // V2
  preview: 'Pratonton (baca sahaja)', // V2 (H5)
  edit: 'Sunting', // V2 (H5)
  attnEmpty: 'Kertas ini tiada soalan — tidak boleh diterbitkan.', // V2 design P-COMP-EMPTY
  attnIncomplete: 'set tidak lengkap', // V2 attention label
  semak: 'Semak Kertas', // V2
  contractNone: 'Tiada kontrak untuk subjek/kertas ini.', // V2
  metaYearAria: 'Tahun kertas', // [PROPOSED]
} as const

/** Options of `Dilihat murid` (FR-ADM-Q13.1). */
export const LEVEL_SCOPE_ITEMS = BIJAK_LEVEL_SCOPES.map((value) => ({ label: BIJAK_LEVEL_SCOPE_LABELS[value], value }))

/** The `Dilihat murid` text of a paper; a paper with no stored scope is not restricted. */
export const levelScopeLabel = (scope: keyof typeof BIJAK_LEVEL_SCOPE_LABELS | null | undefined): string =>
  scope ? BIJAK_LEVEL_SCOPE_LABELS[scope] : builderCopy.levelAll

/** Option labels of the level filter. */
export const LEVEL_ITEMS = [
  { label: builderCopy.levelAll, value: '' },
  { label: builderCopy.levelT4, value: 't4' },
  { label: builderCopy.levelT5, value: 't5' },
  { label: builderCopy.levelT13, value: 't1_t3' },
] as const
