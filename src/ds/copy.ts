/**
 * Default BM strings of the design-system components (docs/design/v2-copy-glossary.md). Flat on
 * purpose, so parallel branches can add keys without merge conflicts. No component writes a
 * literal default; callers override per prop where live wording differs.
 */
export const dsCopy = {
  save: 'Simpan',
  cancel: 'Batal',
  back: 'Kembali',
  retry: 'Cuba Semula',
  search: 'Cari',
  apply: 'Guna',
  reset: 'Set Semula',
  required: 'wajib',
  selectPlaceholder: 'Pilih',
  breadcrumbAria: 'Jejak navigasi',
  breadcrumbMore: 'Lagi',
  fileDrop: 'Seret fail ke sini atau klik untuk memilih',
  fileTooLarge: 'Fail melebihi saiz maksimum {n} MB.',
} as const
