import { type DynamicModule, Module, type Type } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'

import { type Env, loadEnv } from './common/config/env.schema'
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter'
import { HealthModule } from './common/health/health.module'
import { DbModule } from './db/db.module'
import { pinoHttpOptions } from './common/logging/logging'
import { featureModules } from './modules'

export interface AppModuleOptions {
  /** Where JSON log lines go (default stdout). Tests pass a capture stream. */
  logStream?: NodeJS.WritableStream
}

/**
 * Builds the root module from a list of feature modules. Production uses `AppModule` (the registry
 * in `modules/index.ts`); tests call this to add a dummy module.
 */
export function defineAppModule(
  modules: Type<unknown>[],
  options: AppModuleOptions = {},
): Type<unknown> {
  const logger: DynamicModule = LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService<Env, true>) => {
      const http = pinoHttpOptions({ LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }) })
      return { pinoHttp: options.logStream ? [http, options.logStream] : http }
    },
  })

  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        validate: (raw) => loadEnv(raw),
      }),
      logger,
      DbModule,
      HealthModule,
      ...modules,
    ],
    providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
  })
  class RootModule {}

  return RootModule
}

export const AppModule = defineAppModule(featureModules)
