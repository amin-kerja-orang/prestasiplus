import { defineMockModule } from '@/mock/define'

/**
 * M25 mock plugin (F-31b stub, build-plan §2.9): an empty `defineMockModule`. The owning task fills it
 * in and adds the PUBLIC repository exports other modules may import (D12, overview §6.10).
 */
const plugin = defineMockModule({ id: 'M25' })

export default plugin
