/**
 * Fictitious name parts for the BE-07 population seed. Obviously synthetic: every display name is
 * `<Role label> Contoh <Word>`, where the word is a Greek letter or a colour (never a person name).
 * No real person, IC or phone data. Do not add personal names here.
 */

export const NAME_WORDS: readonly string[] = [
  'Alfa', 'Beta', 'Gama', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Teta', 'Iota', 'Kapa', 'Lambda', 'Mu',
  'Nu', 'Xi', 'Omikron', 'Pi', 'Rho', 'Sigma', 'Tau', 'Upsilon', 'Fi', 'Khi', 'Psi', 'Omega',
  'Merah', 'Jingga', 'Kuning', 'Hijau', 'Biru', 'Ungu', 'Kelabu', 'Putih', 'Hitam', 'Coklat', 'Perak',
  'Emas', 'Nila', 'Hijau Muda', 'Biru Muda', 'Merah Jambu',
]

export const ROLE_LABELS = {
  student: 'Murid',
  teacher: 'Guru',
  school_admin: 'Admin Sekolah',
} as const

/** Class names (the mock uses the same style: `4 Amanah`). */
export const CLASS_NAMES: readonly string[] = ['Amanah', 'Bestari', 'Cekap', 'Dedikasi']

/** Every generated display name of this card must match this pattern (a test enforces it). */
export const FICTITIOUS_NAME_PATTERN = /^(Murid|Guru|Admin Sekolah) Contoh [A-Z][a-z]+(?: [A-Z][a-z]+)?$/
