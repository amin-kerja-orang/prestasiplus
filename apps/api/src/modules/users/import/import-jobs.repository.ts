import { Inject, Injectable } from '@nestjs/common'

import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import type { ImportError } from './plan'

export type ImportKind = 'users' | 'students'
export type ImportSourceMode = 'csv' | 'paste'

export interface NewImportJob {
  kind: ImportKind
  mode: ImportSourceMode
  createdById: string
  /** Scope of the importer; null for a national admin importing without a school. */
  schoolId: string | null
  totalRows: number
  importedCount: number
  failedCount: number
  /** Per-row results of the failed lines (the mock `ImportRun.failures`). */
  failures: readonly ImportError[]
  now: Date
}

export interface ImportJobRecord {
  id: string
  kind: string
  mode: string
  createdById: string | null
  schoolId: string | null
  totalRows: number
  importedCount: number
  failedCount: number
  failures: { row: number; message: string }[]
  createdAt: Date
}

/** The only doorway to `import_jobs`. Used by the user import here and by the student import (BE-25). */
@Injectable()
export class ImportJobsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Stores one run (call inside the import transaction). Failures hold line numbers and messages only. */
  async create(input: NewImportJob): Promise<string> {
    const row = await this.prisma.client.importJob.create({
      data: {
        kind: input.kind,
        mode: input.mode,
        createdById: idFromString(input.createdById),
        schoolId: input.schoolId === null ? null : idFromString(input.schoolId),
        totalRows: input.totalRows,
        importedCount: input.importedCount,
        failedCount: input.failedCount,
        failures: input.failures.map((f) => ({ row: f.line, message: f.message })),
        createdAt: input.now,
        updatedAt: input.now,
      },
      select: { id: true },
    })
    return idToString(row.id)
  }

  async get(id: string): Promise<ImportJobRecord | null> {
    if (!isIdString(id)) return null
    const r = await this.prisma.client.importJob.findUnique({ where: { id: idFromString(id) } })
    if (!r) return null
    return {
      id: idToString(r.id),
      kind: r.kind,
      mode: r.mode,
      createdById: r.createdById === null ? null : idToString(r.createdById),
      schoolId: r.schoolId === null ? null : idToString(r.schoolId),
      totalRows: r.totalRows,
      importedCount: r.importedCount,
      failedCount: r.failedCount,
      failures: Array.isArray(r.failures) ? (r.failures as { row: number; message: string }[]) : [],
      createdAt: r.createdAt,
    }
  }
}
