import { Module, type OnModuleDestroy, Inject } from '@nestjs/common'

import { OcrImageService } from './images'
import { createOcrEngine, TesseractEngine } from './ocr-engine'
import { OcrConfig } from './ocr.config'
import { OCR_ENGINE, PDF_ENGINE, type OcrEngine } from './ocr.types'
import { PdfjsEngine } from './pdfjs.engine'

@Module({
  providers: [
    OcrConfig,
    OcrImageService,
    { provide: PDF_ENGINE, useFactory: (cfg: OcrConfig) => new PdfjsEngine(cfg), inject: [OcrConfig] },
    { provide: OCR_ENGINE, useFactory: (cfg: OcrConfig) => createOcrEngine(cfg), inject: [OcrConfig] },
  ],
  exports: [PDF_ENGINE, OCR_ENGINE, OcrConfig, OcrImageService],
})
export class OcrModule implements OnModuleDestroy {
  constructor(@Inject(OCR_ENGINE) private readonly engine: OcrEngine) {}

  async onModuleDestroy(): Promise<void> {
    if (this.engine instanceof TesseractEngine) await this.engine.close()
  }
}
