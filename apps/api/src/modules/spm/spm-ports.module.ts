import { Module } from '@nestjs/common'

import { SpmPorts } from './ports'

/**
 * Holds the one `SpmPorts` instance and nothing else (no controller, no `onModuleInit`). `SpmModule` (which binds the papers and
 * coins adapters) and `PracticeSpmReadsModule` (S5, which binds the answer-store and history adapters) both import it, so there is a
 * single holder and the practice side never boots `SpmModule` and its port bindings (a harness that already bound them would throw).
 */
@Module({ providers: [SpmPorts], exports: [SpmPorts] })
export class SpmPortsModule {}
