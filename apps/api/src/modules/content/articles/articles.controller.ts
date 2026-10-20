import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common'
import { AdminArticleCreateRequestSchema } from '@pp/contract'
import type { z } from 'zod'
import type { Request } from 'express'

import { Public, Roles } from '../../../common/guards/decorators'
import { NoStoreInterceptor } from '../../../common/http'
import type { RequestWithAuth } from '../../../common/scope/auth-context'
import { RateLimit, RateLimitGuard } from '../../../common/throttle'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { actorOf, CONTENT_LIMITS, queryText } from '../shared/content-support'
import { ArticlesService } from './articles.service'

type Req = Request & RequestWithAuth
type Query_ = Record<string, unknown>
type ArticleCreateBody = z.infer<typeof AdminArticleCreateRequestSchema>

/**
 * Reader routes (M09 #6 to #9): public, only published articles. They are cacheable by nobody but the
 * browser: no personal data, but the view counter makes each answer unique, so `no-store` is not forced here.
 */
@Controller()
@UseGuards(RateLimitGuard)
export class ArticlesController {
  constructor(@Inject(ArticlesService) private readonly articles: ArticlesService) {}

  @Get('articles')
  @Public()
  @RateLimit(CONTENT_LIMITS.publicRead)
  list(@Query() q: Query_) {
    return this.articles.readerList({ search: queryText(q, 'search'), category: queryText(q, 'category'), page: queryText(q, 'page') })
  }

  @Get('articles/hot')
  @Public()
  @RateLimit(CONTENT_LIMITS.publicRead)
  hot() {
    return this.articles.hot()
  }

  @Get('articles/latest')
  @Public()
  @RateLimit(CONTENT_LIMITS.publicRead)
  latest(@Query() q: Query_) {
    return this.articles.latest(queryText(q, 'limit'))
  }

  @Get('articles/:slug')
  @Public()
  @RateLimit(CONTENT_LIMITS.publicRead)
  async detail(@Param('slug') slug: string) {
    return { data: await this.articles.detail(slug) }
  }
}

/** Admin routes (M09 #1 to #5): admin only, `no-store`, rate limited per user. */
@Controller('admin/articles')
@Roles('admin')
@UseGuards(RateLimitGuard)
@UseInterceptors(NoStoreInterceptor)
export class AdminArticlesController {
  constructor(@Inject(ArticlesService) private readonly articles: ArticlesService) {}

  @Get()
  @RateLimit(CONTENT_LIMITS.adminRead)
  list(@Query() q: Query_) {
    return this.articles.adminList({
      search: queryText(q, 'search'),
      category: queryText(q, 'category'),
      published: queryText(q, 'published'),
      page: queryText(q, 'page'),
    })
  }

  @Get(':id')
  @RateLimit(CONTENT_LIMITS.adminRead)
  async get(@Param('id') id: string) {
    return { data: await this.articles.adminGet(id) }
  }

  @Post()
  @HttpCode(201)
  @RateLimit(CONTENT_LIMITS.adminWrite)
  create(@Req() req: Req, @Body(new ZodValidationPipe(AdminArticleCreateRequestSchema)) body: ArticleCreateBody) {
    return this.articles.create(actorOf(req), body)
  }

  @Put(':id')
  @RateLimit(CONTENT_LIMITS.adminWrite)
  update(@Req() req: Req, @Param('id') id: string, @Body() body: unknown) {
    return this.articles.update(actorOf(req), id, body)
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit(CONTENT_LIMITS.adminWrite)
  remove(@Req() req: Req, @Param('id') id: string) {
    return this.articles.remove(actorOf(req), id)
  }
}
