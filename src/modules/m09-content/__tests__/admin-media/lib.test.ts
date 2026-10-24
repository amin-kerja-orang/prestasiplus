import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import { audioSetFormData } from '../../api/admin-media'
import {
  AUDIENCE_OPTIONS,
  BANNER_TYPE_OPTIONS,
  LINK_TYPE_OPTIONS,
  bannerPayload,
  bannerToForm,
  emptyBannerForm,
  preselect,
} from '../../lib/admin-media/banners'
import { audioSetPayload, emptyAudioSetForm, sortByName } from '../../lib/admin-media/audio'
import {
  dmy,
  errorLines,
  fieldErrors,
  isNotFoundError,
  limit50,
  queryText,
} from '../../lib/admin-media/common'
import { banner } from './harness'

describe('common helpers', () => {
  it('limit50 cuts at 50 characters, trims the trailing space and adds "..."', () => {
    const description =
      'Latih diri dengan ribuan soalan Matematik, Sains, BM dan BI. Kumpul coins dan naik ranking!'
    expect(limit50(description)).toBe('Latih diri dengan ribuan soalan Matematik, Sains,...')
    expect(
      limit50('Platform pembelajaran interaktif untuk pelajar sekolah. Jom mula belajar'),
    ).toBe('Platform pembelajaran interaktif untuk pelajar sek...')
    expect(limit50('x'.repeat(50))).toBe('x'.repeat(50))
  })

  it('dmy turns YYYY-MM-DD into dd/mm/yyyy and leaves empty values empty', () => {
    expect(dmy('2026-01-01')).toBe('01/01/2026')
    expect(dmy('2026-12-31T00:00:00+08:00')).toBe('31/12/2026')
    expect(dmy(null)).toBe('')
  })

  it('queryText reads the first string value', () => {
    expect(queryText('a')).toBe('a')
    expect(queryText(['b', 'c'])).toBe('b')
    expect(queryText(undefined)).toBe('')
  })

  it('errorLines and fieldErrors read an ApiError', () => {
    const err = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: { title: 'Medan ini diperlukan.' },
    })
    expect(errorLines(err)).toEqual(['Medan ini diperlukan.'])
    expect(fieldErrors(err)).toEqual({ title: 'Medan ini diperlukan.' })
    expect(errorLines(new Error('boom'))).toEqual(['Ralat berlaku. Sila cuba lagi.'])
    expect(isNotFoundError(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'n' }))).toBe(
      true,
    )
  })
})

describe('banner form options (BR-M09-12/13, DV-M09-07)', () => {
  it('has the live option sets', () => {
    expect(BANNER_TYPE_OPTIONS.map((o) => o.label)).toEqual([
      'Utama',
      'Promosi',
      'Pengumuman',
      'Acara',
    ])
    expect(LINK_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'none',
      'subject',
      'quiz',
      'article',
      'external',
    ])
    expect(AUDIENCE_OPTIONS.map((o) => o.label)).toEqual(['Semua', 'Pelajar', 'Guru', 'Admin'])
  })

  it('selects the option equal to the stored code ignoring case', () => {
    expect(preselect(BANNER_TYPE_OPTIONS, 'HERO', '')).toEqual({ extra: null, value: 'hero' })
    expect(preselect(AUDIENCE_OPTIONS, 'STUDENT', 'all')).toEqual({ extra: null, value: 'student' })
    expect(preselect(LINK_TYPE_OPTIONS, 'NONE', 'none')).toEqual({ extra: null, value: 'none' })
  })

  it('inserts an extra option labelled with the stored code when no option matches', () => {
    expect(preselect(BANNER_TYPE_OPTIONS, 'FEATURE', '')).toEqual({
      extra: { value: 'FEATURE', label: 'FEATURE' },
      value: 'FEATURE',
    })
    expect(preselect(BANNER_TYPE_OPTIONS, 'PROMOTIONAL', '').extra?.label).toBe('PROMOTIONAL')
  })

  it('payload upper-cases the codes and sends externalUrl only for "Pautan Luar"', () => {
    const form = emptyBannerForm()
    form.title = 'Promo'
    form.bannerType = 'announcement'
    form.linkType = 'none'
    form.externalUrl = 'https://typed.example'
    form.displayOrder = 6
    const body = bannerPayload(form)
    expect(body).toMatchObject({
      title: 'Promo',
      bannerType: 'ANNOUNCEMENT',
      linkType: 'NONE',
      targetAudience: 'ALL',
      displayOrder: 6,
      description: null,
      imageUrl: null,
      startDate: null,
      endDate: null,
      isActive: true,
    })
    expect('externalUrl' in body).toBe(false)

    form.linkType = 'external'
    expect(bannerPayload(form).externalUrl).toBe('https://typed.example')
  })

  it('an unchanged edit of an unmatched code keeps the stored codes', () => {
    const stored = banner(2, { bannerType: 'FEATURE', targetAudience: 'STUDENT', linkType: 'NONE' })
    const form = bannerToForm(stored, {
      bannerType: preselect(BANNER_TYPE_OPTIONS, stored.bannerType, '').value,
      linkType: preselect(LINK_TYPE_OPTIONS, stored.linkType, 'none').value,
      targetAudience: preselect(AUDIENCE_OPTIONS, stored.targetAudience, 'all').value,
    })
    expect(bannerPayload(form)).toMatchObject({
      bannerType: 'FEATURE',
      targetAudience: 'STUDENT',
      linkType: 'NONE',
    })
  })
})

describe('audio set form state (BR-M09-15, FR-M09-67..70)', () => {
  it('starts with the live defaults: Approved, "Audio n", answer A, marks 1, KBAT level 3', () => {
    const form = emptyAudioSetForm()
    expect(form.status).toBe('approved')
    expect(form.sections.map((s) => s.title)).toEqual(['Audio 1', 'Audio 2', 'Audio 3', 'Audio 4'])
    expect(form.questions).toHaveLength(30)
    expect(form.questions[0]).toMatchObject({ correctAnswer: 'A', marks: 1, kbatLevel: 3 })
  })

  it('payload keeps 4 sections and 30 questions in order and drops empty optionals', () => {
    const form = emptyAudioSetForm()
    form.title = 'BM T4 Set 1'
    form.educationLevelId = 10
    form.subjectId = 1
    form.questions.forEach((q, i) => {
      q.questionText = `Soalan ${String(i + 1)}`
      q.optionA = 'a'
      q.optionB = 'b'
      q.optionC = 'c'
      q.optionD = 'd'
    })
    const body = audioSetPayload(form)
    expect(body.educationLevelId).toBe(10)
    expect(body.sections).toEqual([
      { title: 'Audio 1' },
      { title: 'Audio 2' },
      { title: 'Audio 3' },
      { title: 'Audio 4' },
    ])
    expect(body.questions).toHaveLength(30)
    expect(body.questions[29]?.questionText).toBe('Soalan 30')
    expect(body.questions[0]).not.toHaveProperty('dskpSpId')
    expect('sourceLabel' in body).toBe(false)
  })

  it('builds the multipart names sections[n][..] and questions[n][..]', () => {
    const form = emptyAudioSetForm()
    form.title = 'T'
    form.educationLevelId = 1
    form.subjectId = 2
    form.sourceLabel = 'Sumber'
    const file = new File(['x'], 'a.mp3', { type: 'audio/mpeg' })
    form.sections[1]!.audio = file
    form.questions[29]!.dskpSpId = 77
    const data = audioSetFormData(audioSetPayload(form))
    expect(data.get('title')).toBe('T')
    expect(data.get('educationLevelId')).toBe('1')
    expect(data.get('sourceLabel')).toBe('Sumber')
    expect(data.get('sections[1][title]')).toBe('Audio 1')
    expect((data.get('sections[2][audio]') as File).name).toBe('a.mp3')
    expect(data.has('sections[1][audio]')).toBe(false)
    expect(data.get('questions[30][dskpSpId]')).toBe('77')
    expect(data.get('questions[1][correctAnswer]')).toBe('A')
    expect(data.get('questions[1][marks]')).toBe('1')
  })

  it('sortByName sorts A–Z without changing the source', () => {
    const subjects = [{ name: 'Sains' }, { name: 'Bahasa Arab' }, { name: 'Matematik' }]
    expect(sortByName(subjects).map((s) => s.name)).toEqual(['Bahasa Arab', 'Matematik', 'Sains'])
    expect(subjects[0]?.name).toBe('Sains')
  })
})
