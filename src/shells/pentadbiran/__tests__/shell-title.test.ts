// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { shellEntityTitle, useShellEntityTitle } from '@/ds'

import { PENTADBIRAN_MENU, activeItem, groupOf } from '../menu'
import { buildNavGroups } from '../menu-nav'

describe('crumb groups equal sidebar groups', () => {
  it('every visible screen belongs to a group the sidebar renders', () => {
    const rendered = new Set(
      buildNavGroups(PENTADBIRAN_MENU, { activeId: undefined }).map((g) => g.key),
    )
    for (const group of PENTADBIRAN_MENU) {
      for (const item of group.items) {
        expect(groupOf(item.id)?.key, item.id).toBe(group.key)
        expect(rendered.has(group.key), item.id).toBe(true)
      }
    }
  })

  it('previously orphan crumbs resolve to a rendered group', () => {
    expect(groupOf(activeItem('/admin/tiket')?.id ?? '')?.label).toBe('Penglibatan')
    expect(groupOf(activeItem('/admin/pksk/access')?.id ?? '')?.label).toBe('Kewangan')
    expect(activeItem('/admin/tools/screenshots')?.label).toBe('Upload Screenshot')
  })

  it('every Kirkpatrick page keeps its own item and the pupil page sits in the Kirkpatrick section', () => {
    expect(activeItem('/admin/kirkpatrick/reaction')?.label).toBe('T1: Reaksi')
    expect(activeItem('/admin/kirkpatrick/chain')?.label).toBe('Rantaian Impak')
    expect(activeItem('/admin/kirkpatrick/pelajar/4')?.sub).toBe('Kirkpatrick')
  })
})

describe('useShellEntityTitle', () => {
  it('sets, updates and clears the entity name with the page', async () => {
    const name = ref<string | null>('SMK Demo Satu')
    const Page = defineComponent({
      setup() {
        useShellEntityTitle(name)
        return () => h('div')
      },
    })
    const w = mount(Page)
    expect(shellEntityTitle.value).toBe('SMK Demo Satu')
    name.value = '  SMK Demo Dua '
    await nextTick()
    expect(shellEntityTitle.value).toBe('SMK Demo Dua')
    name.value = null
    await nextTick()
    expect(shellEntityTitle.value).toBeNull()
    name.value = 'Lagi'
    await nextTick()
    w.unmount()
    expect(shellEntityTitle.value).toBeNull()
  })
})
