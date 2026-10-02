/**
 * Class strings copied from the live Laravel Tailwind paginator markup
 * (M05 discovery `page_latihan-berstruktur_page_2.html`; dark: variants dropped, the app has
 * no dark mode). `min-h-11` / `min-w-11` are the only additions: the touch hit area of
 * NFR-RESP-03, centred so the visual stays the live one.
 */
const HIT = 'min-h-11 min-w-11 justify-center'
const FOCUS = 'focus:outline-none focus:ring ring-gray-300 focus:border-blue-300'
const BASE =
  'relative inline-flex items-center text-sm font-medium bg-white border border-gray-300 leading-5'

export const PAGER_CLASSES = {
  nav: 'flex items-center justify-between',
  mobileRow: 'flex justify-between flex-1 sm:hidden',
  desktopRow: 'hidden sm:flex-1 sm:flex sm:items-center sm:justify-between',
  summary: 'text-sm text-gray-700 leading-5',
  summaryNumber: 'font-medium',
  /** Wraps between 640 and 1023 px instead of overflowing (DV-M04-09). */
  strip: 'relative z-0 inline-flex flex-wrap rtl:flex-row-reverse shadow-sm rounded-md',
  mobileLink: `${BASE} ${HIT} px-4 py-2 text-gray-700 rounded-md hover:text-gray-500 ${FOCUS} active:bg-gray-100 active:text-gray-700 transition ease-in-out duration-150`,
  mobileLinkNext: `${BASE} ${HIT} px-4 py-2 ml-3 text-gray-700 rounded-md hover:text-gray-500 ${FOCUS} active:bg-gray-100 active:text-gray-700 transition ease-in-out duration-150`,
  mobileDisabled: `${BASE} ${HIT} px-4 py-2 text-gray-500 cursor-default rounded-md`,
  mobileDisabledNext: `${BASE} ${HIT} px-4 py-2 ml-3 text-gray-500 cursor-default rounded-md`,
  arrowPrev: `${BASE} ${HIT} px-2 py-2 text-gray-500 rounded-l-md hover:text-gray-400 focus:z-10 ${FOCUS} active:bg-gray-100 active:text-gray-500 transition ease-in-out duration-150`,
  arrowNext: `${BASE} ${HIT} px-2 py-2 -ml-px text-gray-500 rounded-r-md hover:text-gray-400 focus:z-10 ${FOCUS} active:bg-gray-100 active:text-gray-500 transition ease-in-out duration-150`,
  arrowPrevDisabled: `${BASE} ${HIT} px-2 py-2 text-gray-500 cursor-default rounded-l-md`,
  arrowNextDisabled: `${BASE} ${HIT} px-2 py-2 -ml-px text-gray-500 cursor-default rounded-r-md`,
  page: `${BASE} ${HIT} px-4 py-2 -ml-px text-gray-700 hover:text-gray-500 focus:z-10 ${FOCUS} active:bg-gray-100 active:text-gray-700 transition ease-in-out duration-150`,
  current: `${BASE} ${HIT} px-4 py-2 -ml-px text-gray-500 cursor-default`,
  gap: `${BASE} ${HIT} px-4 py-2 -ml-px text-gray-700 cursor-default`,
  arrowIcon: 'w-5 h-5',
} as const

/**
 * Table card (design-system §7.4): white `rounded-2xl` card; the table scrolls inside the
 * wrapper, never the page. Header cells upper-case `text-xs font-bold text-slate-500`; no cell
 * text below 12 px.
 */
export const TABLE_CLASSES = {
  card: 'min-w-0 max-w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden',
  scroller: 'overflow-x-auto',
  table: 'w-full text-sm text-left',
  th: 'px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap',
  td: 'px-4 py-3 text-sm text-slate-700',
  row: 'border-t border-slate-100',
} as const
