import { describe, expect, it } from 'vitest'
import { renderBody } from './render-body.ts'

describe('renderBody', () => {
  it('FR-8: renders a section heading as h4, below the entry card’s own h3 title', () => {
    expect(renderBody('## What happened\n\nIt broke.')).toBe(
      '<h4>What happened</h4>\n<p>It broke.</p>\n',
    )
  })

  it('shifts each deeper heading one level further, capped at h6', () => {
    expect(renderBody('### Detail')).toBe('<h5>Detail</h5>\n')
    expect(renderBody('#### Finer')).toBe('<h6>Finer</h6>\n')
    expect(renderBody('##### Finest')).toBe('<h6>Finest</h6>\n')
    expect(renderBody('###### Last')).toBe('<h6>Last</h6>\n')
  })

  it('renders a top-level heading as h4 too, never level with the card’s own title', () => {
    expect(renderBody('# Title')).toBe('<h4>Title</h4>\n')
  })

  it('leaves everything that is not a heading as marked renders it', () => {
    expect(
      renderBody('Some `code`, a [link](https://example.com)\n\n```\n## not a heading\n```'),
    ).toBe(
      '<p>Some <code>code</code>, a <a href="https://example.com">link</a></p>\n' +
        '<pre><code>## not a heading\n</code></pre>\n',
    )
  })
})
