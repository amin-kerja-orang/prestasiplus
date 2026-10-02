import type { MockModuleStub } from '@/mock/registry'

/**
 * M06 mock plugin (F-01 stub). Replaced by `defineMockModule({...})` (F-06) in the owning task,
 * which also adds the PUBLIC repository exports other modules may import (D12, overview §6.10).
 */
const plugin: MockModuleStub = { id: 'M06' }

export default plugin
