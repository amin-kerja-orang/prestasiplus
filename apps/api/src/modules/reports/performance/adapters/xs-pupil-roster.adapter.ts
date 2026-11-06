import { Inject, Injectable } from '@nestjs/common'

import { XsQueries } from '../../../school-admin/xs-queries'
import type { PupilRosterPort, PupilRosterScope } from '../ports'

/** Real `PupilRosterPort`: the exported XS-1 query of S6-T03 (`XsQueries.pupils`), imported and not re-implemented. */
@Injectable()
export class XsPupilRosterAdapter implements PupilRosterPort {
  constructor(@Inject(XsQueries) private readonly xs: XsQueries) {}

  async xsPupilIds(scope: PupilRosterScope): Promise<string[]> {
    return (await this.xs.pupils(scope)).ids
  }
}
