import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { AuthModule } from '../../auth'
import { BannersModule } from '../banners/banners.module'
import { NotesModule } from '../notes/notes.module'
import { ScreenshotsModule } from '../screenshots/screenshots.module'
import { ContentSharedModule } from '../shared'
import { AdminArticlesController, ArticlesController } from './articles.controller'
import { ArticlesRepository } from './articles.repository'
import { ArticlesService } from './articles.service'

/**
 * Content, part A (BE-24): articles (public reader and admin) with banners, notes and screenshots,
 * which this module pulls in so the registry needs one entry.
 */
@Module({
  imports: [AuditModule, AuthModule, ThrottleModule, ContentSharedModule, BannersModule, NotesModule, ScreenshotsModule],
  controllers: [ArticlesController, AdminArticlesController],
  providers: [ArticlesRepository, ArticlesService],
})
export class ContentArticlesModule {}
