/**
 * Release 1.0 scope filter for the user-portal menu.
 *
 * The menu definitions in `user-nav.ts` copy the FULL live menu (fidelity). Several live items
 * belong to modules that are not built yet, so their hrefs resolve to the 404 page. Those items
 * are kept as data (nothing is deleted from `USER_NAV`) but are NOT rendered: `navFor` removes
 * every item whose `to` is listed here (and every group child), unless the caller passes
 * `{ includeOutOfScope: true }`.
 *
 * To bring an item back when its module is built: delete its row here (no other change needed).
 * Human-readable status: `docs/SCOPE-STATUS.md`.
 */

export interface OutOfScopeRoute {
  /** App path of the nav item (exact match against `NavItem.to`). */
  to: string
  /** Owning module that must be built before the item can return. */
  module: string
  /** Why the item is hidden. */
  reason: string
}

const DUTA = { module: 'M24 Duta', reason: 'belum dibina' } as const
const PUSAT_AI = { module: 'M25 Pusat AI', reason: 'belum dibina (hanya Heatmap Topik Lemah dalam skop)' } as const
const M26 = { module: 'M26 Visi & Ciri Khas', reason: 'belum dibina' } as const
const GURU_TOOLS = {
  module: 'Portal Guru (lanjutan)',
  reason: 'bukan baris matriks 1.0; skrin belum dibina',
} as const
const SCHOOL_ADMIN_TOOLS = {
  module: 'M27 Admin Sekolah (lanjutan)',
  reason: 'bukan baris L51-L58; skrin belum dibina',
} as const

export const OUT_OF_SCOPE_ROUTES: readonly OutOfScopeRoute[] = [
  // ── Duta (M24)
  { to: '/bilik-duta', ...DUTA },
  { to: '/akademi-duta', ...DUTA },
  { to: '/bilik-duta/kem', ...DUTA },

  // ── Cita-Cita / Visi & Ciri Khas (M26)
  { to: '/cita-cita', ...M26 },
  { to: '/cita-cita/universiti', ...M26 },
  { to: '/cita-cita/biasiswa', ...M26 },
  { to: '/profil-cerah', ...M26 },
  { to: '/psikometrik', ...M26 },
  { to: '/pusat-kerjaya', ...M26 },
  { to: '/pusat-ilmu-sekolah', ...M26 },
  { to: '/cikgu-suara', ...M26 },
  { to: '/pembetulan', ...M26 },
  { to: '/penguasaan', ...M26 },
  { to: '/streak', ...M26 },
  { to: '/kombo', ...M26 },
  { to: '/liga', ...M26 },
  { to: '/perutusan', ...M26 },
  { to: '/wellbeing/alerts', module: 'M26 Wellbeing', reason: 'belum dibina' },

  // ── Pusat AI (M25) selain Heatmap Topik Lemah
  { to: '/pusat-nota-ringkas', ...PUSAT_AI },
  { to: '/buku-nota-saya', ...PUSAT_AI },
  { to: '/pusat-ai/mood', ...PUSAT_AI },
  { to: '/pusat-ai/kamus', ...PUSAT_AI },
  { to: '/pusat-ai/pendamping', ...PUSAT_AI },
  { to: '/pusat-ai/doa', ...PUSAT_AI },
  { to: '/pusat-ai/aktiviti', ...PUSAT_AI },
  { to: '/pusat-ai/whiteboard', ...PUSAT_AI },

  // ── Finance / Billing (M19)
  { to: '/billing/invoices', module: 'M19 Kewangan & Langganan', reason: 'belum dibina' },

  // ── Portal Guru, bukan baris matriks 1.0
  { to: '/amaran', module: 'M27 Amaran Awal (Guru)', reason: 'Amaran Awal hanya baris Admin Sekolah (L54, /amaran/sekolah)' },
  { to: '/guru/misi-harian', ...GURU_TOOLS },
  { to: '/guru/verify-soalan-struktur', ...GURU_TOOLS },
  { to: '/guru/verify-soalan-mcq', ...GURU_TOOLS },
  { to: '/guru/kehadiran-digital', ...GURU_TOOLS },
  { to: '/guru/jadual-belajar', ...GURU_TOOLS },
  { to: '/guru/broadcast', ...GURU_TOOLS },
  { to: '/guru/live-kelas', ...GURU_TOOLS },
  { to: '/guru/perbandingan-kelas', module: 'M11 Analitik Guru (S7)', reason: 'M11-T4 belum dibina; bukan baris 1.0' },
  { to: '/guru/soalan-guru', ...GURU_TOOLS },
  { to: '/guru/soalan-berstruktur', ...GURU_TOOLS },
  { to: '/guru/databank', ...GURU_TOOLS },
  { to: '/guru/set-soalan', ...GURU_TOOLS },
  { to: '/guru/kertas-peperiksaan', ...GURU_TOOLS },
  { to: '/guru/penjana-peperiksaan', ...GURU_TOOLS },
  { to: '/guru/gamifikasi', ...GURU_TOOLS },
  { to: '/guru/artikel', ...GURU_TOOLS },

  // ── Admin Sekolah, bukan baris L51-L58
  { to: '/admin-sekolah/pengguna', ...SCHOOL_ADMIN_TOOLS },
  { to: '/admin-sekolah/import-pelajar', ...SCHOOL_ADMIN_TOOLS },
  { to: '/admin-sekolah/aktiviti-guru', ...SCHOOL_ADMIN_TOOLS },
  { to: '/admin-sekolah/langganan', module: 'M19 Kewangan & Langganan', reason: 'belum dibina' },
  { to: '/admin-sekolah/invois', module: 'M19 Kewangan & Langganan', reason: 'belum dibina' },
  { to: '/admin/audit-log', module: 'M25 Pusat AI (Kawalan Kualiti)', reason: 'belum dibina' },
]

const HIDDEN_PATHS: ReadonlySet<string> = new Set(OUT_OF_SCOPE_ROUTES.map((r) => r.to))

/** Whether a nav item with this `to` is outside Release 1.0 scope (hidden from the rendered menu). */
export function isOutOfScope(to: string): boolean {
  return HIDDEN_PATHS.has(to)
}
