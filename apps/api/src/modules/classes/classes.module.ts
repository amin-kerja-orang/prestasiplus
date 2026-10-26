import { Inject, Module, type OnModuleInit } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { COMP_CLASSROOM_PORT } from '../subscriptions/comp-students/classroom.port'
import { CurriculumModule } from '../curriculum'
import { PerformanceModule } from '../reports/performance/performance.module'
import { PerformancePorts } from '../reports/performance/ports'
import { UsersModule, UsersPorts } from '../users'
import { ClassesRepository } from './classes.repository'
import { ClassesService } from './classes.service'
import { CompClassroomAdapter } from './comp-classroom.adapter'
import { KelasSayaController } from './kelas-saya.controller'
import { PerformanceClassesReadAdapter } from './performance-classes-read.adapter'
import { ClassesPorts } from './ports'
import { TeacherClassroomsAdapter } from './teacher-classrooms.adapter'
import { TeacherClassesController } from './teacher.controller'

/**
 * Classes and teacher basics (M10 part A, BE-17): classrooms, enrolments, teacher profiles, the teacher routes
 * under `/api/guru` and the student "Kelas Saya" pair. It exports `ClassesRepository`, the only doorway to the
 * class tables (`forTeacher`, `forStudent`, `roster`, `schoolClasses`, `findByJoinCode`, `memberIds`, `enrol`),
 * `ClassesPorts` (BE-09 plugs in the teacher question counts, BE-18 the missions check) and the real
 * `COMP_CLASSROOM_PORT` that BE-25's complimentary register injects. On init it binds `PerformanceClassesReadAdapter` into
 * BE-19's `PerformancePorts` (the reports' `ClassesReadPort`) and binds `TeacherClassroomsAdapter` into `UsersPorts`
 * (the admin teacher classrooms lookup).
 */
@Module({
  imports: [AuditModule, ThrottleModule, CurriculumModule, UsersModule, PerformanceModule],
  controllers: [TeacherClassesController, KelasSayaController],
  providers: [ClassesRepository, ClassesService, ClassesPorts, CompClassroomAdapter, TeacherClassroomsAdapter, PerformanceClassesReadAdapter, { provide: COMP_CLASSROOM_PORT, useExisting: CompClassroomAdapter }],
  exports: [ClassesRepository, ClassesPorts, COMP_CLASSROOM_PORT],
})
export class ClassesModule implements OnModuleInit {
  constructor(
    @Inject(PerformancePorts) private readonly performance: PerformancePorts,
    @Inject(PerformanceClassesReadAdapter) private readonly classesRead: PerformanceClassesReadAdapter,
    @Inject(UsersPorts) private readonly usersPorts: UsersPorts,
    @Inject(TeacherClassroomsAdapter) private readonly teacherClassrooms: TeacherClassroomsAdapter,
  ) {}

  /** Binds the real classes read port of BE-19's reports and the teacher classrooms lookup of the users module (once each; both `provide*` throw on a second call). */
  onModuleInit(): void {
    this.performance.provideClasses(this.classesRead)
    this.usersPorts.provideClassrooms(this.teacherClassrooms)
  }
}
