import type { DevlogEntry } from '@wolfchatter/worklog'
import './devlog-body.css'

const GITHUB_REPO = 'https://github.com/pogadev18/wolfchatter'

/** Times in the viewer's locale, like the chat panel (`apps/web/src/messages/message-list.tsx`). */
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

interface EntryCardProps {
  entry: DevlogEntry
  /** Every entry on the page, by id, so a `related` link shows a real title and never dangles. */
  entriesById: ReadonlyMap<string, DevlogEntry>
}

/** One work-log entry, FR-8's unit of the timeline. */
export function EntryCard({ entry, entriesById }: EntryCardProps) {
  const related = entry.related
    .map((id) => entriesById.get(id))
    .filter((candidate): candidate is DevlogEntry => candidate !== undefined)
  const hasLinks = entry.commit !== null || entry.commits.length > 0 || related.length > 0

  return (
    <li id={entry.id} className="border-stone-200 border-b py-4 first:pt-0 last:border-b-0">
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-stone-500 text-xs">
        <time dateTime={entry.date}>{TIME_FORMAT.format(new Date(entry.date))}</time>
        <span aria-hidden="true">·</span>
        <span>{entry.phase}</span>
        <span aria-hidden="true">·</span>
        <span className={entry.outcome === 'issue' ? 'font-semibold text-red-700' : undefined}>
          {entry.outcome}
          {entry.severity ? ` (${entry.severity})` : ''}
        </span>
        {entry.task !== undefined && (
          <>
            <span aria-hidden="true">·</span>
            <span>{entry.task}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>{entry.agent}</span>
      </p>
      <h3 className="mt-1 font-semibold text-stone-900">{entry.title}</h3>
      {/*
        Safe to render unescaped: `entry.html` is Markdown from this repository's own committed,
        code-reviewed `worklog/*.md`, never user- or request-supplied. See the full trust argument
        on `DevlogEntry.html` in packages/worklog/src/devlog.ts before reusing this pattern
        anywhere content could come from someone other than this project's own contributors.
      */}
      <div
        className="devlog-body mt-2 text-stone-700 text-sm"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: see the comment above
        dangerouslySetInnerHTML={{ __html: entry.html }}
      />
      {hasLinks && (
        <div className="mt-2 flex flex-col gap-1 text-xs">
          {entry.commit !== null && (
            <p>
              <a
                href={commitUrl(entry.commit)}
                className="text-stone-500 underline hover:text-stone-700"
              >
                View commit {shortSha(entry.commit)}
              </a>
            </p>
          )}
          {entry.commits.length > 0 && (
            <p className="flex flex-wrap gap-x-2 text-stone-500">
              Also:
              {entry.commits.map((sha) => (
                <a key={sha} href={commitUrl(sha)} className="underline hover:text-stone-700">
                  {shortSha(sha)}
                </a>
              ))}
            </p>
          )}
          {related.length > 0 && (
            <p className="flex flex-wrap gap-x-2 text-stone-500">
              Related:
              {related.map((target) => (
                <a
                  key={target.id}
                  href={`#${target.id}`}
                  className="underline hover:text-stone-700"
                >
                  {target.title}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function commitUrl(sha: string): string {
  return `${GITHUB_REPO}/commit/${sha}`
}

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}
