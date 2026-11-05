import { Controller, Get, Inject, Param, Query } from '@nestjs/common'

import { Roles } from '../../../common/guards'
import { listMeta, ok } from '../../../common/http/respond'
import { QuestionsService } from '../questions.service'
import { parseGuruStructuredList } from './parse'
import { guruStructuredDetailView, guruStructuredRowView } from './views'

/**
 * API-GUR-26 (R1-GUR-44b): the teacher mount over the same read service as the admin structured reads. Read-only; approved questions
 * a pupil is served, 20 per page, newest first; no admin-only fields. `student` and `school_admin` get 403 from the role guard.
 */
@Roles('teacher', 'admin')
@Controller('guru/structured-questions')
export class GuruStructuredQuestionsController {
  constructor(@Inject(QuestionsService) private readonly questions: QuestionsService) {}

  @Get()
  async list(@Query() query: unknown) {
    const { filter, status } = parseGuruStructuredList(query)
    const res = await this.questions.listGuruStructured(filter, status)
    const offset = (res.page - 1) * res.pageSize
    return {
      data: res.rows.map((q, i) => guruStructuredRowView(q, offset + i + 1)),
      meta: listMeta(res.page, res.pageSize, res.total),
    }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return ok(guruStructuredDetailView(await this.questions.getGuruStructured(id)))
  }
}
