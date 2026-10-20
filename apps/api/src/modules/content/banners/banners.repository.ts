import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../db/generated/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

const include = { imageFile: { select: { publicId: true } } } satisfies Prisma.BannerInclude
export type BannerRow = Prisma.BannerGetPayload<{ include: typeof include }>

export interface BannerWrite {
  title: string
  description: string | null
  imageFileId: bigint | null
  bannerType: string
  linkType: string
  externalUrl: string | null
  targetAudience: string
  displayOrder: number
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
}

const ORDER: Prisma.BannerOrderByWithRelationInput[] = [{ displayOrder: 'asc' }, { id: 'asc' }]

/** The only doorway to `banners`. */
@Injectable()
export class BannersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  all(): Promise<BannerRow[]> {
    return this.prisma.client.banner.findMany({ orderBy: ORDER, include })
  }

  get(id: string): Promise<BannerRow | null> {
    return this.prisma.client.banner.findUnique({ where: { id: idFromString(id) }, include })
  }

  /** Active, inside its date window on `today`, and for one of `audiences` (BR-M09-14). */
  active(today: Date, audiences: readonly string[] | null): Promise<BannerRow[]> {
    return this.prisma.client.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: today } }] },
          { OR: [{ endDate: null }, { endDate: { gte: today } }] },
        ],
        ...(audiences === null ? {} : { targetAudience: { in: [...audiences] } }),
      },
      orderBy: ORDER,
      include,
    })
  }

  async create(data: BannerWrite): Promise<string> {
    const row = await this.prisma.client.banner.create({ data, select: { id: true } })
    return row.id.toString()
  }

  /** Writes only the fields in `patch`; false when the row is gone. */
  async update(id: string, patch: Prisma.BannerUncheckedUpdateManyInput): Promise<boolean> {
    const r = await this.prisma.client.banner.updateMany({ where: { id: idFromString(id) }, data: patch })
    return r.count === 1
  }

  async remove(id: string): Promise<boolean> {
    const r = await this.prisma.client.banner.deleteMany({ where: { id: idFromString(id) } })
    return r.count === 1
  }
}
