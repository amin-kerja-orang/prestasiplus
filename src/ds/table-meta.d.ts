import type { RowData } from '@tanstack/vue-table'

declare module '@tanstack/table-core' {
  /**
   * `DsDataTable` column width token (`layout="fixed"`): `meta: { width: 'sm' }`. Pages never write
   * width classes; columns without a width share the rest of the row.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    width?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }
}
