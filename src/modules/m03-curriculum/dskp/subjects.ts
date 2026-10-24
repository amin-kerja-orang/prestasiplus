import type {
  DskpLanguage,
  DskpRtlField,
  DskpSubjectCode,
  DskpSubjectKind,
  DskpTpLevel,
} from './types.ts'

/**
 * Subject configuration of the 13 DSKP subjects (design section 2.1 and 2.5). The static facts
 * here are not in the extracts (nouns, language, TP level, link to M03's own subject code). The
 * generator combines them with counts and editions into the eager `data/index.json`.
 */

export interface DskpSubjectConfig {
  code: DskpSubjectCode
  /** File name of the extract (`docs/reference/dskp/<slug>.json`) and of the data file. */
  slug: string
  /** Display name; the extract's `subject` must start with it. */
  name: string
  language: DskpLanguage
  kind: DskpSubjectKind
  /** Noun of the grouping above the unit, when the DSKP prints a real one. */
  groupNoun?: string
  /** What the subject calls its unit. */
  unitNoun: string
  /** Where the DSKP prints the TP table. */
  tpLevel: DskpTpLevel
  rtlFields: readonly DskpRtlField[]
  /** M03's own subject code (`curriculum.json`), or null when M03 has no such subject. */
  m03SubjectCode: string | null
}

export const DSKP_SUBJECTS: readonly DskpSubjectConfig[] = [
  {
    code: 'MAT',
    slug: 'matematik',
    name: 'Matematik',
    language: 'ms',
    kind: 'academic',
    groupNoun: 'Bidang',
    unitNoun: 'Tajuk',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'MATH',
  },
  {
    code: 'MTM',
    slug: 'matematik-tambahan',
    name: 'Matematik Tambahan',
    language: 'en',
    kind: 'academic',
    groupNoun: 'Learning Area',
    unitNoun: 'Topic',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'ADDMATH',
  },
  {
    code: 'FIZ',
    slug: 'fizik',
    name: 'Fizik',
    language: 'en',
    kind: 'academic',
    groupNoun: 'Theme',
    unitNoun: 'Learning Area',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'PHY',
  },
  {
    code: 'SN',
    slug: 'sains',
    name: 'Sains',
    language: 'en',
    kind: 'academic',
    groupNoun: 'Theme',
    unitNoun: 'Learning Area',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'SCI',
  },
  {
    code: 'BM',
    slug: 'bahasa-melayu',
    name: 'Bahasa Melayu',
    language: 'ms',
    kind: 'academic',
    unitNoun: 'Kemahiran',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'BM',
  },
  {
    code: 'BI',
    slug: 'bahasa-inggeris',
    name: 'Bahasa Inggeris',
    language: 'en',
    kind: 'academic',
    unitNoun: 'Skill',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'BI',
  },
  {
    code: 'SEJ',
    slug: 'sejarah',
    name: 'Sejarah',
    language: 'ms',
    kind: 'academic',
    groupNoun: 'Tema',
    unitNoun: 'Tajuk',
    tpLevel: 'sk',
    rtlFields: [],
    m03SubjectCode: 'SEJ',
  },
  {
    code: 'PI',
    slug: 'pendidikan-islam',
    name: 'Pendidikan Islam',
    language: 'ms-Arab',
    kind: 'academic',
    unitNoun: 'Bidang',
    tpLevel: 'sk',
    rtlFields: ['sk', 'sp', 'tp'],
    m03SubjectCode: 'PI',
  },
  {
    code: 'TI',
    slug: 'tasawwur-islam',
    name: 'Tasawwur Islam',
    language: 'ms',
    kind: 'academic',
    unitNoun: 'Tema',
    tpLevel: 'sk',
    rtlFields: [],
    m03SubjectCode: 'TI',
  },
  {
    code: 'PM',
    slug: 'pendidikan-moral',
    name: 'Pendidikan Moral',
    language: 'ms',
    kind: 'academic',
    groupNoun: 'Bidang',
    unitNoun: 'Standard Kandungan',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'PM',
  },
  {
    code: 'PSV',
    slug: 'pendidikan-seni-visual',
    name: 'Pendidikan Seni Visual',
    language: 'ms',
    kind: 'academic',
    groupNoun: 'Bidang',
    unitNoun: 'Tajuk',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: 'PSV',
  },
  {
    code: 'LNS',
    slug: 'landskap-dan-nurseri',
    name: 'Landskap dan Nurseri',
    language: 'ms',
    kind: 'vocational',
    unitNoun: 'Modul',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: null,
  },
  {
    code: 'KPJ',
    slug: 'katering-dan-penyajian',
    name: 'Katering dan Penyajian',
    language: 'ms',
    kind: 'vocational',
    unitNoun: 'Modul',
    tpLevel: 'unit',
    rtlFields: [],
    m03SubjectCode: null,
  },
]
