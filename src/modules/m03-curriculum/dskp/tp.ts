import type {
  DskpSkId,
  DskpSkNode,
  DskpSpId,
  DskpSpNode,
  DskpSubjectInfo,
  DskpUnitId,
  DskpUnitNode,
  TpDescriptor,
  TpResolved,
  TpTable,
} from './types'

/**
 * TP descriptor resolution (design section 2.4, AC-02.1 to AC-02.5). Pure: it reads the indexed
 * tree through `TpContext` and never changes the chosen TP (the descriptor is help text).
 */

export interface TpTarget {
  unitId: DskpUnitId
  spIds?: readonly DskpSpId[]
}

/** What the resolver needs from a subject view. */
export interface TpContext {
  info: Pick<DskpSubjectInfo, 'tpLevel'>
  generalTp: readonly TpDescriptor[] | null
  unit(id: DskpUnitId): DskpUnitNode | undefined
  sk(id: DskpSkId): DskpSkNode | undefined
  sp(id: DskpSpId): DskpSpNode | undefined
  /** Unique SK ids of the given SPs, in print order. */
  skIdsOf(spIds: readonly DskpSpId[]): DskpSkId[]
}

/**
 * The table of a node that applies to an SK. A table with `appliesToSk` applies only to the SKs it
 * lists (Katering Modul 1.0 has two); the table without `appliesToSk` applies to all. With no SK
 * given, a single table is used as it is and several tables resolve only to the unrestricted one.
 */
export function pickTpTable(
  tables: readonly TpTable[] | undefined,
  skCode?: string,
): TpTable | undefined {
  if (!tables || tables.length === 0) return undefined
  if (skCode === undefined) {
    if (tables.length === 1) return tables[0]
    return tables.find((t) => !t.appliesToSk)
  }
  return tables.find((t) => t.appliesToSk?.includes(skCode)) ?? tables.find((t) => !t.appliesToSk)
}

/** The row for a chosen TP: an exact `tp` match first, then a row whose `range` contains it. */
export function matchTpRow(
  rows: readonly TpDescriptor[] | undefined,
  tp: number,
): TpDescriptor | undefined {
  if (!rows) return undefined
  return (
    rows.find((r) => r.tp === tp) ??
    rows.find((r) => r.range !== undefined && tp >= r.range[0] && tp <= r.range[1])
  )
}

function generalFallback(ctx: TpContext, tp: number): TpResolved[] {
  const row = matchTpRow(ctx.generalTp ?? undefined, tp)
  return row ? [{ source: 'general', nodeId: null, descriptor: row }] : []
}

export function resolveTp(ctx: TpContext, target: TpTarget, tp: number): TpResolved[] {
  if (!Number.isInteger(tp) || tp < 1 || tp > 6) return []
  const unit = ctx.unit(target.unitId)
  if (!unit) return []

  // Only SPs of this unit count; an SP of another unit is not part of the target.
  const spIds = (target.spIds ?? []).filter((id) => ctx.sp(id)?.unitId === unit.id)
  const sks = ctx
    .skIdsOf(spIds)
    .map((id) => ctx.sk(id))
    .filter((s): s is DskpSkNode => s !== undefined)

  if (ctx.info.tpLevel === 'sk') {
    // One descriptor per distinct SK of the chosen SPs; none until an SP is chosen.
    if (sks.length === 0) return []
    const out: TpResolved[] = []
    for (const sk of sks) {
      const row = matchTpRow(pickTpTable(sk.tp, sk.code)?.rows, tp)
      if (row) out.push({ source: 'sk', nodeId: sk.id, descriptor: row })
    }
    return out.length > 0 ? out : generalFallback(ctx, tp)
  }

  const out: TpResolved[] = []
  const seen = new Set<TpTable>()
  const skCodes: (string | undefined)[] = sks.length > 0 ? sks.map((s) => s.code) : [undefined]
  for (const skCode of skCodes) {
    const table = pickTpTable(unit.tp, skCode)
    if (!table || seen.has(table)) continue
    seen.add(table)
    const row = matchTpRow(table.rows, tp)
    if (row) out.push({ source: 'unit', nodeId: unit.id, descriptor: row })
  }
  return out.length > 0 ? out : generalFallback(ctx, tp)
}
