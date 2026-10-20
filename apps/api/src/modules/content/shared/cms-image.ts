import { ApiError } from '../../../common/errors/api-error'
import { PrismaService } from '../../../db/prisma.service'
import { fileTokenOfUrl } from './content-support'

/**
 * AC 7: banner images and article featured images are BE-04 files of purpose `cms_image`. The wire
 * field stays a URL (contract), so an accepted URL must be the download URL of such a file
 * (`/api/files/<token>` on this API's origin or a configured PUBLIC_ORIGINS entry, from `POST /api/files?purpose=cms_image`); any other URL is refused, because
 * the data model stores a file reference and nothing else (see the deviations log).
 *
 * Returns the internal file id, or throws 422 `fields[field]`.
 */
export async function cmsImageFileId(prisma: PrismaService, url: string, origins: readonly string[], field: string, invalid: string): Promise<bigint> {
  const token = fileTokenOfUrl(url, origins)
  const file = token === null ? null : await prisma.client.file.findUnique({ where: { publicId: token }, select: { id: true, purpose: true } })
  if (!file || file.purpose !== 'cms_image') throw ApiError.of('VALIDATION_ERROR', { fields: { [field]: invalid } })
  return file.id
}
