import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { defineAppModule } from '../../src/app.module'
import { AuthModule } from '../../src/modules/auth'
import { featureModules } from '../../src/modules'
import { ClassesModule } from '../../src/modules/classes'
import { AnalyticsReportsModule } from '../../src/modules/reports/analytics'
import { AdminCentralService } from '../../src/modules/reports/analytics/services/monitoring.service'
import { ReportService } from '../../src/modules/reports/analytics/services/report.service'
import { SchoolReportsModule } from '../../src/modules/school-admin/reports/school-reports.module'
import { AdminClassesService } from '../../src/modules/school-admin/reports/classes.service'

/** No database needed: the Nest graph of the Admin Pusat central screens resolves (S6-T11). */
describe('Admin Pusat central screens wiring', () => {
  it('the analytics module resolves the dashboard, analytics and laporan providers', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, ClassesModule, AnalyticsReportsModule])] }).compile()
    expect(moduleRef.get(AdminCentralService, { strict: false })).toBeInstanceOf(AdminCentralService)
    expect(moduleRef.get(ReportService, { strict: false })).toBeInstanceOf(ReportService)
  }, 60_000)

  it('the school reports module resolves the central class list', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule([AuthModule, SchoolReportsModule])] }).compile()
    expect(moduleRef.get(AdminClassesService, { strict: false })).toBeInstanceOf(AdminClassesService)
  }, 60_000)

  it('the full feature module list still resolves (games, questions and users imported by the analytics module)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [defineAppModule(featureModules)] }).compile()
    expect(moduleRef.get(AdminCentralService, { strict: false })).toBeInstanceOf(AdminCentralService)
  }, 120_000)
})
