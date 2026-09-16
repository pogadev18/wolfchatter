import { Marked } from 'marked'

/**
 * Where body headings start. On `/devlog` the page is `h1`, each day `h2` and each entry card's
 * title `h3`, so a body heading must be `h4` or deeper to sit under its own entry in the document
 * outline that screen-reader users navigate by. Rendered as written, the `##` sections every entry
 * uses (the `worklog:new` template) came out as `h2`s nested inside an `h3`.
 */
const FIRST_BODY_HEADING_LEVEL = 4
const LAST_HEADING_LEVEL = 6

/**
 * `##` becomes `h4` and each deeper level one more, capped at `h6`, the deepest HTML has. A
 * top-level `#` becomes `h4` as well: shifted like the others it would be an `h3`, level with the
 * card's own title rather than under it. Done here, at build time, so the outline in the HTML
 * itself is right; `devlog-body.css` styles `h4` the way it styled `h2`, so nothing looks different.
 */
const markdown = new Marked({
  walkTokens(token) {
    if (token.type !== 'heading') return
    const shifted = Math.max(token.depth + 2, FIRST_BODY_HEADING_LEVEL)
    token.depth = Math.min(shifted, LAST_HEADING_LEVEL)
  },
})

/**
 * Renders a work-log entry's Markdown body to the HTML the devlog inserts.
 *
 * marked does not sanitise: any raw HTML already in the Markdown source passes straight through.
 * That is safe here only because the source is always a file under worklog/ — committed and
 * reviewed like the rest of this repository, never user- or request-supplied. The result is
 * later dropped into the page unescaped (dangerouslySetInnerHTML), so the day this function's
 * input stops being "our own contributors' committed Markdown" is the day it needs a sanitiser
 * in front of it.
 */
export function renderBody(source: string): string {
  return markdown.parse(source, { async: false })
}
