import { Inject, Injectable } from '@nestjs/common'
import {
  AI_MAX_PAGE_TEXT_CHARS,
  AI_MAX_PAGES,
  AI_MAX_TEXT_CHARS,
  AiExtractRequestSchema,
  type AiExtractRequest,
  type AiPageImageRef,
  type AiPageText,
} from '@pp/contract'

import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { JobError } from '../../jobs'

// C0 and C1 controls except \n (0x0A) and \t (0x09).
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g
// Zero-width, bidi marks, embeddings, overrides and isolates, and the byte order mark.
const INVISIBLES = /[​-‏‪-‮⁦-⁩﻿]/g

/** Cuts to at most `max` UTF-16 units without leaving half of a surrogate pair. */
function cut(text: string, max: number): string {
  if (text.length <= max) return text
  const end = text.charCodeAt(max - 1)
  return text.slice(0, end >= 0xd800 && end <= 0xdbff ? max - 1 : max)
}

/**
 * Makes stored page text safe to hand to a model (prompt-injection hygiene, DESIGN.md): NFKC, no control
 * characters except newline and tab, no zero-width or bidi characters, at most two blank lines in a row, and
 * at most `AI_MAX_PAGE_TEXT_CHARS`. Pure function.
 */
export function sanitizeForAi(text: string): string {
  const folded = text.normalize('NFKC').replace(/\r\n?/g, '\n')
  const clean = folded.replace(CONTROLS, '').replace(INVISIBLES, '').replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, '\n\n')
  return cut(clean.trim(), AI_MAX_PAGE_TEXT_CHARS)
}

/**
 * The hand-off from the stored pages of a submission to the provider-neutral AI request (BE-38 calls it from
 * its extraction job; there is no route). Built from the stored page text and page image references ONLY: the
 * uploader notes, the source declaration, the original file names and the admin notes are never read.
 *
 * Pages of all `done` files are numbered 1.. in file order, then page order (the AI request has one page
 * sequence); text and image refs use the same number. At most `AI_MAX_PAGES` pages, and the text of all pages
 * together is capped at `AI_MAX_TEXT_CHARS`.
 */
@Injectable()
export class IntakeExtractionInput {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async build(batchId: string): Promise<AiExtractRequest> {
    let id: bigint
    try {
      id = BigInt(batchId)
    } catch {
      throw new JobError('BATCH_NOT_FOUND', false)
    }
    const batch = await this.prisma.client.intakeBatch.findUnique({
      where: { id },
      select: {
        subject: true,
        kertas: true,
        files: {
          where: { status: 'done' },
          orderBy: { id: 'asc' },
          select: {
            pages: {
              orderBy: { pageNo: 'asc' },
              select: { text: true, textSource: true, ocrConfidence: true, ocrStatus: true, imageFileId: true, width: true, height: true },
            },
          },
        },
      },
    })
    if (!batch) throw new JobError('BATCH_NOT_FOUND', false)

    const pages: AiPageText[] = []
    const images: AiPageImageRef[] = []
    let remaining = AI_MAX_TEXT_CHARS
    let number = 0
    for (const file of batch.files) {
      for (const p of file.pages) {
        if (number >= AI_MAX_PAGES) break
        number += 1
        if (p.imageFileId !== null && p.width && p.height) {
          images.push({ page: number, fileId: idToString(p.imageFileId), width: p.width, height: p.height })
        }
        if (p.text === null || (p.ocrStatus !== 'not_needed' && p.ocrStatus !== 'done') || remaining <= 0) continue
        const text = cut(sanitizeForAi(p.text), remaining)
        if (text === '') continue
        remaining -= text.length
        const source = p.textSource === 'ocr' ? 'ocr' : 'text-layer'
        const confidence = p.ocrConfidence === null ? undefined : Number(p.ocrConfidence)
        pages.push({ page: number, text, source, ...(source === 'ocr' && confidence !== undefined ? { confidence } : {}) })
      }
    }
    return AiExtractRequestSchema.parse({
      pages,
      ...(images.length > 0 ? { images } : {}),
      subject: batch.subject,
      kertas: batch.kertas === 2 ? 2 : 1,
    })
  }
}
