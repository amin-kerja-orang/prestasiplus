import { Controller, Get, Inject, Param, Query } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { listMeta, ok } from '../../../common/http/respond'
import { QuestionsService } from '../questions.service'
import { parseStructuredList } from './parse'
import { structuredDetailView, structuredRowView } from './views'

/** Structured-question reads (SRS M04): the `admin` role only. `meta.stats` covers the whole store. */
@Roles('admin')
@Controller('structured-questions')
export class StructuredQuestionsController {
  constructor(@Inject(QuestionsService) private readonly questions: QuestionsService) {}

  @Get()
  async list(@Query() query: unknown) {
    const res = await this.questions.listStructured(parseStructuredList(query))
    return {
      data: res.rows.map(structuredRowView),
      meta: { ...listMeta(res.page, res.pageSize, res.total), stats: res.stats },
    }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(structuredDetailView(await this.questions.getStructured(id)))
  }
}
