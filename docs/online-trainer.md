# Online trainer (claude.ai page)

Published Nov 1, 2026 as a private claude.ai page; needs sign-in.

## What it adds to the offline trainer
- Questions load from the page's database, one row per question, instead of being built into the HTML.
- Progress is saved to the learner's account (`data/users/<id>/progress`, private), so it follows them on any device. The browser keeps a local copy as a cache.
- **Edit questions** (top right, owner and editors only): find a question by label or words; edit text, options, correct answer, Why, per-option lines, task, pattern, services, scenario types, notes; add new questions with the next free `N` label. After answering any question, **Edit this question** opens it directly.
- **Mind map ↗** opens the map inside the trainer; "Open task X in the mind map" and the map's "Practise task X in the trainer" links work both ways.
- First visit: **Bring over your progress** imports the backup JSON from the offline trainer (Patterns → Backup / restore → Download progress backup). Import merges, never overwrites.
- Still built into the page: open scenarios, decision cards, labs, cues, "What changed", icons.

## Database
| Path | Content | Access |
|---|---|---|
| `questions/<label>` | One question (see README for fields) | read: viewers · write: owner/editors |
| `meta/bank` | Scenario types, domains, weights, task names | read: viewers · write: owner/editors |
| `meta/patterns` | The 35 decision patterns | read: viewers · write: owner/editors |
| `data/users/<id>/progress` | One learner's progress | that learner only |

## Changing questions
- In the page: Edit questions.
- From a Claude chat: read `questions/<label>`, then update it with the version you read (so a newer edit is never overwritten). Changes show on the next page load.
- Republishing the page code (from `dist/`) never touches questions or progress.
