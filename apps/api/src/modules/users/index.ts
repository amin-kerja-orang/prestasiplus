export { UsersModule } from './users.module'
export { UsersService } from './users.service'
export { generatePassword } from './credentials'
export { MANAGED_EXPORT_MAX, UsersRepository, uniqueField } from './users.repository'
export type {
  ManagedCounts,
  ManagedListFilter,
  ManagedRole,
  PendingTeacherRow,
  UserCredentials,
  UserRecord,
  UserSearchInput,
} from './users.repository'
export { ImportJobsRepository } from './import'
export { UsersPorts, type TeacherClassroomRow, type TeacherClassroomsProvider } from './users.ports'
