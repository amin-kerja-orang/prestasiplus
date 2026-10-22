import { Inject, Injectable } from '@nestjs/common'
import type { PkskBahagian, PkskPackageLevel } from '@pp/contract'

import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'

export interface DomainRecord {
  id: string
  bahagian: PkskBahagian
  name: string
  nameEn: string
  code: string
  icon: string
  color: string
  order: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PackageRecord {
  id: string
  name: string
  level: PkskPackageLevel
}

/** Reference data: the 15 domains and the 3 packages (migration 0028 inserts them). Read only. */
@Injectable()
export class PkskDomainsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** All domains by `display_order`. */
  async list(): Promise<DomainRecord[]> {
    const rows = await this.prisma.client.pkskDomain.findMany({ orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] })
    return rows.map(toDomain)
  }

  async byCode(code: string): Promise<DomainRecord | null> {
    const row = await this.prisma.client.pkskDomain.findUnique({ where: { code } })
    return row ? toDomain(row) : null
  }

  async get(id: string): Promise<DomainRecord | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.pkskDomain.findUnique({ where: { id: idFromString(id) } })
    return row ? toDomain(row) : null
  }

  async listPackages(): Promise<PackageRecord[]> {
    const rows = await this.prisma.client.pkskPackage.findMany({ orderBy: { id: 'asc' } })
    return rows.map(toPackage)
  }

  async getPackage(id: string): Promise<PackageRecord | null> {
    if (!isIdString(id)) return null
    const row = await this.prisma.client.pkskPackage.findUnique({ where: { id: idFromString(id) } })
    return row ? toPackage(row) : null
  }
}

function toDomain(r: {
  id: bigint
  bahagian: string
  name: string
  nameEn: string
  code: string
  icon: string
  color: string
  displayOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): DomainRecord {
  return {
    id: idToString(r.id),
    bahagian: r.bahagian as PkskBahagian,
    name: r.name,
    nameEn: r.nameEn,
    code: r.code,
    icon: r.icon,
    color: r.color,
    order: r.displayOrder,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toPackage(r: { id: bigint; name: string; level: string }): PackageRecord {
  return { id: idToString(r.id), name: r.name, level: r.level as PkskPackageLevel }
}
