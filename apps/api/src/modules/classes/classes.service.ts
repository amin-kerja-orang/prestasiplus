import { Inject, Injectable } from '@nestjs/common'
import {
  CLASS_MESSAGES,
  ClassCreateRequestSchema,
  ClassJoinRequestSchema,
  ClassStudentAddRequestSchema,
  ClassStudentRemoveQuerySchema,
  TEACHER_SCHOOL_TAB_LIMIT,
  TeacherChapterCreateRequestSchema,
  TeacherTopicCreateRequestSchema,
  classJoinedText,
  type ClassQrData,
  type TeacherClass,
  type TeacherContributions,
  type TeacherDashboard,
} from '@pp/contract'
import { ConfigService } from '@nestjs/config'

import { AuditService } from '../../common/audit'
import type { Env } from '../../common/config/env.schema'
import { publicBaseUrl } from '../../common/config/public-base-url'
import { ApiError } from '../../common/errors/api-error'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock, mytDay } from '../../db/clock'
import { idFromString, idToString, isIdString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { CurriculumRepository } from '../curriculum'
import type { ClassActor } from './actor'
import {
  CLASS_AUDIT,
  CONTRIBUTION_BREAKDOWN_REST_LABEL,
  CONTRIBUTION_BREAKDOWN_TOP,
  CONTRIBUTION_TIERS,
  JOIN_ROLES,
} from './classes.constants'
import { gradeOfLevel, toTeacherClass, type ClassNames } from './classes.mapper'
import { ClassesRepository, type ClassRecord } from './classes.repository'
import { gradeOfSlug, levelLabelOfGrade } from './level-slug'
import { ClassesPorts } from './ports'
import { invalid, parseStrict, tryParseStrict } from './strict-body'
import type { ClassEnrolment, ClassJoinedClass, TeacherChapterOption, TeacherStudent, TeacherTopicOption } from './types'

const notFound = (message?: string): ApiError => ApiError.of('NOT_FOUND', message ? { message } : {})
const forbidden = (message: string): ApiError => ApiError.of('FORBIDDEN', { message })

/** A canonical decimal id that is not zero (the mock's `intOf(value) >= 1`). */
const isRealId = (s: unknown): s is string => typeof s === 'string' && isIdString(s) && s !== '0'

/** A query value that is a plain string (Express gives an array for a repeated key). */
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

@Injectable()
export class ClassesService {
  constructor(
    @Inject(ClassesRepository) private readonly repo: ClassesRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(ClassesPorts) private readonly ports: ClassesPorts,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  // --- classes (S4, S5) ---------------------------------------------------------------------------------

  private async namesOf(classes: readonly ClassRecord[]): Promise<ClassNames> {
    const [subjectNames, levels] = await Promise.all([
      this.repo.subjectNames(classes.map((c) => c.subjectId)),
      this.repo.levelGrades(classes.map((c) => c.educationLevelId)),
    ])
    return { subjectNames, levels }
  }

  /** Own classes, newest first, active and inactive. */
  async listClasses(actor: ClassActor): Promise<TeacherClass[]> {
    const classes = await this.repo.forTeacher(actor.userId)
    const [names, counts] = await Promise.all([this.namesOf(classes), this.repo.memberCounts(classes.map((c) => c.id))])
    return classes.flatMap((c) => {
      const view = toTeacherClass(c, counts.get(c.id) ?? 0, names)
      return view ? [view] : []
    })
  }

  /**
   * `POST /guru/classes` (FR-M10-34): the owner is the caller; `name`, `subjectId` (an active subject) and
   * `educationLevel` are required; `schoolId` is optional and defaults to the teacher's own school (SW7-01: a class
   * without a school would be invisible to the school admin), staying null only for a teacher without one. All failing
   * fields are reported together, like the mock.
   */
  async createClass(actor: ClassActor, raw: unknown): Promise<TeacherClass> {
    const parsed = tryParseStrict(ClassCreateRequestSchema, raw)
    const fields: Record<string, string> = { ...parsed.fields }
    const body = parsed.data

    let subjectId: string | null = null
    let levelId: string | null = null
    let schoolId: string | null = actor.schoolId
    if (body) {
      if (isRealId(body.subjectId) && (await this.repo.activeSubjectExists(body.subjectId))) subjectId = body.subjectId
      else fields.subjectId = CLASS_MESSAGES.subject

      const grade = gradeOfSlug(body.educationLevel)
      const level = grade === null ? null : await this.curriculum.levelForGrade(grade)
      if (level) levelId = idToString(level.id)
      else fields.educationLevel = CLASS_MESSAGES.level

      if (body.schoolId !== undefined && body.schoolId !== null && body.schoolId !== '') {
        // A class is attached to the teacher's own school only: the school is part of the teacher's scope, so another
        // school's id is refused with the same text as an unknown school (a deliberate tightening of the mock).
        if (isRealId(body.schoolId) && body.schoolId === actor.schoolId && (await this.repo.schoolExists(body.schoolId))) schoolId = body.schoolId
        else fields.schoolId = CLASS_MESSAGES.school
      }
    }
    if (Object.keys(fields).length > 0 || !body || subjectId === null || levelId === null) throw invalid(fields)

    const now = this.clock.now()
    const description = body.description ? body.description : null
    const created = await this.prisma.transaction(async (tx) => {
      const row = await this.repo.createClass({
        name: body.name,
        teacherId: actor.userId,
        schoolId,
        subjectId,
        educationLevelId: levelId,
        academicYear: Number(mytDay(now).slice(0, 4)),
        description,
        now,
      })
      await this.audit.record({
        tx,
        action: CLASS_AUDIT.CLASS_CREATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.auth.sessionRowId,
        targetType: 'classroom',
        targetId: row.id,
        schoolId: row.schoolId,
        scopeLevel: actor.auth.active.scope.level,
        requestId: actor.requestId,
        ip: actor.ip,
        details: { subjectId, educationLevelId: levelId },
      })
      return row
    })
    const names = await this.namesOf([created])
    const view = toTeacherClass(created, 0, names)
    if (!view) throw ApiError.of('SERVER_ERROR')
    return view
  }

  /** The class of the caller (kind `classroom`, own `teacher_id`); every other id is a generic 404 (SEC-M10-02). */
  private async ownClass(actor: ClassActor, id: string): Promise<ClassRecord> {
    const cls = isIdString(id) ? await this.repo.get(id) : null
    if (!cls || cls.kind !== 'classroom' || cls.teacherId !== actor.userId) throw notFound()
    return cls
  }

  /** `GET /guru/classes/:id/qr-data`: bare `{ name, school, joinUrl }`. */
  async qrData(actor: ClassActor, id: string): Promise<ClassQrData> {
    const cls = await this.ownClass(actor, id)
    const schools = await this.repo.schoolNames([cls.schoolId])
    const base = publicBaseUrl(this.config)
    return {
      name: cls.name,
      school: cls.schoolId === null ? null : (schools.get(cls.schoolId) ?? null),
      joinUrl: `${base}/kelas-saya?kod=${encodeURIComponent(cls.joinCode ?? '')}`,
    }
  }

  // --- roster (S6) --------------------------------------------------------------------------------------

  /** `GET /guru/students?tab=mine|school&search=` (BR-M10-04, BR-M10-30). */
  async students(actor: ClassActor, query: Record<string, unknown>) {
    const tab = str(query.tab) === 'school' ? 'school' : 'mine'
    const term = (str(query.search) ?? '').trim()
    const schoolSet = actor.schoolId !== null
    const classesOf = await this.repo.classesByStudent(actor.userId)

    let lines
    let count: number
    if (tab === 'school') {
      if (actor.schoolId === null) return { data: [] as TeacherStudent[], meta: { count: 0, schoolSet: false } }
      const page = await this.repo.schoolStudentLines(actor.schoolId, term, TEACHER_SCHOOL_TAB_LIMIT)
      lines = page.rows
      count = page.total
    } else {
      lines = await this.repo.studentLines(await this.repo.teacherStudentIds(actor.userId), term)
      count = lines.length
    }
    const levelNames = new Map<number, string | null>()
    for (const grade of new Set(lines.flatMap((l) => (l.grade === null ? [] : [l.grade])))) {
      levelNames.set(grade, (await this.curriculum.levelForGrade(grade))?.name ?? null)
    }
    const data: TeacherStudent[] = lines.map((l) => {
      const classes = classesOf.get(l.id) ?? []
      return {
        id: l.id,
        name: l.name,
        levelName: l.grade === null ? null : (levelNames.get(l.grade) ?? null),
        classNames: classes.map((c) => c.name),
        classes,
      }
    })
    return { data, meta: { count, schoolSet } }
  }

  /**
   * The class a roster move names. Order of the mock: unusable id 422, unknown class 404, another teacher's class 403.
   * A class of another school is unknown to the caller (404, never 403), so the class ids of other schools do not leak.
   */
  private async rosterClass(actor: ClassActor, classroomId: string): Promise<ClassRecord> {
    const cls = await this.repo.get(classroomId)
    const visible =
      cls !== null && cls.kind === 'classroom' && (cls.teacherId === actor.userId || (actor.schoolId !== null && cls.schoolId === actor.schoolId))
    if (!visible) throw notFound(CLASS_MESSAGES.classroom)
    if (cls.teacherId !== actor.userId) throw forbidden(CLASS_MESSAGES.classNotOwn)
    return cls
  }

  /** `PUT /guru/students/:id` (FR-M10-35..37): adds a pupil of the teacher's school to an own class. */
  async addStudent(actor: ClassActor, studentId: string, raw: unknown): Promise<ClassEnrolment> {
    const parsed = tryParseStrict(ClassStudentAddRequestSchema, raw)
    if (parsed.fields || !isRealId(parsed.data.classroomId)) throw invalid(parsed.fields ?? { classroomId: CLASS_MESSAGES.classroom })
    const student = await this.repo.studentFacts(studentId)
    if (!student) throw notFound(CLASS_MESSAGES.studentNotFound)
    const cls = await this.rosterClass(actor, parsed.data.classroomId)
    if (actor.schoolId === null || student.schoolId !== actor.schoolId) throw forbidden(CLASS_MESSAGES.studentOtherSchool)
    if (await this.repo.isMember(cls.id, student.id)) throw ApiError.of('CONFLICT', { message: CLASS_MESSAGES.alreadyInClass })

    const now = this.clock.now()
    const { outcome, enrolment } = await this.prisma.transaction(async (tx) => {
      const res = await this.repo.enrol({ classroomId: cls.id, studentId: student.id, source: 'teacher', now })
      if (res.outcome !== 'already') {
        await this.audit.record({
          tx,
          action: CLASS_AUDIT.STUDENT_ADDED,
          actorUserId: actor.userId,
          actorRole: actor.role,
          sessionRowId: actor.auth.sessionRowId,
          targetType: 'classroom',
          targetId: cls.id,
          schoolId: cls.schoolId,
          scopeLevel: actor.auth.active.scope.level,
          requestId: actor.requestId,
          ip: actor.ip,
          details: { studentId: student.id },
        })
      }
      return res
    })
    if (outcome === 'already') throw ApiError.of('CONFLICT', { message: CLASS_MESSAGES.alreadyInClass })
    return {
      classroomKind: 'classroom',
      classroomId: enrolment.classroomId,
      studentId: enrolment.studentId,
      status: enrolment.status,
      source: enrolment.source,
      joinedAt: toMytTimestamp(enrolment.joinedAt),
    }
  }

  /** `DELETE /guru/students/:id?classroomId=`: the enrolment becomes `removed` (the row stays). */
  async removeStudent(actor: ClassActor, studentId: string, query: Record<string, unknown>): Promise<{ removed: 1 }> {
    const parsed = ClassStudentRemoveQuerySchema.safeParse({ classroomId: str(query.classroomId) })
    if (!parsed.success || !isRealId(parsed.data.classroomId)) throw invalid({ classroomId: CLASS_MESSAGES.classroom })
    const cls = await this.rosterClass(actor, parsed.data.classroomId)
    const now = this.clock.now()
    const removed = await this.prisma.transaction(async (tx) => {
      const done = await this.repo.unenrol(cls.id, studentId, now)
      if (done) {
        await this.audit.record({
          tx,
          action: CLASS_AUDIT.STUDENT_REMOVED,
          actorUserId: actor.userId,
          actorRole: actor.role,
          sessionRowId: actor.auth.sessionRowId,
          targetType: 'classroom',
          targetId: cls.id,
          schoolId: cls.schoolId,
          scopeLevel: actor.auth.active.scope.level,
          requestId: actor.requestId,
          ip: actor.ip,
          details: { studentId },
        })
      }
      return done
    })
    if (!removed) throw notFound(CLASS_MESSAGES.notInClass)
    return { removed: 1 }
  }

  // --- dashboard (S1) -----------------------------------------------------------------------------------

  /** `GET /guru/dashboard`: every counter is computed from the tables on each call (no stored aggregate). */
  async dashboard(actor: ClassActor): Promise<TeacherDashboard> {
    const own = await this.repo.forTeacher(actor.userId)
    const active = own.filter((c) => c.isActive)
    const [students, counts, stats, hasMission] = await Promise.all([
      this.repo.teacherStudentIds(actor.userId),
      this.repo.memberCounts(active.map((c) => c.id)),
      this.ports.questions.statsOf(actor.userId),
      this.ports.missions.hasMission(actor.userId),
    ])
    return {
      checklist: { hasClass: own.length > 0, hasStudents: students.length > 0, hasMission },
      stats: {
        activeClasses: active.length,
        totalClasses: own.length,
        students: students.length,
        questions: stats.total,
        questionsApproved: stats.approved,
        assignments: 0,
      },
      today: { students: [], topics: [], actions: [] },
      peerTutor: [],
      classes: active.map((c) => ({ id: c.id, name: c.name, studentCount: counts.get(c.id) ?? 0 })),
      submissions: [],
    }
  }

  // --- chapters and topics (M03 data; BE-08 owns the tables) -----------------------------------------------

  /** `GET /guru/chapters`: active chapters of a subject and level; a missing, malformed or unknown parent gives `[]`. */
  async chapters(query: Record<string, unknown>): Promise<TeacherChapterOption[]> {
    const subjectId = str(query.subjectId)
    const levelId = str(query.educationLevelId)
    if (subjectId === undefined || levelId === undefined || !isIdString(subjectId) || !isIdString(levelId)) return []
    const rows = await this.curriculum.chapters(idFromString(subjectId), idFromString(levelId), { active: true })
    return rows.map((c) => ({ id: idToString(c.id), chapterNumber: c.chapterNumber, name: c.name ?? '' }))
  }

  /** `GET /guru/topics`: active topics of a chapter; a missing, malformed or unknown chapter gives `[]`. */
  async topics(query: Record<string, unknown>): Promise<TeacherTopicOption[]> {
    const chapterId = str(query.chapterId)
    if (chapterId === undefined || !isIdString(chapterId)) return []
    const id = idFromString(chapterId)
    if (!(await this.curriculum.chapter(id))) return []
    const rows = await this.curriculum.topics(id)
    return rows.filter((t) => t.isActive).map((t) => ({ id: idToString(t.id), topicNumber: t.topicNumber, name: t.name }))
  }

  /** `POST /guru/chapters`: the inline "Bab Baru". A refusal is the standard 422 (the mock answered 200 `{ error }`). */
  async createChapter(actor: ClassActor, raw: unknown): Promise<TeacherChapterOption> {
    const parsed = tryParseStrict(TeacherChapterCreateRequestSchema, raw)
    const fields: Record<string, string> = { ...parsed.fields }
    const body = parsed.data
    if (body) {
      if (!isRealId(body.subjectId) || !(await this.curriculum.subject(idFromString(body.subjectId)))) fields.subjectId = CLASS_MESSAGES.chapterParent
      if (!isRealId(body.educationLevelId) || !(await this.curriculum.level(idFromString(body.educationLevelId)))) {
        fields.educationLevelId = CLASS_MESSAGES.chapterParent
      }
    }
    if (Object.keys(fields).length > 0 || !body) throw invalid(fields)

    const row = await this.prisma.transaction(async (tx) => {
      const created = await this.curriculum.createChapter(
        {
          subjectId: idFromString(body.subjectId),
          educationLevelId: idFromString(body.educationLevelId),
          name: body.name,
          nameEn: null,
          chapterNumber: body.chapterNumber,
          description: null,
        },
        this.clock.now(),
      )
      await this.audit.record({
        tx,
        action: CLASS_AUDIT.CHAPTER_CREATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.auth.sessionRowId,
        targetType: 'chapter',
        targetId: idToString(created.id),
        scopeLevel: actor.auth.active.scope.level,
        requestId: actor.requestId,
        ip: actor.ip,
      })
      return created
    })
    return { id: idToString(row.id), chapterNumber: row.chapterNumber, name: row.name ?? body.name }
  }

  /** `POST /guru/topics`: the inline "Topik Baru", numbered one above the chapter's highest number. */
  async createTopic(actor: ClassActor, raw: unknown): Promise<TeacherTopicOption> {
    const parsed = tryParseStrict(TeacherTopicCreateRequestSchema, raw)
    const fields: Record<string, string> = { ...parsed.fields }
    const body = parsed.data
    if (body && (!isRealId(body.chapterId) || !(await this.curriculum.chapter(idFromString(body.chapterId))))) {
      fields.chapterId = CLASS_MESSAGES.topicParent
    }
    if (Object.keys(fields).length > 0 || !body) throw invalid(fields)

    const chapterId = idFromString(body.chapterId)
    const row = await this.prisma.transaction(async (tx) => {
      const existing = await this.curriculum.topics(chapterId)
      const next = Math.max(0, ...existing.map((t) => Number.parseInt(t.topicNumber ?? '', 10) || 0)) + 1
      const created = await this.curriculum.createTopic(
        chapterId,
        { name: body.name, nameEn: null, topicNumber: String(next), description: null, learningStandard: null },
        this.clock.now(),
      )
      await this.audit.record({
        tx,
        action: CLASS_AUDIT.TOPIC_CREATED,
        actorUserId: actor.userId,
        actorRole: actor.role,
        sessionRowId: actor.auth.sessionRowId,
        targetType: 'topic',
        targetId: idToString(created.id),
        scopeLevel: actor.auth.active.scope.level,
        requestId: actor.requestId,
        ip: actor.ip,
      })
      return created
    })
    return { id: idToString(row.id), topicNumber: row.topicNumber, name: row.name }
  }

  // --- contributions and gallery (S21) --------------------------------------------------------------------

  /** `GET /guru/contributions`: counters from the question bank port (zeros until BE-09), the eight tiers, the subject breakdown. */
  async contributions(actor: ClassActor): Promise<TeacherContributions> {
    const stats = await this.ports.questions.statsOf(actor.userId)
    const named = [...stats.bySubject].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    const rest = named.slice(CONTRIBUTION_BREAKDOWN_TOP).reduce((sum, r) => sum + r.count, 0)
    const breakdown = named.slice(0, CONTRIBUTION_BREAKDOWN_TOP)
    if (rest > 0) breakdown.push({ label: CONTRIBUTION_BREAKDOWN_REST_LABEL, count: rest })
    const tiers = CONTRIBUTION_TIERS.map((t) => ({ ...t, reached: stats.total >= t.threshold }))
    const next = tiers.find((t) => !t.reached)
    return {
      stats: { total: stats.total, approved: stats.approved, pending: stats.pending, used: stats.used },
      tiers,
      nextTier: next ? { name: next.name, threshold: next.threshold } : null,
      breakdown,
    }
  }

  /** `GET /guru/galeri-rajah`: the empty gallery of the prototype (D22). */
  gallery(query: Record<string, unknown>): { folders: [] } | { images: [] } {
    const folder = query.folder
    const has = typeof folder === 'string' ? folder.trim() !== '' : Array.isArray(folder)
    return has ? { images: [] } : { folders: [] }
  }

  // --- Kelas Saya (S33) ----------------------------------------------------------------------------------

  /** `GET /kelas-saya`: the teacher classes the caller is actively enrolled in, newest first (school classes are not "joined"). */
  async joinedClasses(actor: ClassActor): Promise<ClassJoinedClass[]> {
    const classes = (await this.repo.forStudent(actor.userId, { isTest: actor.isTest })).filter((c) => c.kind === 'classroom')
    const [names, teachers] = await Promise.all([this.namesOf(classes), this.repo.userNames(classes.map((c) => c.teacherId))])
    return classes.flatMap((c) => {
      const grade = gradeOfLevel(names.levels.get(c.educationLevelId))
      if (grade === null) return []
      return [
        {
          id: c.id,
          name: c.name,
          subjectName: c.subjectId === null ? null : (names.subjectNames.get(c.subjectId) ?? null),
          teacherName: c.teacherId === null ? null : (teachers.get(c.teacherId) ?? null),
          levelLabel: levelLabelOfGrade(grade),
        },
      ]
    })
  }

  /** `POST /kelas-saya/join` (BR-M10-02, FR-M10-39). Only a student (or the admin, who has the screen) may join. */
  async join(actor: ClassActor, raw: unknown): Promise<{ data: { classroomId: string }; message: string }> {
    if (!(JOIN_ROLES as readonly string[]).includes(actor.role)) throw ApiError.of('FORBIDDEN')
    const body = parseStrict(ClassJoinRequestSchema, raw)
    const cls = await this.repo.findByJoinCode(body.classCode)
    if (!cls) throw notFound(CLASS_MESSAGES.joinNotFound)
    if (await this.repo.isMember(cls.id, actor.userId, actor.isTest)) throw ApiError.of('CONFLICT', { message: CLASS_MESSAGES.joinAlready })

    const now = this.clock.now()
    const { outcome } = await this.prisma.transaction(async (tx) => {
      const res = await this.repo.enrol({ classroomId: cls.id, studentId: actor.userId, source: 'code', isTest: actor.isTest, now })
      if (res.outcome !== 'already') {
        await this.audit.record({
          tx,
          action: CLASS_AUDIT.JOINED,
          actorUserId: actor.userId,
          actorRole: actor.role,
          sessionRowId: actor.auth.sessionRowId,
          targetType: 'classroom',
          targetId: cls.id,
          schoolId: cls.schoolId,
          scopeLevel: actor.auth.active.scope.level,
          requestId: actor.requestId,
          ip: actor.ip,
          details: { source: 'code' },
          isTest: actor.isTest,
        })
      }
      return res
    })
    if (outcome === 'already') throw ApiError.of('CONFLICT', { message: CLASS_MESSAGES.joinAlready })
    return { data: { classroomId: cls.id }, message: classJoinedText(cls.name) }
  }
}
