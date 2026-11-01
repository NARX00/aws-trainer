# AWS SAP-C02 Trainer

Study tools for the AWS Certified Solutions Architect – Professional (SAP-C02) exam:

- a **question trainer** with spaced repetition, exam simulation, 35 decision patterns, open scenarios, labs and cues
- an **AWS Service Mind Map** organised by exam domain and task
- printable **study sheets**: comparison tables, cheat sheets, the 33 average question types, must-know definitions

The online trainer runs as a private page on claude.ai. Its questions and the learner's progress live in that page's database; this repo holds the page code, a snapshot of the question bank, offline copies and the study sheets.

## Layout

| Path | What it is |
|---|---|
| `web/src/shell.html` | Trainer page code (no questions inside) |
| `web/src/map.html` | AWS Service Mind Map |
| `web/src/loader.js` | Loads the question bank from the database, then starts the trainer |
| `web/src/extra.js`, `extra.css` | Online additions: Edit tab, progress import, mind-map overlay, backup |
| `web/build.py` | Builds `dist/` from `web/src/` |
| `dist/trainer.html`, `dist/map.html` | The published page and the map file published next to it |
| `data/questions/<label>.json` | Question bank snapshot, one file per question (743) |
| `data/meta/bank.json`, `patterns.json` | Scenario types, domains, task names; the 35 patterns |
| `offline/` | Single-file trainer and map that work without claude.ai (keep both in one folder) |
| `study-materials/` | Printable PDFs |
| `examples/iac-3tier/` | Same 3-tier architecture in Terraform and in Python CDK |
| `docs/` | Question breakdown method, online trainer notes |
| `tools/` | Smoke test with a stand-in database, seed-batch generator |

## Question bank

743 questions: labels `A…` and `B…` come from the two source PDFs (a question found in both shows both labels, e.g. `A46 · B52`); `N…` questions were written for the trainer to cover thin exam tasks. Each question file holds:

| Field | Meaning |
|---|---|
| `i` | Internal id, the key for saved progress (never change it) |
| `r` | Labels, first one is the file and database id |
| `s`, `o`, `a` | Question text, options, correct option indexes (0 = A) |
| `w.y`, `w.o`, `w.s` | Why (main explanation), one line per option, AWS sources |
| `ts`, `dm`, `pt`, `t` | Exam task, domain, pattern id, scenario types |
| `v` | Answer chain: services in the right answer |
| `d`, `st`, `alt`, `nt`, `np` | Deciding words, status today, disputed note, note, incomplete in PDF |
| `e`, `k`, `x`, `nw` | Source explanation, corrected-key info, new exam-guide question |

The live database is the source of truth: edits made in the trainer's Edit tab go there. To refresh `data/`, export the `questions` collection and commit it.

## Build and test

```
python3 web/build.py          # writes dist/trainer.html and dist/map.html
python3 tools/test_trainer.py # needs: pip install playwright && playwright install chromium
```

The page reads questions from the database collection `questions`, settings from `meta/bank` and `meta/patterns`, and keeps each learner's progress privately at `data/users/<id>/progress`. Only the owner and editors can change `questions` and `meta`.
