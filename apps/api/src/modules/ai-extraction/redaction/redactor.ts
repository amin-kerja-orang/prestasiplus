import { AI_REDACTION_FLAGS, type AiRedactionFlag, type AiRedactionSummary } from '@pp/contract'

/**
 * The redaction step (NFR-04, AC-04.8, BE-NFR-33). It runs on EVERY text that leaves the process, before any provider
 * call: page text of an extraction, the question stems of a tag suggestion, and both the system and the user text of
 * `generateText`. Names, school names, e-mail addresses, phone numbers, IC numbers, addresses and student identifiers on
 * paper covers are replaced by a fixed token. The masked text is never stored, logged or returned: only counts per flag.
 *
 * This is pattern based and therefore a best effort on free text; the structural guarantee is elsewhere: request types are
 * strict objects (no user, student or school id can ride along) and the call context is never forwarded.
 */
export const MASK = {
  person_name: '[NAMA]',
  school_name: '[SEKOLAH]',
  phone: '[TELEFON]',
  email: '[E-MEL]',
  ic_number: '[NO_KP]',
  address: '[ALAMAT]',
} as const satisfies Record<AiRedactionFlag, string>

const NAME_PART = String.raw`[A-ZÀ-Ý][\p{L}'’.-]*`
const NAME_SEQ = String.raw`${NAME_PART}(?:[ \t]+(?:(?:bin|binti|bt\.?|b\.|a\/l|a\/p|anak|ibni)[ \t]+)?${NAME_PART}){0,5}`

/** Labelled lines: `Nama: ...`. The value (rest of the line) is masked; the label stays so the page still reads. */
const LABELS: { flag: AiRedactionFlag; label: string }[] = [
  {
    flag: 'person_name',
    label:
      String.raw`nama(?:\s+(?:penuh|calon|pelajar|murid|guru|pengetua|penyedia|penyemak|pengawas))?|name|calon|pelajar|murid|guru(?:\s+(?:besar|kelas|mata\s+pelajaran|subjek))?|pengetua|disediakan\s+oleh|disemak\s+oleh|dibina\s+oleh|disahkan\s+oleh|penggubal|penyemak|prepared\s+by|checked\s+by|student(?:\s+name)?|teacher|candidate(?:\s+name)?|setter`,
  },
  { flag: 'school_name', label: String.raw`nama\s+sekolah|sekolah|school|institusi|kolej|kelas|class` },
  { flag: 'ic_number', label: String.raw`no\.?\s*(?:kp|k\/p|ic|kad\s+pengenalan|matrik|pendaftaran|murid|pelajar|pekerja)|angka\s+giliran|nombor\s+(?:kad\s+pengenalan|matrik)|id\s+(?:pelajar|murid|delima)` },
  { flag: 'phone', label: String.raw`no\.?\s*(?:telefon|tel|hp|bimbit)|telefon|tel|hp|handphone|mobile|phone` },
  { flag: 'email', label: String.raw`emel|e-mel|email|e-mail` },
  { flag: 'address', label: String.raw`alamat(?:\s+(?:rumah|sekolah|surat-menyurat))?|address` },
]

const LABEL_RULES = LABELS.map((l) => ({ flag: l.flag, re: new RegExp(String.raw`^([ \t]*(?:${l.label})[ \t]*[:：][ \t]*)(\S.*)$`, 'gimu') }))

const SCHOOL_PREFIX = String.raw`(?:SMK|SMJK|SJK|SK|SBP|SMT|SMA|SMKA|SMKP|SMV|KV|MRSM|SAM|SABK|SRA|SRK|SRJK|SMS|SMSA|SSM)`
const SCHOOL_RULES: RegExp[] = [
  new RegExp(String.raw`\b${SCHOOL_PREFIX}\b\.?[ \t]*(?:\([A-Za-z]\)[ \t]*)?${NAME_PART}(?:[ \t]+${NAME_PART}){0,4}`, 'gu'),
  new RegExp(
    String.raw`\bSekolah[ \t]+(?:Menengah|Rendah|Kebangsaan|Jenis[ \t]+Kebangsaan|Agama|Berasrama[ \t]+Penuh|Sains|Tinggi|Vokasional|Teknik|Swasta)(?:[ \t]+(?:Menengah|Kebangsaan|Jenis[ \t]+Kebangsaan|Agama|Sains|Swasta|Cina|Tamil|Teknik|Vokasional|Rendah))*(?:[ \t]*\([A-Za-z]\))?(?:[ \t]+${NAME_PART}){1,5}`,
    'gu',
  ),
  new RegExp(String.raw`\b(?:Maktab[ \t]+Rendah[ \t]+Sains[ \t]+MARA|Kolej[ \t]+(?:Vokasional|Matrikulasi|Tingkatan[ \t]+Enam))(?:[ \t]+${NAME_PART}){1,4}`, 'gu'),
  new RegExp(String.raw`\b(?:${NAME_PART}[ \t]+){1,4}(?:Secondary|High|Primary|National)[ \t]+School\b`, 'gu'),
  // Cover pages print the school in capitals: "SEKOLAH MENENGAH KEBANGSAAN TAMAN CONTOH".
  new RegExp(String.raw`\b(?:SEKOLAH|MAKTAB|KOLEJ)[ \t]+[A-ZÀ-Ý][A-ZÀ-Ý'’.()-]*(?:[ \t]+[A-ZÀ-Ý][A-ZÀ-Ý'’.()-]*){1,8}`, 'gu'),
]

const NAME_RULES: RegExp[] = [
  // Honorific + name: "Encik Ali", "Puan Siti Aminah", "Dato' Seri ...", "Cikgu ...".
  new RegExp(
    String.raw`\b(?:Encik|En\.|Puan|Pn\.|Cik|Dr\.?|Prof\.?|Datuk|Dato['’]?|Datin|Tan[ \t]+Sri|Puan[ \t]+Sri|Tuan|Haji|Hajah|Hj\.|Hjh\.|Cikgu|Ustaz|Ustazah|Mr\.?|Mrs\.?|Ms\.?|Miss)[ \t]+${NAME_SEQ}`,
    'gu',
  ),
  // Patronymic names: "Ahmad bin Ali", "Siti binti Hassan", "Kumar a/l Raju".
  new RegExp(String.raw`\b${NAME_PART}(?:[ \t]+${NAME_PART}){0,2}[ \t]+(?:bin|binti|bt\.?|b\.|a\/l|a\/p|anak|ibni)[ \t]+${NAME_PART}(?:[ \t]+${NAME_PART}){0,3}`, 'gu'),
]

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu
const IC = /(?<!\d)\d{6}[- ]?\d{2}[- ]?\d{4}(?!\d)/g
const PHONE_MY = /(?<![\w.])(?:\+?60[ -]?|0)(?:1\d|[3-9])[ -]?\d{3,4}[ -]?\d{4}(?![\w])/g
const PHONE_INTL = /(?<![\w.])\+\d{1,3}[ -]?\d[\d -]{6,12}\d(?![\w])/g
const STREET = new RegExp(
  String.raw`\b(?:No\.?[ \t]*\d+[A-Za-z]?,?[ \t]*)?(?:Jalan|Jln\.?|Lorong|Lrg\.?|Taman|Kampung|Kg\.?|Persiaran|Lebuh|Lebuhraya|Bandar)[ \t]+[\p{L}\p{N}'’./-]+(?:[ \t]+[\p{L}\p{N}'’./-]+){0,6}(?:,[ \t]*\d{5}[ \t]+${NAME_PART}(?:[ \t]+${NAME_PART}){0,2})?`,
  'gu',
)
const POSTCODE_CITY = new RegExp(String.raw`(?<!\d)\d{5}[ \t]+${NAME_PART}(?:[ \t]+${NAME_PART}){0,2}(?:,[ \t]*${NAME_PART}(?:[ \t]+${NAME_PART}){0,2})?`, 'gu')

/** Counts of what was masked, per flag. Never the text. */
export class Redactor {
  private readonly counts: Record<AiRedactionFlag, number> = { person_name: 0, school_name: 0, phone: 0, email: 0, ic_number: 0, address: 0 }

  /** Masks `input` and counts what was masked. The same instance can redact several texts of one request. */
  redact(input: string): string {
    let text = input
    const sub = (re: RegExp, flag: AiRedactionFlag): void => {
      text = text.replace(re, () => {
        this.counts[flag] += 1
        return MASK[flag]
      })
    }
    // Contact details first: they are unambiguous and must not be split by the broader rules below.
    sub(EMAIL, 'email')
    sub(IC, 'ic_number')
    sub(PHONE_MY, 'phone')
    sub(PHONE_INTL, 'phone')
    // Labelled lines keep the label and mask the value (one count per line).
    for (const { flag, re } of LABEL_RULES) {
      text = text.replace(re, (_m, label: string, value: string) => {
        if (isAlreadyMasked(value)) return `${label}${value}`
        this.counts[flag] += 1
        return `${label}${MASK[flag]}`
      })
    }
    for (const re of SCHOOL_RULES) sub(re, 'school_name')
    for (const re of NAME_RULES) sub(re, 'person_name')
    sub(STREET, 'address')
    sub(POSTCODE_CITY, 'address')
    return text
  }

  summary(): AiRedactionSummary {
    return {
      applied: true,
      masked: AI_REDACTION_FLAGS.filter((flag) => this.counts[flag] > 0).map((flag) => ({ flag, count: this.counts[flag] })),
    }
  }
}

/** True when nothing but mask tokens and their separators is left (so the line is not masked, or counted, twice). */
const isAlreadyMasked = (value: string): boolean => value.replace(/\[[A-Z_-]+\]/g, '').replace(/\b(?:dan|atau|and|or)\b|[\s,;/&+.-]/gi, '') === ''
