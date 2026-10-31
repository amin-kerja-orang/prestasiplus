// @vitest-environment jsdom
// REQ-A-004 Kontrak rows (K1, K4, K6, K7, K8, K9, K10): V2 labels (cloud-student-mechanism 3.4,
// BIJAK-SPM-cloud P4). K3 (duplicate guard wording) stays the V3 text approved by D92(3).
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SharedBanner from '../admin/kontrak/components/SharedBanner.vue'

const read = async (rel: string): Promise<string> =>
  (await import('node:fs')).readFileSync(new URL(rel, import.meta.url), 'utf8')

describe('K9 banner', () => {
  it('list wording: title, per-subject warning and SEMUA', () => {
    const w = mount(SharedBanner, { props: { scope: 'list' } })
    const t = w.get('[data-testid="kontrak-shared-banner"]').text()
    expect(t).toContain('Kontrak dikongsi.')
    expect(t).toContain('Setiap kontrak di bawah ialah peraturan bagi satu subjek × kertas — bukan satu set soalan.')
    expect(t).toContain('untuk SEMUA kertas subjek tersebut, bukan hanya satu kertas.')
  })
  it('editor wording omits the list sentence', () => {
    const t = mount(SharedBanner, { props: { scope: 'editor' } }).text()
    expect(t).toContain('Kontrak dikongsi.')
    expect(t).not.toContain('Setiap kontrak di bawah')
    expect(t).toContain('Menyunting kontrak ini mengubah pintu terbitan (publish gate)')
  })
})

describe('V2 labels in the Kontrak screens', () => {
  it('editor and section labels (K4, K6), flashes (K7), delete and empty copy (K8, K10), route title (K1)', async () => {
    const general = await read('../admin/kontrak/components/GeneralTab.vue')
    expect(general).toContain('label="Kod Kertas"')
    expect(general).toContain('label="Jumlah Markah"')
    expect(general).toContain('label="Sumber"')
    expect(general).not.toContain('label="Status"')
    expect(general).toContain('Semua Bahagian kontrak turut dipadam.')
    const section = await read('../admin/kontrak/components/SectionEditor.vue')
    for (const l of ['Peraturan Pilihan', 'Arahan (opsyenal)', 'Mod Jawapan Dijangka', 'Jawab Semua', 'Pilih N'])
      expect(section).toContain(l)
    const editor = await read('../admin/kontrak/pages/KontrakEditorPage.vue')
    expect(editor).toContain("'Kontrak dicipta.'")
    expect(editor).toContain("'Kontrak dikemas kini.'")
    expect(editor).not.toContain('Kontrak berjaya disimpan.')
    const list = await read('../admin/kontrak/pages/KontrakListPage.vue')
    expect(list).toContain('Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas.')
    expect(list).toContain('Senarai Kontrak')
    expect(list).toContain('title="Kontrak Baharu"')
    const route = await read('../routes/admin-kontrak.ts')
    expect(route).toContain("header: { title: 'Kontrak Simulasi'")
    // K3 is kept: the V3 duplicate wording (D92(3)).
    expect(await read('../admin/kontrak/server/memory.ts')).toMatch(/sudah wujud/)
  })
})
