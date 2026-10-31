/**
 * M10 client functions (SRS M10 v1.18 §7 #1, #11–#17, #35–#44, #51–#60, #63, #73–#75; build-plan
 * M10-T1). UI tasks import these and do not change this file (build-plan §S.3 rule 5).
 *
 * Errors follow the shared conventions (`ApiError`, `VALIDATION_ERROR` with `fields`), except the
 * inline creates of #36, #38 and #42–#44, which answer `200 {error}` as live: those functions resolve
 * to the created record or to `{error}` and never throw for a refusal.
 */

import {
  api,
  isHttpMode,
  uploadQuestionImage,
  wireId,
  wireIdOpt,
  type BlobResult,
  type ListResult,
} from '@/api'

import type {
  BidangOption,
  ChapterOption,
  ClassQrData,
  ClassroomStudent,
  ContributedQuestion,
  ContributedQuestionDetail,
  Contributions,
  CreateClassRequest,
  CreateQuestionRequest,
  ErrorBodyLive,
  GuruClass,
  GuruDashboard,
  GuruStudent,
  GuruStudentsMeta,
  ImportResult,
  JoinClassResponse,
  JoinedClass,
  QuestionPaper,
  QuestionPaperRequest,
  RajahGallery,
  RemedialProgress,
  StudentQuestionSet,
  SkOption,
  SpOption,
  StudentTab,
  TopicOption,
  UpdateQuestionRequest,
} from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #1 `GET /api/guru/dashboard` (S1). */
export function fetchGuruDashboard(options: Signal = {}): Promise<GuruDashboard> {
  return api.get<GuruDashboard>('/api/guru/dashboard', withSignal(options))
}

/** #11 `GET /api/guru/remedial-progress` (S3). */
export function fetchRemedialProgress(options: Signal = {}): Promise<RemedialProgress> {
  return api.get<RemedialProgress>('/api/guru/remedial-progress', withSignal(options))
}

// --- classes (S4, S5) -----------------------------------------------------------------------

/** #12 `GET /api/guru/classes`: the viewer's own classes, newest first. */
export function fetchGuruClasses(options: Signal = {}): Promise<ListResult<GuruClass>> {
  return api.list<GuruClass>('/api/guru/classes', withSignal(options))
}

/**
 * #13 `POST /api/guru/classes` (422 with `fields`). `subjectId` and `schoolId` go out as string ids
 * in http mode (`ClassCreateRequestSchema`; a number is 422 "Sila pilih subjek.", D-01).
 */
export function createGuruClass(body: CreateClassRequest): Promise<GuruClass> {
  const { schoolId, subjectId, ...rest } = body
  return api.post<GuruClass>('/api/guru/classes', {
    body: {
      ...rest,
      ...(schoolId !== undefined ? { schoolId: wireIdOpt(schoolId) } : {}),
      subjectId: wireId(subjectId),
    },
  })
}

/** #14 `GET /api/guru/classes/:id/qr-data` (404 for a class the viewer does not own). */
export function fetchClassQrData(classId: number, options: Signal = {}): Promise<ClassQrData> {
  return api.get<ClassQrData>(`/api/guru/classes/${String(classId)}/qr-data`, withSignal(options))
}

// --- students (S6) --------------------------------------------------------------------------

/** #15 `GET /api/guru/students?tab=&search=`. */
export function fetchGuruStudents(
  params: { tab?: StudentTab; search?: string } = {},
  options: Signal = {},
): Promise<{ data: GuruStudent[]; meta: GuruStudentsMeta }> {
  return api.get<{ data: GuruStudent[]; meta: GuruStudentsMeta }>('/api/guru/students', {
    query: { tab: params.tab, search: params.search },
    raw: true,
    ...withSignal(options),
  })
}

/**
 * #16 `PUT /api/guru/students/:id`: adds a student of the profile school to an own class.
 * `classroomId` goes out as a string id in http mode (`ClassStudentAddRequestSchema`; a number is
 * 422 "Kelas tidak sah.", SW5-01). Mock mode keeps the number.
 */
export function addStudentToClass(
  studentId: number,
  body: { classroomId: number | string },
): Promise<ClassroomStudent> {
  return api.put<ClassroomStudent>(`/api/guru/students/${String(studentId)}`, {
    body: { classroomId: wireId(body.classroomId) },
  })
}

/** #17 `DELETE /api/guru/students/:id?classroomId=`: removes a student from an own class. */
export function removeStudentFromClass(
  studentId: number,
  classroomId: number,
): Promise<{ removed: number }> {
  return api.delete<{ removed: number }>(`/api/guru/students/${String(studentId)}`, {
    query: { classroomId },
  })
}

// --- chapters, topics, DSKP (S16, S18, S22) -------------------------------------------------

/** #35 `GET /api/guru/chapters` (a bare array; a missing parameter gives `[]`). */
export function fetchChapters(
  params: { subjectId?: number; educationLevelId?: number },
  options: Signal = {},
): Promise<ChapterOption[]> {
  return api.get<ChapterOption[]>('/api/guru/chapters', { query: params, ...withSignal(options) })
}

/** #36 `POST /api/guru/chapters`: the new chapter, or `{error}` (status 200, as live). */
export function createChapter(body: {
  subjectId: number
  educationLevelId: number
  name: string
  chapterNumber: number
}): Promise<ChapterOption | ErrorBodyLive> {
  // The contract ids are opaque strings (refId): http mode sends them as strings.
  return api.post<ChapterOption | ErrorBodyLive>('/api/guru/chapters', {
    body: {
      ...body,
      subjectId: wireId(body.subjectId),
      educationLevelId: wireId(body.educationLevelId),
    },
  })
}

/** #37 `GET /api/guru/topics?chapterId=` (a bare array). */
export function fetchTopics(chapterId: number, options: Signal = {}): Promise<TopicOption[]> {
  return api.get<TopicOption[]>('/api/guru/topics', {
    query: { chapterId },
    ...withSignal(options),
  })
}

/** #38 `POST /api/guru/topics`: the new topic, or `{error}`. */
export function createTopic(body: {
  chapterId: number
  name: string
}): Promise<TopicOption | ErrorBodyLive> {
  return api.post<TopicOption | ErrorBodyLive>('/api/guru/topics', {
    body: { ...body, chapterId: wireId(body.chapterId) },
  })
}

/** #39 `GET /api/guru/dskp/bidang` (a bare array). */
export function fetchBidang(
  params: { subjectId?: number; educationLevelId?: number },
  options: Signal = {},
): Promise<BidangOption[]> {
  return api.get<BidangOption[]>('/api/guru/dskp/bidang', {
    query: params,
    ...withSignal(options),
  })
}

/** #40 `GET /api/guru/dskp/sk?bidangId=`. */
export function fetchSk(bidangId: number, options: Signal = {}): Promise<SkOption[]> {
  return api.get<SkOption[]>('/api/guru/dskp/sk', { query: { bidangId }, ...withSignal(options) })
}

/** #41 `GET /api/guru/dskp/sp?skId=`. */
export function fetchSp(skId: number, options: Signal = {}): Promise<SpOption[]> {
  return api.get<SpOption[]>('/api/guru/dskp/sp', { query: { skId }, ...withSignal(options) })
}

/** #42 `POST /api/guru/dskp/bidang`: the new Bidang, or `{error}`. */
export function createBidang(body: {
  subjectId: number
  educationLevelId: number
  code: string
  name: string
}): Promise<BidangOption | ErrorBodyLive> {
  return api.post<BidangOption | ErrorBodyLive>('/api/guru/dskp/bidang', { body })
}

/** #43 `POST /api/guru/dskp/sk`: the new SK, or `{error}`. */
export function createSk(body: {
  bidangId: number
  code: string
  description: string
}): Promise<SkOption | ErrorBodyLive> {
  return api.post<SkOption | ErrorBodyLive>('/api/guru/dskp/sk', { body })
}

/** #44 `POST /api/guru/dskp/sp`: the new SP, or `{error}`. */
export function createSp(body: {
  skId: number
  code: string
  description: string
}): Promise<SpOption | ErrorBodyLive> {
  return api.post<SpOption | ErrorBodyLive>('/api/guru/dskp/sp', { body })
}

// --- contributions and questions (S21–S24) --------------------------------------------------

/** #51 `GET /api/guru/contributions` (S21 cards, tiers and subject breakdown). */
export function fetchContributions(options: Signal = {}): Promise<Contributions> {
  return api.get<Contributions>('/api/guru/contributions', withSignal(options))
}

/** #52 `GET /api/guru/questions?page=`: "Soalan Saya", ids ascending, 20 per page. */
export function fetchContributedQuestions(
  params: { page?: number } = {},
  options: Signal = {},
): Promise<ListResult<ContributedQuestion>> {
  return api.list<ContributedQuestion>('/api/guru/questions', {
    query: { page: params.page },
    ...withSignal(options),
  })
}

/** Image files of #53: the question image and one optional image per option (A–D = index 0–3). */
export interface QuestionImages {
  questionImage?: Blob | null
  optionImages?: readonly (Blob | null | undefined)[]
}

/** Writes `body` into `form`: arrays as `key[]`, arrays of objects as `key[i][field]`. */
function appendFields(form: FormData, body: object): void {
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) {
      value.forEach((v: unknown, i) => {
        if (typeof v === 'object' && v !== null) {
          for (const [k, x] of Object.entries(v)) {
            form.append(`${key}[${String(i)}][${k}]`, String(x))
          }
        } else form.append(`${key}[]`, String(v))
      })
    } else form.append(key, String(value))
  }
}

/**
 * #53 `POST /api/guru/questions`: the new question (`pending_review`, active). Mock mode: with any
 * image the request is multipart (`questionImage`, `optionImages[i]`), otherwise JSON. http mode: every
 * chosen image is uploaded first (`POST /api/files`; a failure is a 422 on `questionImage` /
 * `optionImages.<i>`) and the JSON carries `questionImageFileId` / `optionImageFileIds`. The second argument
 * is a `QuestionImages`, or a single Blob (the question image, the earlier signature).
 */
export async function createContributedQuestion(
  body: CreateQuestionRequest,
  images?: Blob | QuestionImages | null,
): Promise<ContributedQuestionDetail> {
  const files: QuestionImages = images instanceof Blob ? { questionImage: images } : (images ?? {})
  const optionFiles = (files.optionImages ?? []).flatMap((f, i) => (f ? [[i, f] as const] : []))
  // The contract ids are opaque strings (`idWith` / `idOrBlank`): http mode sends them as strings
  // (a number is 422 "Sila pilih tahap pendidikan." etc., SW7-08). null stays null, undefined absent.
  const wired = {
    ...body,
    educationLevelId: wireId(body.educationLevelId),
    subjectId: wireId(body.subjectId),
    ...(body.curriculumChapterId !== undefined
      ? { curriculumChapterId: wireIdOpt(body.curriculumChapterId) }
      : {}),
    ...(body.curriculumTopicId !== undefined
      ? { curriculumTopicId: wireIdOpt(body.curriculumTopicId) }
      : {}),
    ...(body.dskpSpId !== undefined ? { dskpSpId: wireIdOpt(body.dskpSpId) } : {}),
  }
  if (isHttpMode()) {
    const ids: { questionImageFileId?: string; optionImageFileIds?: (string | null)[] } = {}
    if (files.questionImage) {
      ids.questionImageFileId = await uploadQuestionImage(files.questionImage, 'questionImage')
    }
    const last = optionFiles[optionFiles.length - 1]?.[0]
    if (last !== undefined) {
      const picked = files.optionImages ?? []
      const list: (string | null)[] = []
      for (let i = 0; i <= last; i += 1) {
        const f = picked[i]
        list.push(f ? await uploadQuestionImage(f, `optionImages.${String(i)}`) : null)
      }
      ids.optionImageFileIds = list
    }
    return api.post<ContributedQuestionDetail>('/api/guru/questions', {
      body: { ...wired, ...ids },
    })
  }
  if (!files.questionImage && optionFiles.length === 0) {
    return api.post<ContributedQuestionDetail>('/api/guru/questions', { body: wired })
  }
  const form = new FormData()
  appendFields(form, wired)
  if (files.questionImage) form.append('questionImage', files.questionImage)
  for (const [i, f] of optionFiles) form.append(`optionImages[${String(i)}]`, f)
  return api.multipart<ContributedQuestionDetail>('/api/guru/questions', form)
}

/** #54 `GET /api/guru/questions/:id` (404 when not own). */
export function fetchContributedQuestion(
  id: number,
  options: Signal = {},
): Promise<ContributedQuestionDetail> {
  return api.get<ContributedQuestionDetail>(
    `/api/guru/questions/${String(id)}`,
    withSignal(options),
  )
}

/**
 * #55 `PUT /api/guru/questions/:id` (404 when not own, 422). Mock mode: with an `image` the request is
 * one multipart PUT (the options as `options[i][id]` / `options[i][optionText]`), otherwise JSON. http
 * mode: the image is uploaded first and the JSON carries `questionImageFileId`.
 */
export async function updateContributedQuestion(
  id: number,
  body: UpdateQuestionRequest,
  image?: Blob | null,
): Promise<ContributedQuestionDetail> {
  const url = `/api/guru/questions/${String(id)}`
  if (!image) return api.put<ContributedQuestionDetail>(url, { body })
  if (isHttpMode()) {
    const questionImageFileId = await uploadQuestionImage(image, 'questionImage')
    return api.put<ContributedQuestionDetail>(url, { body: { ...body, questionImageFileId } })
  }
  const form = new FormData()
  appendFields(form, body)
  form.append('questionImage', image)
  return api.multipart<ContributedQuestionDetail>(url, form, { method: 'PUT' })
}

/** #56 `DELETE /api/guru/questions/:id` (404 when not own). */
export function deleteContributedQuestion(id: number): Promise<{ removed: number }> {
  return api.delete<{ removed: number }>(`/api/guru/questions/${String(id)}`)
}

/** #57 `GET /api/guru/questions/template`: the CSV file `template-import-soalan.csv`. */
export function downloadQuestionTemplate(): Promise<BlobResult> {
  return api.blob('/api/guru/questions/template')
}

/** #58 `POST /api/guru/questions/import` (multipart `csvFile`): valid rows kept, bad rows listed. */
export function importQuestions(csvFile: Blob): Promise<ImportResult> {
  const form = new FormData()
  form.append('csvFile', csvFile)
  return api.multipart<ImportResult>('/api/guru/questions/import', form)
}

// --- student "Kelas Saya" (S33) -------------------------------------------------------------

/** #73 `GET /api/kelas-saya`: the classes the signed-in user has joined. */
export function fetchJoinedClasses(options: Signal = {}): Promise<ListResult<JoinedClass>> {
  return api.list<JoinedClass>('/api/kelas-saya', withSignal(options))
}

/** #74 `POST /api/kelas-saya/join` (404 unknown code, 409 already joined; the `message` is shown). */
export function joinClass(classCode: string): Promise<JoinClassResponse> {
  return api.post<JoinClassResponse>('/api/kelas-saya/join', { body: { classCode }, raw: true })
}

// --- student "Set Soalan Guru" (S34) --------------------------------------------------------

/** #75 `GET /api/set-soalan-saya`: the sets the signed-in user may start (BR-M10-18). */
export function fetchMyQuestionSets(options: Signal = {}): Promise<ListResult<StudentQuestionSet>> {
  return api.list<StudentQuestionSet>('/api/set-soalan-saya', withSignal(options))
}

// --- gallery, question papers, Audio KBAT templates (S21, S22) --------------------------------

/** #59 `GET /api/guru/galeri-rajah`: always empty (DV-M10-09); `?folder=` answers `{images: []}`. */
export function fetchRajahGallery(folder?: string, options: Signal = {}): Promise<RajahGallery> {
  return api.get<RajahGallery>('/api/guru/galeri-rajah', {
    query: { folder },
    ...withSignal(options),
  })
}

/**
 * #60 `POST /api/guru/question-papers` (multipart; 422 with `fields`): a paper for the admin, stored
 * `pending` by M04. `files` are 1–5 PDF / Word / Excel files of at most 20 MB each.
 */
export function submitQuestionPaper(
  body: QuestionPaperRequest,
  files: readonly Blob[],
): Promise<QuestionPaper> {
  const form = new FormData()
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== '') form.append(key, String(value))
  }
  for (const f of files) form.append('files[]', f)
  return api.multipart<QuestionPaper>('/api/guru/question-papers', form)
}

/** #63 `GET /api/guru/audio-kbat/template` (`xlsx`: the "Template XLSX" link, served as `template-audio-kbat.csv`) or `/template-word` (`word`: a real `.docx`): the template file. */
export function downloadAudioKbatTemplate(format: 'xlsx' | 'word'): Promise<BlobResult> {
  return api.blob(
    format === 'xlsx' ? '/api/guru/audio-kbat/template' : '/api/guru/audio-kbat/template-word',
  )
}
