import { Inject, Injectable } from '@nestjs/common'
import { IntakeBboxSchema, type IntakeBbox } from '@pp/contract'

import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FILE_STORAGE, FilesService, type FileStorage } from '../../files'
import { JobError, JobsService } from '../../jobs'
import { OcrConfig, OcrError, OcrImageService, PDF_ENGINE, type PdfEngine } from '../../ocr'
import { INTAKE_JOB_ENTITY, INTAKE_JOB_TYPES } from './intake-files.config'
import { discardStored } from './intake-storage'

/**
 * Figure crops (BE-37; BE-38's extraction hook calls `enqueueCrop`, the job calls `crop`). A crop is cut from
 * the stored page image (rendered again from the original when the page has no image), stored as an
 * `intake_figure` file and referenced by an `intake_figures` row. The same page and box give the same figure.
 */
@Injectable()
export class IntakeFiguresService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(OcrConfig) private readonly ocrConfig: OcrConfig,
    @Inject(PDF_ENGINE) private readonly pdf: PdfEngine,
    @Inject(OcrImageService) private readonly images: OcrImageService,
  ) {}

  /** Queues a crop job for a page. Idempotent per page and box. Returns false when the page does not exist. */
  async enqueueCrop(pageId: string, bbox: IntakeBbox, altTextSuggestion?: string): Promise<boolean> {
    const box = IntakeBboxSchema.parse(bbox)
    const page = await this.prisma.client.intakePage.findUnique({ where: { id: idFromString(pageId) }, select: { intakeFileId: true } })
    if (!page) return false
    const key = `${INTAKE_JOB_TYPES.cropFigure}:${pageId}:${box.x.toFixed(4)},${box.y.toFixed(4)},${box.w.toFixed(4)},${box.h.toFixed(4)}`
    await this.jobs.enqueue({
      type: INTAKE_JOB_TYPES.cropFigure,
      idempotencyKey: key,
      entityType: INTAKE_JOB_ENTITY,
      entityId: idToString(page.intakeFileId),
      payload: { pageId, bbox: box, ...(altTextSuggestion ? { altTextSuggestion: altTextSuggestion.slice(0, 500) } : {}) },
    })
    return true
  }

  /** Cuts `bbox` (page fractions) out of the page and stores it. Returns the figure id, or null when the batch was cancelled. */
  async crop(pageId: string, bboxInput: unknown, altTextSuggestion?: string, signal?: AbortSignal): Promise<{ figureId: string } | null> {
    const bbox = IntakeBboxSchema.safeParse(bboxInput)
    if (!bbox.success || bbox.data.w <= 0 || bbox.data.h <= 0) throw new JobError('INVALID_BBOX', false)
    let id: bigint
    try {
      id = idFromString(pageId)
    } catch {
      throw new JobError('PAGE_NOT_FOUND', false)
    }
    const page = await this.prisma.client.intakePage.findUnique({
      where: { id },
      select: {
        id: true,
        pageNo: true,
        imageFileId: true,
        intakeFile: { select: { fileId: true, batch: { select: { status: true, ownerUserId: true, isTest: true } } } },
      },
    })
    if (!page) throw new JobError('PAGE_NOT_FOUND', false)
    const batch = page.intakeFile.batch
    if (batch.status === 'cancelled') return null

    const existing = await this.prisma.client.intakeFigure.findFirst({ where: { intakePageId: id, bbox: { equals: bbox.data } }, select: { id: true, cropFileId: true } })
    if (existing?.cropFileId) return { figureId: idToString(existing.id) }

    const png = await this.pagePng(page, signal)
    let cropped: Buffer
    try {
      cropped = await this.images.crop(png, bbox.data)
    } catch (err) {
      if (err instanceof OcrError) throw new JobError(err.code, false)
      throw err
    }
    const stored = await this.files.storeDerived({
      ownerUserId: batch.ownerUserId === null ? null : idToString(batch.ownerUserId),
      purpose: 'intake_figure',
      bytes: cropped,
      isTest: batch.isTest,
    })
    try {
      const row = await this.prisma.client.intakeFigure.create({
        data: {
          intakePageId: id,
          bbox: bbox.data,
          cropFileId: idFromString(stored.id),
          altTextSuggestion: altTextSuggestion ? altTextSuggestion.slice(0, 500) : null,
        },
      })
      return { figureId: idToString(row.id) }
    } catch (err) {
      await discardStored(this.prisma, this.storage, [stored.id])
      throw err
    }
  }

  /** The page as a PNG-or-WebP image the canvas can load: the stored image, else a fresh render of the original. */
  private async pagePng(page: { pageNo: number; imageFileId: bigint | null; intakeFile: { fileId: bigint } }, signal?: AbortSignal): Promise<Buffer> {
    if (page.imageFileId !== null) {
      const image = await this.files.readStored(idToString(page.imageFileId))
      if (image) return image.bytes
    }
    const original = await this.files.readStored(idToString(page.intakeFile.fileId))
    if (!original) throw new JobError('ORIGINAL_MISSING', false)
    try {
      const rendered = await this.pdf.render(original.bytes, page.pageNo, { dpi: this.ocrConfig.renderDpi, maxPixels: this.ocrConfig.maxPixels }, signal)
      if (!rendered) throw new JobError('RENDER_FAILED', false)
      return rendered.png
    } catch (err) {
      if (err instanceof OcrError) throw new JobError(err.code, err.code === 'OCR_TIMEOUT')
      throw err
    }
  }
}
