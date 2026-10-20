import { Inject, Injectable } from '@nestjs/common'

import type { Prisma } from '../../../db/generated/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

const include = { file: { select: { publicId: true, sizeBytes: true, mime: true } } } satisfies Prisma.ScreenshotInclude
export type ScreenshotRow = Prisma.ScreenshotGetPayload<{ include: typeof include }>

/** The only doorway to `screenshots`. */
@Injectable()
export class ScreenshotsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Every screenshot, oldest first (stored names are made unique in this order). */
  listAll(): Promise<ScreenshotRow[]> {
    return this.prisma.client.screenshot.findMany({ orderBy: { id: 'asc' }, include })
  }

  /** The internal id of a `cms_screenshot` file by its public token. */
  async screenshotFileId(publicId: string): Promise<bigint | null> {
    const f = await this.prisma.client.file.findUnique({ where: { publicId }, select: { id: true, purpose: true } })
    return f && f.purpose === 'cms_screenshot' ? f.id : null
  }

  async create(fileId: bigint, originalName: string, uploadedById: string): Promise<bigint> {
    const row = await this.prisma.client.screenshot.create({
      data: { fileId, originalName, uploadedById: idFromString(uploadedById) },
      select: { id: true },
    })
    return row.id
  }
}
