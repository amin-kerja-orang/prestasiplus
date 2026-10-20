import { Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'

/** Weekly report (S21): 403 "This action is unauthorized." for every role by design (live parity, OQ-M08-01). */
@Injectable()
export class WeeklyReportService {
  report(): never {
    throw ApiError.of('FORBIDDEN')
  }
}
