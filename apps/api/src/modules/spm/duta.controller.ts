import { Controller, Get, Inject, Query, UseInterceptors } from '@nestjs/common'

import { NoStoreInterceptor } from '../../common/http/no-store.interceptor'
import { ok } from '../../common/http/respond'
import { DutaService } from './duta.service'

/** `GET /api/duta/recommendations` (M06-14). PROVISIONAL: M24 takes the route over with the same path and body. */
@Controller('duta')
@UseInterceptors(NoStoreInterceptor)
export class DutaController {
  constructor(@Inject(DutaService) private readonly duta: DutaService) {}

  @Get('recommendations')
  async recommendations(@Query() query: Record<string, unknown>) {
    return ok(await this.duta.recommend(query))
  }
}
