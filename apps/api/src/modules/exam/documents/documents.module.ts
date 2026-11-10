import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { KertasDokumenAdminController, KertasDokumenController } from './documents.controller'
import { DocumentsRepository } from './documents.repository'
import { DocumentsService } from './documents.service'

/**
 * Kertas Subjektif page-image documents (V2 parity, migration 0265): the pupil list and view, and the Admin Pusat list, preview and
 * Terbit/Sembunyi toggle. Owns `paper_documents` and `paper_document_pages`; the page bytes are `files` rows (purpose `kertas_page`), read
 * through `GET /files/{token}` under the published-document rule of `FilesService`.
 */
@Module({
  imports: [AuditModule, ThrottleModule],
  controllers: [KertasDokumenController, KertasDokumenAdminController],
  providers: [DocumentsRepository, DocumentsService],
  exports: [DocumentsService],
})
export class ExamDocumentsModule {}
