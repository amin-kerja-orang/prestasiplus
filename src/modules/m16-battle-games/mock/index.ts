import { defineMockModule } from '@/mock/define'

/**
 * M16 mock plugin (F-31 stub, build-plan §2.9): an empty `defineMockModule`. The owning task fills it
 * in and adds the PUBLIC repository exports other modules may import (D12, overview §6.10).
 */
const plugin = defineMockModule({ id: 'M16' })

export default plugin
