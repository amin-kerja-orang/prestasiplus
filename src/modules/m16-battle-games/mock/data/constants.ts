/**
 * Fixed lists of the M16 battle lobby (SRS M16 v1.6 §6.1, discovery Appendix A). The 15 PKSK domains
 * belong to M07, which is not built yet (its mock is the F-01 stub); M16 serves their names, icons and
 * colours from the discovery appendix A.2 until M07 offers a contract (Perlu pengesahan).
 */

export interface PkskDomainInfo {
  id: number
  name: string
  icon: string
  colour: string
}

export const PKSK_DOMAINS: readonly PkskDomainInfo[] = [
  { id: 1, name: 'Kecerdasan Insaniah', icon: 'fa-brain', colour: '#8b5cf6' },
  { id: 2, name: 'Matematik', icon: 'fa-calculator', colour: '#3b82f6' },
  { id: 3, name: 'Sains', icon: 'fa-flask', colour: '#10b981' },
  { id: 4, name: 'Bahasa Inggeris', icon: 'fa-language', colour: '#ef4444' },
  { id: 5, name: 'Sejarah Malaysia', icon: 'fa-landmark', colour: '#f59e0b' },
  { id: 6, name: 'Geografi', icon: 'fa-globe-asia', colour: '#06b6d4' },
  { id: 7, name: 'Kebudayaan Kaum', icon: 'fa-users', colour: '#ec4899' },
  { id: 8, name: 'Sukan & Pencapaian', icon: 'fa-futbol', colour: '#84cc16' },
  { id: 9, name: 'Mercu Tanda Malaysia', icon: 'fa-monument', colour: '#f97316' },
  { id: 10, name: 'Alam Sekitar', icon: 'fa-leaf', colour: '#22c55e' },
  { id: 11, name: 'Teknologi & IT', icon: 'fa-laptop-code', colour: '#6366f1' },
  { id: 12, name: 'Ekonomi Malaysia', icon: 'fa-chart-line', colour: '#14b8a6' },
  { id: 13, name: 'Inovasi & Pencipta', icon: 'fa-lightbulb', colour: '#eab308' },
  { id: 14, name: 'Isu Global', icon: 'fa-earth-asia', colour: '#0ea5e9' },
  { id: 15, name: 'Artikulasi Penulisan', icon: 'fa-pen-fancy', colour: '#a855f7' },
]

/** SPM Kertas 1 question counts by subject code (URS FN-M16-8.2.4; SOURCE). */
export const SPM_COUNTS: Readonly<Record<string, number>> = {
  BM: 25,
  BI: 40,
  MATH: 40,
  SCI: 40,
  SEJ: 40,
  PI: 40,
  PM: 40,
  ADDMATH: 20,
  PHY: 40,
  CHEM: 40,
  BIO: 40,
  GEO: 40,
  EKON: 40,
  PSV: 40,
  TI: 40,
}

/** Subjects of the S1 "Biasa" panel: ids 1-31 (M03). */
export const BATTLE_SUBJECT_IDS = Array.from({ length: 31 }, (_, i) => i + 1)

/** Simulation parameters (BR-M16-04, BR-M16-05; PROPOSED). */
export const QUEUE_EXPIRES_MS = 120_000
export const QUEUE_ABANDONED_MS = 10_000
export const MATCH_ON_POLL = 3
export const INCOMING_ON_POLL = 2
export const INVITATION_EXPIRES_MS = 24 * 3_600_000
