import { parse as parseYaml } from 'yaml'
import { type WorklogEntry, worklogFrontmatterSchema } from './schema.ts'

const FILE_NAME = /^(\d{4}-\d{2}-\d{2}T\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const HEADING = /^#{1,6} .*$/gm
const MIN_BODY_LENGTH = 20

export type ParseResult = { ok: true; entry: WorklogEntry } | { ok: false; errors: string[] }

/** `2026-09-15T14:32:10Z` → `2026-09-15T1432`, the prefix of every entry's file name. */
export function fileStamp(isoDate: string): string {
  return `${isoDate.slice(0, 10)}T${isoDate.slice(11, 13)}${isoDate.slice(14, 16)}`
}

export function parseWorklogFile(fileName: string, content: string): ParseResult {
  const name = FILE_NAME.exec(fileName)
  if (!name) {
    return { ok: false, errors: ['file name must look like 2026-09-15T1432-short-slug.md'] }
  }
  const blocks = FRONTMATTER.exec(content)
  if (!blocks) {
    return { ok: false, errors: ['missing frontmatter: start the file with a --- block'] }
  }
  const [, frontmatter = '', body = ''] = blocks

  let data: unknown
  try {
    data = parseYaml(frontmatter)
  } catch (error) {
    return { ok: false, errors: [`frontmatter is not valid YAML: ${String(error)}`] }
  }

  const result = worklogFrontmatterSchema.safeParse(data)
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
      ),
    }
  }

  const errors: string[] = []
  if (fileStamp(result.data.date) !== name[1]) {
    errors.push(`date ${result.data.date} does not match the file name prefix ${name[1]}`)
  }
  if (body.replace(HEADING, '').trim().length < MIN_BODY_LENGTH) {
    errors.push('body is empty: describe what happened, what went well or not, and the takeaway')
  }
  if (errors.length > 0) return { ok: false, errors }

  const id = fileName.slice(0, -'.md'.length)
  return { ok: true, entry: { ...result.data, id, body: body.trim() } }
}
