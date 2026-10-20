import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { COMP_CLASSROOM_PORT } from '../subscriptions/comp-students/classroom.port'
import { CurriculumModule } from '../curriculum'
import { ClassesRepository } from './classes.repository'
import { ClassesService } from './classes.service'
import { CompClassroomAdapter } from './comp-classroom.adapter'
import { KelasSayaController } from './kelas-saya.controller'
import { ClassesPorts } from './ports'
import { TeacherClassesController } from './teacher.controller'

/**
 * Classes and teacher basics (M10 part A, BE-17): classrooms, enrolments, teacher profiles, the teacher routes
 * under `/api/guru` and the student "Kelas Saya" pair. It exports `ClassesRepository`, the only doorway to the
 * class tables (`forTeacher`, `forStudent`, `roster`, `schoolClasses`, `findByJoinCode`, `memberIds`, `enrol`),
 * `ClassesPorts` (BE-09 plugs in the teacher question counts, BE-18 the missions check) and the real
 * `COMP_CLASSROOM_PORT` that BE-25's complimentary register injects.
 */
@Module({
  imports: [AuditModule, ThrottleModule, CurriculumModule],
  controllers: [TeacherClassesController, KelasSayaController],
  providers: [ClassesRepository, ClassesService, ClassesPorts, CompClassroomAdapter, { provide: COMP_CLASSROOM_PORT, useExisting: CompClassroomAdapter }],
  exports: [ClassesRepository, ClassesPorts, COMP_CLASSROOM_PORT],
})
export class ClassesModule {}
