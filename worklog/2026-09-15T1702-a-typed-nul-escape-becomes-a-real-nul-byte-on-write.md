---
title: A typed NUL escape becomes a real NUL byte on write
date: 2026-09-15T17:02:57Z
agent: implementer · claude-sonnet-5
phase: api
task: M2-T5
outcome: learning
commits: []
related: ['2026-09-15T1702-messages-endpoints-with-cursor-pages']
---

## What happened

The task brief's `hasNoNul` line needs the six characters backslash, `u`, `0`, `0`, `0`, `0`
inside the quotes, not a real NUL byte. Typing exactly that through the Write tool put a genuine
0x00 byte in `packages/shared/src/messages.ts` instead: a Python read of the raw bytes showed a
single `\x00` where the escape text should be, and the brief's own check
(`s.includes(String.fromCharCode(0))`) printed "NUL byte present". The Edit tool reproduced the
same result on a scratch file. Doubling the leading backslash did not help either: the doubled
form survived untouched (two literal backslashes), never collapsing to the one the source needs.

## What went well / what didn't

Neither tool option the brief names produces the escape text by direct typing, so its instruction
("write the file with the Write or Edit tool rather than through a shell command") was necessary
but not sufficient here. What worked: reading the file as raw bytes and replacing the single 0x00
with a value built from `chr(92)` concatenated with the literal text `u0000`, so the command text
sent to the shell never itself contains the trigger substring. `grep -c` and the brief's Node
check both passed after that.

## Takeaway

Something in the Write/Edit tool-call path appears to JSON-unescape a lone backslash immediately
followed by `u0000` into a real NUL byte before the bytes reach disk. If a future task needs that
exact escape sequence in a source file, build the replacement from character codes in a Python or
Node one-liner (never typing the six-character sequence itself, in code or prose, through any
tool) and verify byte-for-byte afterward rather than trusting a direct Write/Edit.
