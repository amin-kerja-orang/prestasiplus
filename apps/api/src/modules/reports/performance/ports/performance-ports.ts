import { Inject, Injectable, Optional } from '@nestjs/common'

import { BIJAK_AGGREGATE_PORT, EmptyBijakAggregate, type BijakAggregatePort } from './bijak-aggregate.port'
import { CLASSES_READ_PORT, EmptyClasses, type ClassesReadPort } from './classes-read.port'

/**
 * Holder of the ports other cards implement (pattern of `CurriculumPorts`). Defaults answer "nothing".
 * BE-16 calls `provideBijak(...)` and BE-17 calls `provideClasses(...)` from their own `onModuleInit`;
 * a module may instead provide the `BIJAK_AGGREGATE_PORT` / `CLASSES_READ_PORT` tokens (tests do).
 * Services read the getters on every request. Registering twice throws.
 */
@Injectable()
export class PerformancePorts {
  private bijakPort: BijakAggregatePort
  private classesPort: ClassesReadPort
  private bijakSet: boolean
  private classesSet: boolean

  constructor(
    @Optional() @Inject(BIJAK_AGGREGATE_PORT) bijak?: BijakAggregatePort,
    @Optional() @Inject(CLASSES_READ_PORT) classes?: ClassesReadPort,
  ) {
    this.bijakPort = bijak ?? new EmptyBijakAggregate()
    this.classesPort = classes ?? new EmptyClasses()
    this.bijakSet = bijak !== undefined
    this.classesSet = classes !== undefined
  }

  get bijak(): BijakAggregatePort {
    return this.bijakPort
  }
  get classes(): ClassesReadPort {
    return this.classesPort
  }

  provideBijak(port: BijakAggregatePort): void {
    if (this.bijakSet) throw new Error('PerformancePorts: the Bijak aggregate is already set')
    this.bijakPort = port
    this.bijakSet = true
  }
  provideClasses(port: ClassesReadPort): void {
    if (this.classesSet) throw new Error('PerformancePorts: the classes port is already set')
    this.classesPort = port
    this.classesSet = true
  }
}
