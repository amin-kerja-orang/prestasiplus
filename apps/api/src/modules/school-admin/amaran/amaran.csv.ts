import { AMARAN_CSV_COLUMNS, AMARAN_STATUS_LABELS, type AmaranPupilRisk } from '@pp/contract'

import { toCsv } from '../csv'

/**
 * The school CSV of the Amaran risk list: UTF-8 BOM, CRLF line ends with a trailing CRLF, RFC 4180 quoting, and every cell that a
 * spreadsheet could run as a formula (leading `= + - @ TAB CR`) prefixed with an apostrophe (`toCsv`). One line per pupil, in rank
 * order. There is no IC, e-mail or phone column: the row type does not even carry them.
 */
export function amaranCsv(pupils: readonly AmaranPupilRisk[]): string {
  return toCsv(
    AMARAN_CSV_COLUMNS,
    pupils.map((p) => [p.rank, p.name, p.classLabel, p.score.toFixed(1), AMARAN_STATUS_LABELS[p.status], p.accuracyText, p.engagementText, p.masteryText]),
    'CRLF',
  )
}
