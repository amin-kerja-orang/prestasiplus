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

const NAME_PART = String.raw`[A-ZÀ-Ý][\p{L}'’.-]{0,40}`
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

/** Bullets and indentation before a label ("  - Nama: ..."). */
const LEAD = String.raw`[ \t]*(?:[-*•·▪‣◦>–—]+[ \t]*)*`
/** With a colon the value is on the same line or, when that is empty, on the next one. */
const LABEL_RULES = LABELS.map((l) => ({
  flag: l.flag,
  re: new RegExp(String.raw`^(${LEAD}(?:\d{1,2}[.)][ \t]+)?(?:${l.label})[ \t]*[:：][ \t]*(?:\r?\n[ \t]*)?)(\S.*)$`, 'gimu'),
}))

/**
 * The same labels in the middle of a line ("Soalan 1. Nama: Ali bin Abu, Kelas: 5A"). A colon is required, the label must
 * not be the tail of a longer word, and the value ends at a comma, semicolon, bar or the end of the line.
 */
const INLINE_RULES = LABELS.map((l) => ({
  flag: l.flag,
  re: new RegExp(String.raw`((?<![\p{L}\p{N}])(?:${l.label})[ \t]*[:：][ \t]*)([^\n,;|]*[^\s,;|])`, 'giu'),
}))

/**
 * Labels that are unambiguous enough to be masked without a colon ("Nama Ahmad bin Ali", "No KP 900101145678"). Words that
 * are also ordinary question vocabulary (guru, murid, kelas, class, name, emel ...; an e-mail address is masked by its own pattern anyway) need the colon.
 */
const COLONLESS: { flag: AiRedactionFlag; label: string }[] = [
  { flag: 'person_name', label: String.raw`nama(?:\s+(?:penuh|calon|pelajar|murid|guru|pengetua))?` },
  { flag: 'ic_number', label: String.raw`no\.?\s*(?:kp|k\/p|ic|kad\s+pengenalan)|angka\s+giliran` },
  { flag: 'address', label: String.raw`alamat(?:\s+(?:rumah|sekolah|surat-menyurat))?` },
]
const COLONLESS_RULES = COLONLESS.map((l) => ({ flag: l.flag, re: new RegExp(String.raw`^(${LEAD}(?:${l.label})[ \t]+)(\S.*)$`, 'gimu') }))

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
  new RegExp(String.raw`\b(?:SEKOLAH|MAKTAB|KOLEJ)[ \t]+[A-ZÀ-Ý][A-ZÀ-Ý'’.()-]{0,40}(?:[ \t]+[A-ZÀ-Ý][A-ZÀ-Ý'’.()-]{0,40}){1,8}`, 'gu'),
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

/**
 * Every e-mail quantifier is bounded and every start is anchored behind a character that cannot be part of the local
 * part, so a long unbroken token is scanned once, not once per start position (no quadratic backtracking on hostile text).
 */
const EMAIL = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}){1,8}/gu
/**
 * "name [at] school [dot] edu [dot] my", "name (at) school.edu.my" and "name @ school.edu.my" are written to dodge filters;
 * they are put back into one address so the e-mail rule sees them. A plain "." needs no spaces around it.
 */
const OBFUSCATED_EMAIL = /(?<![\p{L}\p{N}._%+-])([\p{L}\p{N}._%+-]{1,64})[ \t]{0,3}(?:@|[[(][ \t]{0,3}at[ \t]{0,3}[\])])[ \t]{0,3}((?:[\p{L}\p{N}-]{1,63}(?:\.|[ \t]{0,3}[[(][ \t]{0,3}dot[ \t]{0,3}[\])][ \t]{0,3})){1,8}[\p{L}\p{N}-]{1,63})/giu
/** Cheap gate: the e-mail rules cannot match without an @ or an "at" marker. */
const MAY_HAVE_EMAIL = /@|[[(][ \t]{0,3}at[ \t]{0,3}[\])]/i
const DOT_WORD = /[ \t]{0,3}[[(][ \t]{0,3}dot[ \t]{0,3}[\])][ \t]{0,3}/gi

/** Characters NFKC would damage in a maths paper (superscripts, subscripts, vulgar fractions): kept as they are. */
const KEEP = /([\u00B2\u00B3\u00B9\u00BC-\u00BE\u2070-\u209F\u2150-\u215F\u2189])/u

/**
 * Makes look-alike text plain before any pattern runs: NFKC (full-width digits, letters, @ and dashes become ASCII),
 * invisible format characters (zero-width, bidi marks, soft hyphen) removed, every Unicode space a plain space.
 */
export function normaliseForRedaction(input: string): string {
  return input
    .split(KEEP)
    .map((seg, i) => (i % 2 === 1 ? seg : seg.normalize('NFKC')))
    .join('')
    .replace(/[\p{Cf}\u200B-\u200D\u2060\uFEFF]/gu, '')
    .replace(/[\p{Zs}]/gu, ' ')
}

// A number may wrap at a line end, so the separator takes a line break too (at most two separators between groups).
const SEP = String.raw`[ \t\r\n.\-–—]`
const IC = new RegExp(String.raw`(?<!\d)\d{6}${SEP}{0,2}\d{2}${SEP}{0,2}\d{4}(?!\d)`, 'g')
const PHONE_MY = new RegExp(String.raw`(?<![\w.])(?:\+?60${SEP}{0,2}|0)(?:1\d|[3-9])${SEP}{0,2}\d{3,4}${SEP}{0,2}\d{4}(?![\w])`, 'g')
const PHONE_INTL = new RegExp(String.raw`(?<![\w.])\+\d{1,3}${SEP}{0,2}\d[\d \t\r\n.\-–—]{6,12}\d(?![\w])`, 'g')
const STREET = new RegExp(
  String.raw`\b(?:No\.?[ \t]*\d+[A-Za-z]?,?[ \t]*)?(?:Jalan|Jln\.?|Lorong|Lrg\.?|Taman|Kampung|Kg\.?|Persiaran|Lebuh|Lebuhraya|Bandar)[ \t]+[\p{L}\p{N}'’./-]{1,40}(?:[ \t]+[\p{L}\p{N}'’./-]{1,40}){0,6}(?:,[ \t]*\d{5}[ \t]+${NAME_PART}(?:[ \t]+${NAME_PART}){0,2})?`,
  'gu',
)
const POSTCODE_CITY = new RegExp(String.raw`(?<!\d)\d{5}[ \t]+${NAME_PART}(?:[ \t]+${NAME_PART}){0,2}(?:,[ \t]*${NAME_PART}(?:[ \t]+${NAME_PART}){0,2})?`, 'gu')

/**
 * A masked value, kept in memory only for the length of one request: it is never stored, logged or returned. A caller
 * uses it to mask a provider answer that echoes the value back (see `maskEchoes`).
 */
export interface MaskedSpan {
  flag: AiRedactionFlag
  text: string
}

/** Shorter values (and name words) are not echo-masked: they would hit ordinary words of a question. */
const MIN_ECHO = 4
const NAME_JOINERS = new Set(['bin', 'binti', 'bt', 'bt.', 'b.', 'a/l', 'a/p', 'anak', 'ibni'])

/** Counts of what was masked, per flag. Never the text. */
export class Redactor {
  private readonly counts: Record<AiRedactionFlag, number> = { person_name: 0, school_name: 0, phone: 0, email: 0, ic_number: 0, address: 0 }
  private readonly found = new Map<string, AiRedactionFlag>()

  /** Masks `input` and counts what was masked. The same instance can redact several texts of one request. */
  redact(input: string): string {
    let text = normaliseForRedaction(input)
    const emailPossible = MAY_HAVE_EMAIL.test(text)
    if (emailPossible) text = text.replace(OBFUSCATED_EMAIL, (_m, local: string, domain: string) => `${local}@${domain.replace(DOT_WORD, '.')}`)
    const sub = (re: RegExp, flag: AiRedactionFlag): void => {
      text = text.replace(re, (m: string) => {
        this.counts[flag] += 1
        this.note(flag, m)
        return MASK[flag]
      })
    }
    // Contact details first: they are unambiguous and must not be split by the broader rules below.
    if (emailPossible) sub(EMAIL, 'email')
    sub(IC, 'ic_number')
    sub(PHONE_MY, 'phone')
    sub(PHONE_INTL, 'phone')
    // Labelled lines keep the label and mask the value (one count per line).
    for (const { flag, re } of [...LABEL_RULES, ...COLONLESS_RULES, ...INLINE_RULES]) {
      text = text.replace(re, (_m, label: string, value: string) => {
        if (isAlreadyMasked(value)) return `${label}${value}`
        this.counts[flag] += 1
        this.note(flag, value)
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

  /** The values masked so far (in memory only). The words of a masked person name are listed too. */
  maskedSpans(): MaskedSpan[] {
    return [...this.found].map(([text, flag]) => ({ flag, text }))
  }

  private note(flag: AiRedactionFlag, value: string): void {
    // Mask tokens already in the value (a line masked by an earlier rule) are not values.
    const t = value.replace(/\[[A-Z_-]+\]/g, ' ').trim()
    if (t.length >= MIN_ECHO && !this.found.has(t)) this.found.set(t, flag)
    if (flag !== 'person_name') return
    for (const w of t.split(/[\s,]+/)) {
      if (w.length >= MIN_ECHO && !NAME_JOINERS.has(w.toLowerCase()) && !this.found.has(w)) this.found.set(w, flag)
    }
  }
}

/** Applies `fn` to every string of a JSON value; other values are returned as they are. */
function mapStrings<T>(value: T, fn: (s: string) => string): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return fn(v)
    if (Array.isArray(v)) return v.map(walk)
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(value) as T
}

/**
 * Masks every value the redactor masked in the request (case-insensitive) wherever a provider answer repeats it, with the
 * token of its kind. A provider that was sent only masked text should not know these values; this covers one that
 * repeats a value it saw unmasked elsewhere in the paper.
 */
export function maskEchoes<T>(value: T, spans: readonly MaskedSpan[]): T {
  if (spans.length === 0) return value
  const sorted = [...spans].sort((a, b) => b.text.length - a.text.length)
  const flagOf = new Map(sorted.map((s) => [s.text.toLowerCase(), s.flag]))
  const re = new RegExp(sorted.map((s) => s.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu')
  return mapStrings(value, (s) => s.replace(re, (m) => MASK[flagOf.get(m.toLowerCase()) ?? 'person_name']))
}

/**
 * Removes MyKad numbers, e-mail addresses and phone numbers from every string of a provider answer before it is stored,
 * whatever the provider returned. Only these unambiguous patterns run (no name or address rule, no normalisation), so
 * the question text is otherwise kept as it is.
 */
export function scrubContactDetails<T>(value: T): T {
  return mapStrings(value, (s) => {
    let out = s
    if (MAY_HAVE_EMAIL.test(out)) out = out.replace(EMAIL, MASK.email)
    return out.replace(IC, MASK.ic_number).replace(PHONE_MY, MASK.phone).replace(PHONE_INTL, MASK.phone)
  })
}

/** True when nothing but mask tokens and their separators is left (so the line is not masked, or counted, twice). */
const isAlreadyMasked = (value: string): boolean => value.replace(/\[[A-Z_-]+\]/g, '').replace(/\b(?:dan|atau|and|or)\b|[\s,;/&+.-]/gi, '') === ''
