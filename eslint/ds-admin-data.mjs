// Shared data of the strict Portal Pentadbiran rules (docs/design/v2-admin-page-templates.md section 4).
// The Ds twin map, the deprecated prop table and the banned copy live here so a design change is one
// edit. Components named here may not exist in src/ds yet (they are added in parallel); the rules
// only reference them by name.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const readJson = (file) => JSON.parse(readFileSync(`${ROOT}${file}`, 'utf8'))

/** R6: Nuxt UI component -> the Ds component(s) to use instead. */
export const UI_TWINS = {
  UCard: 'DsPanel / DsSurface',
  UBadge: 'DsBadge / DsStatusBadge / DsTag',
  UTable: 'DsDataTable / DsDrillTable',
  UPagination: 'DsPager / DsDataTable',
  UTabs: 'DsPillNav',
  USlideover: 'DsDrawer',
  UModal: 'DsDialog / DsDrawer',
  UDrawer: 'DsDialog / DsDrawer',
  UAlert: 'DsCallout / DsLoadError',
  UProgress: 'DsProgress',
  UBreadcrumb: 'DsBreadcrumb',
  UEmpty: 'DsEmptyState',
  UForm: 'DsFormField',
  UFormField: 'DsFormField',
  UFormGroup: 'DsFormField',
}

/** R5: native elements a portal page may not write (use the Ds primitives). */
export const RAW_HTML = new Set(
  (
    'div span p h1 h2 h3 h4 h5 h6 label ul ol li section article header footer nav aside main a ' +
    'button input select textarea form table thead tbody tr th td dialog img svg hr strong em small pre'
  ).split(' '),
)

/** R5: hint per element (kept short; the full mapping is in the design doc). */
export const RAW_HTML_HINT = {
  div: 'DsStack / DsCluster / DsGrid / DsSurface',
  span: 'DsText',
  p: 'DsText',
  strong: 'DsText',
  em: 'DsText',
  small: 'DsText',
  pre: 'DsProse / DsText',
  h1: 'DsHeading',
  h2: 'DsHeading',
  h3: 'DsHeading',
  h4: 'DsHeading',
  h5: 'DsHeading',
  h6: 'DsHeading',
  label: 'DsFormField',
  input: 'UInput',
  select: 'DsNativeSelect',
  textarea: 'UTextarea',
  button: 'UButton',
  a: 'a Ds link component / UButton to=',
  table: 'DsDataTable',
  thead: 'DsDataTable',
  tbody: 'DsDataTable',
  tr: 'DsDataTable',
  th: 'DsDataTable',
  td: 'DsDataTable',
  ul: 'DsStack / DsListRow',
  ol: 'DsStack / DsListRow',
  li: 'DsListRow',
  section: 'DsSection / DsPanel',
  article: 'DsPanel',
  header: 'DsPageHeader',
  footer: 'DsStickyActions / DsFormBar',
  nav: 'DsPillNav / DsBreadcrumb',
  aside: 'DsSplit',
  main: 'DsPage',
  form: 'DsFormSection',
  dialog: 'DsDialog / DsDrawer',
  img: 'DsThumb / DsMediaCard',
  svg: 'DsIcon / DsChart',
  hr: 'DsSection',
}

/** R13: deprecated props still accepted by the component today. `*` = any tag. */
export const DEPRECATED_PROPS = {
  DsPanel: { flush: 'use DsPanel padding', tone: 'DsPanel has no tone any more' },
  DsStatRow: { roomy: 'density is chosen by the row', compact: 'density is chosen by the row' },
  '*': { valueClass: 'use DsStatTile tone', compactCells: 'DsDataTable density' },
  DsLoadError: { inline: 'use DsEmptyState / DsCallout for inline errors' },
  DsFilterBar: { tone: 'DsFilterBar has no tone' },
  DsFormSection: { tone: 'danger sections use DsCallout / a danger DsPanel' },
}
/** R13: `Tag.prop` pairs that are only deprecated for one value. */
export const DEPRECATED_VALUES = [{ tag: 'DsFormSection', prop: 'tone', value: 'danger' }]

/** R11: banned copy. `re` is tested against template text, attribute strings and script literals. */
export const BANNED_COPY = [
  { re: /\bTapis\b/, why: '"Tapis" -> "Cari"' },
  { re: /\bReset\b/, why: '"Reset" -> "Set Semula"' },
  { re: /\bCuba Lagi\b/, why: '"Cuba Lagi" -> "Cuba semula"' },
  { re: /\bShowing\b[^.]*\bresults?\b/i, why: 'English pager copy -> DsDataTable pager' },
  { re: /\bTiada rekod ditemui\b/i, why: '"Tiada rekod ditemui" -> DsEmptyState copy' },
  { re: /^\s*Pengurusan /, why: 'titles do not start with "Pengurusan "' },
  { re: /Kembali ke /, why: 'back link label is "Kembali" (DsPage backTo)' },
  { re: /\bKirkpatrick Evaluation\b/, why: '"Kirkpatrick Evaluation" -> "Kirkpatrick"' },
  { re: /\bUpload\b/, why: '"Upload" -> "Muat Naik"' },
  { re: /\bDownload\b/, why: '"Download" -> "Muat Turun"' },
  { re: /\bTemplate\b/, why: '"Template" -> "Templat"' },
  { re: /\bDaftar Baru\b/, why: 'add buttons are "Tambah X" / "Daftar <entity>"' },
  { re: /\bBeri Akses Baru\b/, why: 'use "Tambah Akses ..."' },
  { re: /\bLangganan Baru\b/, why: 'use "Daftar Langganan"' },
  { re: /\bKertas Baharu\b/, why: 'use "Tambah Kertas"' },
  { re: /\bCipta Set\b/, why: 'use "Tambah ..."' },
  { re: /\bBuat Baru\b/, why: 'use "Tambah ..."' },
  { re: /\bRekod Intervensi Baru\b/, why: 'use "Tambah Tindakan"' },
]
/** R11: "Tiada data." is only allowed inside `DsEmptyState size="sm"`. */
export const NO_DATA_RE = /\bTiada data\.?/
/** R11: an add-button label must start with one of these. */
export const ADD_LABEL_RE = /^(?:Tambah |Daftar |Muat Naik |Import )/
/** R11: `Daftar` is only used with these entities. */
export const DAFTAR_ENTITIES = /^Daftar (?:Pengguna|Sekolah|Pelajar Komplimen|Langganan)\b/

/** R8 hints: file names of module-local copies of Ds kits (name based, as no-local-kits does). */
export const LOCAL_KIT_IMPORT_RE =
  /(?:^|\/)(?:[A-Za-z]*(?:FormBar|RowMenu|ActiveFilters|PageHeader|PillNav|StatRow|LoadError|ErrorBox)|CardTable[A-Za-z]*)(?:\.vue)?$/

/** Sanctioned Nuxt UI tags (R7). Adding one needs a design review (see the file). */
export function readUiAllowlist() {
  return readJson('config/ds-ui-allowlist.json').allowed.map((e) => (typeof e === 'string' ? e : e.tag))
}
export function readCopyExceptions() {
  return readJson('config/copy-exceptions.json').exceptions ?? []
}
export function readDomainWidgets() {
  return (readJson('config/ds-domain-widgets.json').widgets ?? []).map((w) => w.file)
}
