import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { validateWorklog } from '../validate.ts'

const { values } = parseArgs({ options: { dir: { type: 'string', default: 'worklog' } } })
const { dir } = values

if (!existsSync(dir)) {
  console.error(`✖ ${dir}/ does not exist`)
  process.exit(1)
}

const files = readdirSync(dir)
  .filter((name) => name.endsWith('.md') && name !== 'README.md')
  .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }))
const { entries, errors } = validateWorklog(files)

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`)
  console.error(`\n${errors.length} problem(s) in ${dir}/`)
  process.exit(1)
}
console.log(`✔ ${entries.length} work-log entries are valid`)
