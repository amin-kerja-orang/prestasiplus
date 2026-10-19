import { flushPromises, type VueWrapper } from '@vue/test-utils'

// jsdom has no object URLs; the file list of the upload previews an image through one.
URL.createObjectURL = () => 'blob:test'

/**
 * Picks files in the `DsFileField` (Nuxt UI `FileUpload`) that sits inside `[data-testid=<testid>]`.
 * The upload hands one `File` over, or an array when it is `multiple`.
 */
export async function pickFiles(
  w: VueWrapper,
  testid: string,
  files: File[],
  multiple = false,
): Promise<void> {
  const root = w.get(`[data-testid="${testid}"]`).element
  const upload = w
    .findAllComponents({ name: 'FileUpload' })
    .find((c) => root === c.element || root.contains(c.element) || c.element.contains(root))
  if (!upload) throw new Error(`no FileUpload inside ${testid}`)
  upload.vm.$emit('update:modelValue', multiple ? files : (files[0] ?? null))
  await flushPromises()
}
