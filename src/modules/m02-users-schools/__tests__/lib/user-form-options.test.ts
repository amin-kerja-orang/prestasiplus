import { describe, expect, it } from 'vitest'

import routes from '../../routes/user-form'

import {
  formatDate,
  formatDateTime,
  generatedAdminEmail,
  generatedAdminName,
  isOfficerRole,
  isStandardRole,
  PRIMARY_GRADES,
  schoolMeta,
  SECONDARY_GRADES,
  titleCase,
} from '../../lib/user-form-options'

describe('user-form-options', () => {
  it('maps grades 1-6 to Darjah and 7-11 to Ting. 1-5', () => {
    expect(PRIMARY_GRADES.map((g) => `${String(g.value)}=${g.label}`)).toEqual([
      '1=Darjah 1',
      '2=Darjah 2',
      '3=Darjah 3',
      '4=Darjah 4',
      '5=Darjah 5',
      '6=Darjah 6',
    ])
    expect(SECONDARY_GRADES.map((g) => `${String(g.value)}=${g.label}`)).toEqual([
      '7=Ting. 1',
      '8=Ting. 2',
      '9=Ting. 3',
      '10=Ting. 4',
      '11=Ting. 5',
    ])
  })

  it('classifies the standard and the officer roles (BR-01)', () => {
    for (const r of ['student', 'teacher', 'parent', 'sponsor', 'admin']) {
      expect(isStandardRole(r)).toBe(true)
    }
    for (const r of ['school_admin', 'ppd_officer', 'jpn_officer', '']) {
      expect(isStandardRole(r)).toBe(false)
    }
    expect(isOfficerRole('ppd_officer')).toBe(true)
    expect(isOfficerRole('jpn_officer')).toBe(true)
    expect(isOfficerRole('school_admin')).toBe(false)
  })

  it('builds the generated school-admin name and login (BR-09)', () => {
    expect(titleCase('SEKOLAH  KEBANGSAAN bandar BARU bangi')).toBe(
      'Sekolah Kebangsaan Bandar Baru Bangi',
    )
    expect(generatedAdminName('SK TAMAN CONTOH')).toBe('Pentadbir Sk Taman Contoh')
    // A letter after a bracket or hyphen starts a new word (INFERRED).
    expect(titleCase('SJK (CINA) BANDAR-BARU')).toBe('Sjk (Cina) Bandar-Baru')
    expect(generatedAdminEmail('JBA0001')).toBe('jba0001@prestasiplus.my')
  })

  it('formats dates dd/mm/yyyy and dd/mm/yyyy HH:mm in Kuala Lumpur time (BR-33)', () => {
    expect(formatDate('2026-09-21T02:15:00+08:00')).toBe('21/09/2026')
    expect(formatDateTime('2026-09-21T02:15:00+08:00')).toBe('21/09/2026 02:15')
    // 20:30 UTC is already the next day in Kuala Lumpur.
    expect(formatDate('2026-09-20T20:30:00Z')).toBe('21/09/2026')
    expect(formatDate('bukan tarikh')).toBe('')
  })

  it('joins the school meta with " · " only between present values', () => {
    expect(schoolMeta({ type: 'SK', state: 'Selangor', district: 'PPD GOMBAK' })).toBe(
      'SK · Selangor · PPD GOMBAK',
    )
    expect(schoolMeta({ type: 'SK', state: 'Selangor', district: null })).toBe('SK · Selangor')
  })
})

describe('user-form routes (SRS §2)', () => {
  it('has the exact tab titles and shell headers', () => {
    const [create, edit] = routes
    expect(create?.path).toBe('/admin/users/create')
    expect(create?.meta?.title).toBe('Tambah Pengguna - Admin Panel')
    expect(create?.meta?.header).toEqual({
      title: 'Tambah Pengguna Baru',
      subtitle: 'Daftarkan akaun pengguna baru ke sistem',
    })
    expect(edit?.meta?.title).toBe('Edit Pengguna - Admin Panel')
    expect(edit?.meta?.header).toEqual({
      title: 'Edit Pengguna',
      subtitle: 'Kemaskini maklumat pengguna',
    })
  })
})
