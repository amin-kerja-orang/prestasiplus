import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  SPM_MESSAGES,
  SPM_WALKTHROUGH_ECHO_CHARS,
  SPM_WALKTHROUGH_MAX_IMAGE_BYTES,
  SpmWalkthroughSubjectSchema,
  type SpmWalkthroughResponse,
} from '@pp/contract'

import { CANNED_WALKTHROUGH, WALKTHROUGH_DELAY_MS } from './config'
import { fieldError } from './errors'

/** What the controller read of the upload. The bytes are never kept: only the size and the type are looked at. */
export interface UploadedImage {
  size: number
  mimetype: string
}

export interface SolveInput {
  subject: unknown
  questionText: unknown
  /** The image part, when one was sent. */
  image?: UploadedImage | undefined
  /** The upload was cut off by the 5 MB limit (multer refused it before its bytes were read). */
  imageTooLarge?: boolean
}

/**
 * The simulated walkthrough (M06-13, D4): canned text per subject, no external call, no image retention (SEC-M06-05).
 * Keep the behaviour behind this class: a later card (BE-36) may bind a real solver here. The delay (the mock's
 * 1500 ms) is `SPM_WALKTHROUGH_DELAY_MS`; tests set it to 0.
 */
@Injectable()
export class WalkthroughService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private delayMs(): number {
    const n = Number.parseInt(String(this.config.get<string>('SPM_WALKTHROUGH_DELAY_MS') ?? ''), 10)
    return Number.isInteger(n) && n >= 0 ? n : WALKTHROUGH_DELAY_MS
  }

  async solve(input: SolveInput): Promise<SpmWalkthroughResponse> {
    // A cut-off upload leaves no readable fields: it answers the image error first (the subject cannot be checked).
    if (input.imageTooLarge === true) return { ok: false, error: SPM_MESSAGES.walkthroughImageInvalid }
    const subject = SpmWalkthroughSubjectSchema.safeParse(input.subject)
    if (!subject.success) throw fieldError({ subject: SPM_MESSAGES.subjectInvalid })
    const text = typeof input.questionText === 'string' ? input.questionText.trim() : ''
    const image = input.image && input.image.size > 0 ? input.image : undefined
    if (image && (!image.mimetype.startsWith('image/') || image.size > SPM_WALKTHROUGH_MAX_IMAGE_BYTES)) {
      return { ok: false, error: SPM_MESSAGES.walkthroughImageInvalid }
    }
    if (text === '' && !image) return { ok: false, error: SPM_MESSAGES.walkthroughEmpty }
    const delay = this.delayMs()
    if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay))
    const first = text === '' ? '(gambar)' : text.slice(0, SPM_WALKTHROUGH_ECHO_CHARS)
    const canned = CANNED_WALKTHROUGH[subject.data] ?? CANNED_WALKTHROUGH.default
    return { ok: true, walkthrough: `Soalan: ${first}\n\n${canned}` }
  }
}
