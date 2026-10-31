import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * Admin Studio write side (R1-F03a/b, T13). A shared stimulus is ONE group (D90): a figure, passage, table or diagram that
 * several questions refer to ("Rajah 1" for S1 and S2) is stored once, shown once with every member question under it, and
 * carries no marks. The group is the unit; its members are ordinary questions (`questions.group_id`, `group_position`).
 *
 * These schemas are exported from the package index but are NOT yet registered as OpenAPI paths: `openapi.json` belongs to
 * another lane until it is merged, and `npm run check` fails when a registered path is missing from it.
 */

/** The seven kinds a Studio author may pick (V2 Langkah 2 "Jenis rangsangan"); `audio` is a separate content type. */
export const STUDIO_STIMULUS_KINDS = ['passage', 'image', 'diagram', 'table', 'map', 'infographic', 'graph'] as const
export const StudioStimulusKindSchema = z.enum(STUDIO_STIMULUS_KINDS, 'Jenis rangsangan tidak sah.').meta({ id: 'StudioStimulusKind' })
export type StudioStimulusKind = z.infer<typeof StudioStimulusKindSchema>

/** BM labels of the kinds (PROPOSED: the V2 discovery gives the slugs only). */
export const STUDIO_STIMULUS_KIND_LABELS: Readonly<Record<StudioStimulusKind, string>> = {
  passage: 'Petikan',
  image: 'Gambar',
  diagram: 'Rajah',
  table: 'Jadual',
  map: 'Peta',
  infographic: 'Infografik',
  graph: 'Graf',
}

/** A group holds 1 to 3 stimuli (OD-28, enforced by the table design) and at most this many member questions. */
export const STUDIO_MAX_STIMULI = 3
export const STUDIO_MAX_MEMBERS = 20
/** D90: a group is only a group with at least this many members. */
export const STUDIO_MIN_MEMBERS = 2

export const STUDIO_GROUP_MESSAGES = {
  notFound: 'Kumpulan rangsangan tidak dijumpai.',
  stimulusNotFound: 'Rangsangan tidak dijumpai dalam kumpulan ini.',
  stimuli: 'Satu kumpulan mesti mempunyai 1 hingga 3 rangsangan.',
  stimulusEmpty: 'Rangsangan mesti ada teks, jadual atau gambar.',
  image: 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.',
  members: 'Senarai soalan ahli tidak sah.',
  memberUnknown: 'Soalan tidak dijumpai.',
  memberDuplicate: 'Satu soalan hanya boleh disenaraikan sekali.',
  memberTooMany: 'Satu kumpulan boleh mempunyai paling banyak 20 soalan.',
  memberElsewhere: 'Soalan ini sudah berada dalam kumpulan lain. Keluarkan dahulu daripada kumpulan itu.',
  memberNotIn: 'Soalan ini bukan ahli kumpulan ini.',
  lastStimulus: 'Kumpulan mesti kekal mempunyai sekurang-kurangnya satu rangsangan.',
  locked: 'Kumpulan ini mempunyai soalan yang sedang diterbitkan. Arkibkan soalan itu dahulu sebelum mengubah kumpulan.',
  /** Shown while the group is not yet a group (D90). */
  needsTwo: 'Kumpulan rangsangan mesti ada sekurang-kurangnya 2 soalan.',
  created: 'Kumpulan rangsangan dicipta.',
  updated: 'Kumpulan rangsangan dikemaskini.',
  membersUpdated: 'Susunan soalan dalam kumpulan dikemaskini.',
  dissolved: 'Kumpulan dibubarkan. Soalan ahli kekal sebagai soalan biasa.',
} as const

const Table = z.object({ head: z.array(z.string().max(500)).max(20), rows: z.array(z.array(z.string().max(500)).max(20)).max(100) })

const StimulusFields = {
  label: z.string().trim().max(100).nullable().optional(),
  caption: z.string().trim().max(300).nullable().optional(),
  /** Alt text of the picture or diagram (Bahasa Melayu). */
  alt: z.string().trim().max(1000).nullable().optional(),
  /** Passage text or the written description of a figure (`body_ms`). */
  body: z.string().max(20_000).nullable().optional(),
  table: Table.nullable().optional(),
  sourceCitation: z.string().trim().max(300).nullable().optional(),
  /** Public token (or id) of a file uploaded with purpose `question_image`; never a client URL. */
  imageFileId: IdSchema.nullable().optional(),
}

/** One stimulus as authored. It needs text, a table or a picture. */
export const StudioStimulusInputSchema = z
  .object({ kind: StudioStimulusKindSchema, ...StimulusFields })
  .superRefine((v, ctx) => {
    if (!hasContent(v)) ctx.addIssue({ code: 'custom', path: ['body'], message: STUDIO_GROUP_MESSAGES.stimulusEmpty })
  })
  .meta({ id: 'StudioStimulusInput' })

function hasContent(v: { body?: string | null | undefined; table?: unknown; imageFileId?: string | null | undefined }): boolean {
  return Boolean((v.body ?? '').trim()) || Boolean(v.table) || Boolean(v.imageFileId)
}

export const StudioStimulusPatchSchema = z
  .object({ kind: StudioStimulusKindSchema.optional(), ...StimulusFields })
  .meta({ id: 'StudioStimulusPatch' })

const MemberIds = z.array(IdSchema, { error: STUDIO_GROUP_MESSAGES.members }).max(STUDIO_MAX_MEMBERS, STUDIO_GROUP_MESSAGES.memberTooMany)

export const StudioGroupCreateRequestSchema = z
  .object({
    label: z.string().trim().max(100).nullable().optional(),
    stimuli: z.array(StudioStimulusInputSchema, { error: STUDIO_GROUP_MESSAGES.stimuli }).min(1, STUDIO_GROUP_MESSAGES.stimuli).max(STUDIO_MAX_STIMULI, STUDIO_GROUP_MESSAGES.stimuli),
    /** Questions to put in the group now, in order. May be empty: the group is then incomplete until it has two. */
    questionIds: MemberIds.optional(),
  })
  .meta({ id: 'StudioGroupCreateRequest' })

export const StudioGroupUpdateRequestSchema = z.object({ label: z.string().trim().max(100).nullable().optional() }).meta({ id: 'StudioGroupUpdateRequest' })

/** The complete, ordered list of members after the change: adds, removals and reordering in one atomic call. */
export const StudioGroupMembersRequestSchema = z.object({ questionIds: MemberIds }).meta({ id: 'StudioGroupMembersRequest' })

export const StudioGroupMemberAddRequestSchema = z
  .object({
    questionId: IdSchema,
    /** 1-based place in the group; omitted appends. */
    position: z.number().int().min(1).max(STUDIO_MAX_MEMBERS).optional(),
  })
  .meta({ id: 'StudioGroupMemberAddRequest' })

/* ----------------------------------------------------------------------------------------------- responses */

export const StudioStimulusSchema = z
  .object({
    id: IdSchema,
    kind: StudioStimulusKindSchema,
    label: z.string().nullable(),
    caption: z.string().nullable(),
    alt: z.string().nullable(),
    body: z.string().nullable(),
    table: Table.nullable(),
    sourceCitation: z.string().nullable(),
    /** Public token of the picture; load it at `/api/files/<token>`. */
    imageId: z.string().nullable(),
  })
  .meta({ id: 'StudioStimulus' })
export type StudioStimulus = z.infer<typeof StudioStimulusSchema>

export const StudioGroupMemberSchema = z
  .object({
    id: IdSchema,
    position: z.number().int().min(1),
    numberLabel: z.string().nullable(),
    /** First 120 characters of the stem. */
    stem: z.string(),
    status: z.string(),
  })
  .meta({ id: 'StudioGroupMember' })
export type StudioGroupMember = z.infer<typeof StudioGroupMemberSchema>

export const StudioGroupSchema = z
  .object({
    id: IdSchema,
    label: z.string().nullable(),
    stimuli: z.array(StudioStimulusSchema).min(1).max(STUDIO_MAX_STIMULI),
    members: z.array(StudioGroupMemberSchema),
    memberCount: z.number().int().min(0),
    /** D90: at least two members. */
    complete: z.boolean(),
    /** A member is being served: the structure may not change. */
    locked: z.boolean(),
    issues: z.array(z.string()),
  })
  .meta({ id: 'StudioGroup' })
export type StudioGroup = z.infer<typeof StudioGroupSchema>

export const StudioGroupRemovedSchema = z.object({ id: IdSchema, detachedQuestionIds: z.array(IdSchema) }).meta({ id: 'StudioGroupRemoved' })

/** `POST /intake/stimuli/:id/link-references`: the open items of the batch that name the figure and were linked to it now. */
export const StudioFigureLinksSchema = z
  .object({ stimulusId: IdSchema, linkedItemIds: z.array(IdSchema) })
  .meta({ id: 'StudioFigureLinks' })
export type StudioFigureLinks = z.infer<typeof StudioFigureLinksSchema>

/* ------------------------------------------------------------------------------------------------- DSKP picker */

/** The cognitive level of a leaf part (V2 "Aras pemikiran"). The wire stores `kbat` (ADR-0031 lists six levels; the six-level column is not in the schema yet). */
export const STUDIO_COGNITIVE_LEVELS = [
  { value: 'bukan', label: 'Bukan KBAT (Mengingat / Memahami)', kbat: false },
  { value: 'mengaplikasi', label: 'Mengaplikasi', kbat: true },
  { value: 'menganalisis', label: 'Menganalisis', kbat: true },
  { value: 'menilai', label: 'Menilai', kbat: true },
  { value: 'mencipta', label: 'Mencipta', kbat: true },
] as const

export const StudioDskpSpSchema = z.object({ id: IdSchema, code: z.string(), title: z.string(), skCode: z.string().nullable() }).meta({ id: 'StudioDskpSp' })
export const StudioDskpUnitSchema = z
  .object({ id: IdSchema, code: z.string(), title: z.string(), sps: z.array(StudioDskpSpSchema) })
  .meta({ id: 'StudioDskpUnit' })
export const StudioDskpQuerySchema = z
  .object({ subjectId: IdSchema, educationLevelId: IdSchema })
  .meta({ id: 'StudioDskpQuery' })
export const StudioDskpSchema = z.object({ units: z.array(StudioDskpUnitSchema) }).meta({ id: 'StudioDskp' })
export type StudioDskp = z.infer<typeof StudioDskpSchema>

export type StudioGroupCreateRequest = z.infer<typeof StudioGroupCreateRequestSchema>
export type StudioGroupUpdateRequest = z.infer<typeof StudioGroupUpdateRequestSchema>
export type StudioGroupMembersRequest = z.infer<typeof StudioGroupMembersRequestSchema>
export type StudioGroupMemberAddRequest = z.infer<typeof StudioGroupMemberAddRequestSchema>
export type StudioStimulusInput = z.infer<typeof StudioStimulusInputSchema>
export type StudioStimulusPatch = z.infer<typeof StudioStimulusPatchSchema>
