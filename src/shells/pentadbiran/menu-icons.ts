/**
 * Phosphor glyph of every built Pentadbiran screen (one icon per menu row). Full `i-ph-*` literals
 * so the icon bundler finds them; a screen without an entry falls back to its group glyph.
 */
export const ITEM_ICON: Readonly<Record<string, string>> = {
  'PM-01': 'i-ph-broadcast',
  'PM-02': 'i-ph-calendar-check',
  'PM-03': 'i-ph-monitor',
  // Kirkpatrick (one row; its seven pages are tabs inside the section).
  'PM-05': 'i-ph-chart-bar',
  'BS-01': 'i-ph-books',
  'BS-02': 'i-ph-upload-simple',
  'BS-04': 'i-ph-seal-check',
  'BS-05': 'i-ph-flag',
  'BS-06': 'i-ph-exam',
  'BS-07': 'i-ph-headphones',
  'KK-01': 'i-ph-tree-structure',
  'KK-02': 'i-ph-notebook',
  'KK-04': 'i-ph-stairs',
  'KK-05': 'i-ph-image',
  'KK-06': 'i-ph-newspaper',
  'KK-07': 'i-ph-note',
  'PS-01': 'i-ph-users',
  'PS-02': 'i-ph-buildings',
  'PS-04': 'i-ph-user-plus',
  'PS-06': 'i-ph-user-check',
  'PG-22': 'i-ph-lifebuoy',
  'KW-05': 'i-ph-receipt',
  'KW-06': 'i-ph-key',
  'SY-05': 'i-ph-camera',
}
