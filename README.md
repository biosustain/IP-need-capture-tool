# Informatics Platform – Need Capture

A small static web app for collecting project data **needs** from clients of the BRIGHT
Informatics Platform. Questionnaires are plain Markdown templates; clients answer them section by
section, review their answers, and send the exported file to the team by email.

The app is the first step of a two-stage workflow — see
[From needs to requirements](#from-needs-to-requirements).

- **Questionnaire style** – one step per `##` section, progress per section, autosave in the browser.
- **Export and view** – YAML (canonical), JSON, or the Markdown template filled in. Any exported
  file can be opened in the app again to view, edit or re-export.
- **Multiple templates** – drop a `.md` file into [`templates/`](templates/) and it shows up on the
  start page.
- **Several questionnaires at once** – one template can be answered many times over, one per
  project. Each is listed under **In progress** with its own progress and last-saved time.
- **Send your answers** – downloads the YAML and lets the client pick which team member to email
  it to.
- **Export and import in bulk** – every questionnaire in this browser leaves as one bundle file,
  and comes back the same way, so captures can move between browsers, machines and people.

Everything runs in the browser. There is no server, no account and no network call beyond loading
the site itself: answers never leave the client's machine until they choose to send the file.

No build step and no framework: HTML, CSS and ES modules, plus a vendored copy of
[js-yaml](https://github.com/nodeca/js-yaml) (MIT).

The application code in this repository was written by an AI model under human direction — see
[How this app was built](#how-this-app-was-built).

## Repository layout

```
index.html, css/, js/        the app
  js/markdown.js             Markdown parser (no dependencies)
  js/template.js             Markdown template -> questionnaire model
  js/answers.js              answer model, YAML/JSON/Markdown export, import
  js/app.js                  views and routing
assets/bright-mark.png       BRIGHT Biofoundry mark (favicon + header)
vendor/js-yaml.mjs           js-yaml 4.2.0
config.json                  site settings (title, organisation, contact email)
templates/                   needs statement (served) + specification shape + generated index.json
scripts/build-template-index.mjs   regenerates templates/index.json
scripts/validate-need-yaml.mjs     checks a need file before it is opened in the app
scripts/test-bundle.mjs            checks the bulk export/import bundle format
.claude/skills/need-capture/       agent skill: free text -> one need file per need
.github/workflows/pages.yml  deploys the site to GitHub Pages
LICENSE                      MIT
```

## Run locally

```bash
node scripts/build-template-index.mjs   # after adding/editing templates
python3 -m http.server 8000             # any static server works
# open http://localhost:8000
```

Opening `index.html` straight from disk does not work, because browsers block `fetch` and modules
on `file://`.

```bash
node scripts/test-bundle.mjs            # bundle format: round trip and import planning
```

## Publish on GitHub Pages

The repository is `biosustain/IP-need-capture-tool`.

1. In **Settings → Pages**, set **Source** to **GitHub Actions**.
2. Push to `main`. The workflow rebuilds `templates/index.json` and deploys the site to
   `https://biosustain.github.io/IP-need-capture-tool/`.

> GitHub Actions minutes are billed for private repositories, and a Pages site built from a private
> repository on the organisation's Team plan is still publicly reachable — access-controlled Pages
> needs GitHub Enterprise Cloud. Since this repository holds no client answers, publishing it as a
> **public** repository is the simpler option: free Actions minutes and free Pages.

Fill in `contacts` in `config.json` before going live — it is the only way a client is told where to
send their answers:

```json
"contacts": [
  { "name": "Ding He", "email": "dinghe@dtu.dk" },
  { "name": "Lea Sommer", "email": "lemad@dtu.dk" }
]
```

List one contact and the dialog names them directly; list several and the client picks whoever they
are working with. A single `"contactEmail": "..."` is still honoured as a fallback.

Share a direct link to one questionnaire with `?template=<id>`, for example
`https://biosustain.github.io/IP-need-capture-tool/?template=need-capture-short`. The id is the
template's filename without `.md`, as listed in [`templates/index.json`](templates/index.json).

## Several questionnaires at once

The start page lists everything **In progress**, newest first, and **Start** on a template card
always begins a new one — so the same questionnaire can be filled in separately for Project A and
Project B without the two colliding.

Each is labelled automatically from its first answered question (usually the project name) and can
be renamed from the `⋯` menu, on the start page or in the questionnaire toolbar. The same menu
duplicates or deletes one. **Edit a copy**, on an opened answers file, always starts a new
questionnaire rather than overwriting anything.

Drafts live in the browser's `localStorage` under `ipreq.q.<id>`, one entry each. That means they
are **per browser and per device**: they are not shared between people, do not follow you to another
machine, and are lost if the browser's site data is cleared. **Export and import in bulk** is how
they get out, and back.

## Export and import in bulk

The start page moves whole sets of captures in one step, under **Move captures between browsers**.

**Exporting.** Every questionnaire under *In progress* carries a tick box, and the bar above the
list selects or deselects them together. **Export** then writes the ticked ones:

| | What it writes | Read back by |
| --- | --- | --- |
| Bundle (`.yaml`) | every ticked questionnaire in one file | this app |
| Bundle (`.json`) | the same, as JSON | this app |
| `questionnaire.yaml` | one YAML document per need, `---` separated, across every ticked capture | the DRS drafting agent (one way — it does not import back) |

A bundle is a list of ordinary answers documents under `documents:`, each with the draft's own
name, id and timestamps under `meta.draft`. Lift one entry out and it is a valid single answers
file; a draft whose template will not load is still written out, with its answers untouched and
`meta.template_unavailable: true`, so a bulk export never silently drops someone's work.

**Importing.** **Import…** takes several files at once and reads bundles, single answers files, and
several answers documents concatenated with `---`. Nothing is written until a dialog has shown what
is in the files. Where a questionnaire is already saved in this browser — the same `meta.draft.id`,
so a backup restored onto its own machine — that dialog asks what to do:

- **Replace the copy here** (default) — the version in the file wins.
- **Keep both** — the incoming copy gets a fresh id, and nothing here is overwritten.
- **Leave them alone** — only the ones new to this browser come in.

Anything that names no template is reported and skipped rather than guessed at. A
`questionnaire.yaml` written for the DRS agent cannot be imported: it is a one-way hand-off format
keyed by question ID, not the app's round-trippable one.

This is also the backup story. Nothing is uploaded anywhere — the file lands in the browser's
downloads folder, and where it goes next is the client's choice.

## One capture, several needs

A capture interview covers one project but usually surfaces several needs, and the playbook gives
each need its own file. So a draft is **one capture session**: the project details are answered once,
and the block from *Need details* to *External programme* repeats per need.

Use **+ Add need** in the stepper or on the review page. Each need carries its own routing answer, so
one need can open Module D while another opens Module A. Removing a need leaves the others untouched.

Keep each need as small as it can be while still standing on its own — one observable outcome, one
tester, one acceptance check. The review page flags the shapes that usually mean two needs wearing
one coat: a routing answer spanning several streams, no acceptance check, no stated scope boundary,
no named tester. Those notes are advisory and never block anything.

## Two need forms: short and long

The same need can be captured with either of two templates. They share question IDs, so a file from
one is readable beside a file from the other, and both export the same `questionnaire.yaml`.

| | **Need Capture — short form** | **Need Capture - long form** |
| --- | --- | --- |
| File | `templates/need-capture-short.md` | `templates/need-capture-template.md` |
| Questions per need | 11, plus one paragraph per stream selected | about 45 |
| Fits on | one screen | eleven steps |
| Use it | for most captures, and for anything an agent drafts | when a stream reviewer is in the room and the detail is being settled there and then |

**What the short form asks per need.** `need_id` and `need_description` (the need in one sentence,
with where it came from), `C0` routing, `C2` what happens today and what this unblocks, `C5` one
acceptance check, `C6` the tester, `C7` when it is needed and what happens if it slips, `C11` what
is out of scope, `F1` five flags, `F2` one line on any flag that is ticked, and `raw_notes`. Each
stream ticked in `C0` adds one paragraph: `D0`, `S0` or `A0`.

**What it drops, and where that work goes instead.**

| Dropped | Why |
| --- | --- |
| `C1` (what decision this supports) | folded into `C2`, which now asks for the cost today *and* what it unblocks — one field, both halves of the rationale |
| `C3` (why do you need that) | that is the need itself; it is `need_description`, not a separate answer |
| `C8` (who else needs the same thing) | CI already posts the five nearest requirements and capabilities on every new requirement, and does it better than recall does. The portfolio manager adds `source_projects` at triage. |
| `C9`, `C10` (agent access, DBTL and lifecycle stages) | classification the DRS drafting agent proposes and the portfolio manager confirms. `C9` survives as one flag in `F1`. |
| `C4` (producers and consumers) | belongs with the stream detail; answer it in `D0` or `S0` where it is actually used |
| Modules D, S, A — 20 questions | collapsed to one paragraph each. The 20 questions are specification detail: they are asked at phase 2 by the team that will deliver the thing, not at capture by someone who does not yet know which team that is. |
| Instruments, Sharing and IP, Personal data, Automation, External programme — 18 questions | collapsed to five checkboxes (`F1`) plus one line (`F2`). The flag is what has to be known early, because it changes who must be in the room; the detail follows the flag. |
| `session_notes` | the short form captures one need per file, so the session record has nowhere to live. Use the long form for a whole-interview archive. |

The cost of the short form is real and worth stating: a capture that stops at eleven questions
leaves more for the specification step, so it needs a stream reviewer later rather than earlier. In
exchange, a need fits on one screen, which is what makes reviewing twenty of them possible.

## From notes to needs: the capture skill

[`.claude/skills/need-capture/`](.claude/skills/need-capture/) turns free text — an interview
transcript, meeting notes, an email thread, a kick-off summary — into one need file per need, in the
format the app imports.

```
transcript, notes, email
      ↓  /need-capture  (agent skill)
needs/<project>-NEED-0001-need.yaml       one need per file, app import format
      ↓  node scripts/validate-need-yaml.mjs needs/*.yaml
      ↓  app: Open an answers file -> Edit a copy
      ↓  app: Export -> questionnaire.yaml
the DRS drafting agent
```

Each answer carries its question as a `# <key> — <question>` comment above it, so a reviewer reads
the file without the template open beside it:

```yaml
        # C5 — How will you know it works? One concrete check.
        C5: ''
```

The questions are comments rather than data because the app's import reads `key: value`; an answer
written as `{question: …, answer: …}` would not load. `--skeleton` writes a blank file with those
comments generated from the template, so they cannot drift from the questions actually being asked,
and the validator warns about any answer missing one. Structured question-and-answer pairs are what
the app's own **Export → questionnaire.yaml** produces for the DRS agent.

The skill's rule is that an empty field beats a plausible invention: a tester, a date or an
acceptance check that nobody actually stated is left blank and named as an open question, so the
follow-up conversation knows what to ask. Splitting is the other half of its job — one outcome, one
tester, one acceptance check per file.

`scripts/validate-need-yaml.mjs` checks a file before anyone opens it. **Errors** are keys the app
would silently drop into "Other answers"; **warnings** are for the human reviewer — an empty `C5` is
often the honest result of a conversation that never got there. `--questionnaire` prints the DRS
hand-off the app would export, which is the quickest way to see whether a need reads sensibly on its
own.

```bash
node scripts/validate-need-yaml.mjs --questionnaire .claude/skills/need-capture/example-need.yaml
```

## From needs to requirements

The app deliberately collects **needs**, not requirements. Asking a project team to write
"the system shall…" produces solutions dressed as requirements; asking what goes wrong today and
what they need to be able to do produces something a platform team can actually prioritise.

```
templates/needs-statement-template.md     the questionnaire the app serves
          ↓  client fills it in, exports the filled Markdown
    /needs-to-requirements                 agent skill, run by the platform team
          ↓  writes a document against
templates/requirement-specification-template.md
```

The hand-off is a file, and there are two YAML exports because they answer different questions:

| Export | For | Shape |
| --- | --- | --- |
| **questionnaire.yaml — this need only** | the DRS drafting agent | one need, named `<project>-<need id>-questionnaire.yaml`. Offered while you are working inside a need. |
| **questionnaire.yaml — all needs** | the DRS drafting agent | the playbook's Part 3 format: `need_id`, `need_description`, `project_id`, `project`, `portfolio_manager`, `mode`, `date`, `participants` at the top level, then `answers` keyed by question ID — each one a `question` and an `answer`, so the file reads without the template beside it — then that need's `raw_notes`. `session_notes` is deliberately left out: the hand-off is one need, not the interview. One document per need — a session with several needs exports them `---` separated, which splits into one file each. The review page also offers each need on its own. |
| **YAML (.yaml)** | this app | the app's own shape, nested by section and including the needs array. This is what **Open an answers file** reads back, so it is the one to keep as an archive. |

Only questions pinned with `{#ID}` reach `questionnaire.yaml`; interviewer helpers such as the
before-capture checklist stay out of the hand-off.

Three fields carry provenance, at three levels:

| Field | Level | What it holds |
| --- | --- | --- |
| `need_description` | per need | One sentence saying what the need is and where in the raw material it came from — a transcript timestamp, a set of notes, a document. |
| `raw_notes` | per need | *Need notes*, the last step of each need: the part of the conversation that need came out of. |
| `session_notes` | per session | *Closing the capture*, outside the repeated block: the interview as a whole — scope, sources, decisions and anything spanning several needs. Kept in the app's own YAML, but **not** written into the agent hand-off. |

So the agent hand-off carries one need and that need's notes; the session record stays in the app's own YAML export.

Both templates are offered on the start page. The needs statement is what you send a project team.
The specification is normally written by the skill, but having it in the app lets the platform team
draft or refine one by hand, and walk through it section by section with the project team.

Note the asymmetry: the skill writes **Markdown**, and the app opens only its own YAML/JSON answer
format. So a specification produced by the skill cannot be loaded back into the app — the template
is there to be filled in, not to display the skill's output.

`requirements.md`, the single combined questionnaire this pair replaced, carries `hidden: true`: it
stays in the repository and is still served, so questionnaires started before the split still open,
but it is not offered to anyone new.

## Receiving answers

The app never sends anything anywhere. When a client finishes, **Send your answers** downloads the
YAML and offers a `mailto:` link per entry in `contacts`, pre-filled with the questionnaire's name;
the client attaches that file to the email.

To read an answers file, open the site and use **Open an answers file** on the start page. It
renders the YAML or JSON against its template as a document, which you can export as Markdown, or
open as a new questionnaire of your own with **Edit a copy** to refine together with the client.

If the template has changed since the answers were made, answers are matched by question key, and
anything that no longer matches is listed under "Other answers", so nothing is lost.

## Writing templates

A template is an ordinary Markdown document that also reads well on GitHub. The app infers the
questions from a few conventions:

| In the Markdown | In the app |
| --- | --- |
| Optional front matter: `title`, `description`, `order`, `hidden` | Start-page card and template identity |
| `# Title` | Questionnaire title |
| Text before the first `##` | Intro shown at the top of the first section |
| `## Section` | One step of the questionnaire |
| `### Sub-heading` | Heading inside a step; also names a table below it |
| `**Label:** [prompt]` (paragraph or list item) | Text question; the prompt becomes the placeholder |
| 2-column table, `[prompt]` in the second column | One question per row (first column = label) |
| 3+ column table with a row of `[prompt]` cells | Repeatable records with **Add** / **Remove** |
| …first cell like `REQ-01` | Auto-numbered ID (REQ-02, REQ-03, …) |
| …first cell plain text (e.g. `Project lead`) | Preset row with that label |
| `[A / B / C]` | Single choice |
| `[A / B; note]` | Single choice plus a note box |
| `[P0-P3]` | Choice P0, P1, P2, P3 |
| `[Date]` or `[YYYY-MM-DD]` | Date picker |
| `[a, b, c, d, or e]` (4+ short items) | Text with clickable suggestions |
| `- [ ] item` | Checkbox |
| `{#C1}` before a label or checkbox item | Pins that answer's key to `C1` instead of a slug of its text; the marker is not shown |
| `> **Show when:** C0 includes data` under a `##` | The section is only asked when the condition holds |
| `> **Repeats per:** need` under a `##` | The section is asked once per need |
| Anything else (paragraphs, quotes, lists, tables without prompts) | Guidance text, shown read-only |

Two front-matter fields are better left unset. **`id`** defaults to the filename, so setting it
only creates a second place to keep in sync. **`version`** defaults to a hash of the file's
contents, which is what lets the app warn someone that a template changed under a draft they had
already started; pinning it to a literal silently disables that warning, because the value then
never changes when you edit the file.

Set `hidden: true` on a Markdown file that lives in `templates/` but is not a questionnaire — a
document the app should still be able to serve, but never offer on the start page.

### Conditional sections

A `##` section may open with a `Show when:` quote. While the condition is false the section is not
asked at all: it leaves the stepper, is skipped by next/previous, drops out of the progress count and
does not appear in the review document. Answers already given are kept, so changing your mind back
restores them.

```markdown
## Module D — Data, standards and LIMS

> **Show when:** `C0` includes `data`
```

Four forms are understood, each naming one question by its key:

| Condition | True when |
| --- | --- |
| `C0 includes data` | that checkbox is ticked (`C0 includes data or software` for either) |
| `C9 is yes` | a single-choice answer equals `yes` |
| `C9 is not no` | it is anything other than `no` |
| `D1 is answered` | the question has any answer |

Because a condition names a question, give that question a stable key with `{#C0}`; otherwise the key
is a slug of its wording and rewording the question silently breaks the condition. A condition naming
a question the template does not define is ignored and the section is always asked, so a typo makes a
section appear rather than vanish.

### Repeatable sections

A run of `##` sections may be marked `> **Repeats per:** <label>`, making it a block the questionnaire
asks once per instance. The marked sections must be next to each other; the build script fails loudly
if they are not, so the mistake surfaces in CI rather than in a browser.

```markdown
## Routing question

> **Repeats per:** need
```

Those sections' answers live under `answers.<label>s[i]` instead of at the top level, and conditions
inside the block are evaluated against that instance — so each need routes independently. A condition
may still name a project-level question, and vice versa.

Answer keys come from the section headings and labels (`## Document Control` + `Project / campaign`
→ `document_control.project_campaign`). Renaming a heading or label therefore changes its key.
Older answer files still open, but the renamed answers appear under "Other answers".

To add a template:

1. Copy `templates/needs-statement-template.md` to `templates/<id>.md` and edit it.
2. Run `node scripts/build-template-index.mjs` to preview locally (CI does this on deploy).
3. Commit and push.

## Answer file format

```yaml
# Need Capture — short form
template:
  id: need-capture-short
  title: Need Capture — short form
  version: eb44510a            # hash of the template file (or front-matter `version`)
  source: templates/need-capture-short.md
meta:
  app: ip-requirements-app     # the file format's id, not the repository's — unchanged by the rename
  format_version: 1
  exported_at: '2026-11-24T15:22:02.350Z'
  submitted_at: '…'            # on submission
  submitted_by: { name: …, email: … }
answers:
  capture_details:
    project_id: P5.1
    project: Cell factory engineering for a C4 chemical, Mission 1B
    date: '2026-11-04'
  needs:                                           # the repeated block, one entry per need
    - need:
        need_id: NEED-0001
        C0: { a: true, b: false, c: false }        # checkbox list: option -> ticked
        C5: Given a project, all runs' metadata under it are returned.
        C6: Felix Weichselbaum
      data_detail:                                 # only present when C0 includes a
        D0: Which entities, how they are identified, and against which standard.
```

Two shapes this example does not show, because the short form has no question of either kind: a
3+ column table exports as a list of row objects, and a `[A / B; note]` choice exports as
`{ choice: …, note: … }`.

Unanswered questions are exported as empty strings, so open items stay visible.

A bulk export nests these same documents in a list, and adds who each one was:

```yaml
meta:
  app: ip-requirements-app
  format_version: 1
  kind: need-capture-bundle
  exported_at: '2026-11-27T09:14:51.002Z'
  count: 2
documents:
  - template: { id: need-capture-short, … }
    meta:
      exported_at: '2026-11-27T09:14:51.002Z'
      draft:                                       # restores the draft as it left
        id: need-capture-short-mh2k8f0a1b
        title: ''                                  # empty: the app names it from the answers
        created_at: '2026-11-20T09:00:00.000Z'
        updated_at: '2026-11-25T14:30:00.000Z'
    answers: { … }
  - …
```

## How this app was built

This repository is openly an AI-assisted build, and it is worth being precise about who did what.

**Ding He** (<dinghe@dtu.dk>) directed the work: set the requirements, made the design decisions,
reviewed the output and decided what shipped. **Claude Opus 5** (model id `claude-opus-5`), running
in [Claude Code](https://claude.com/claude-code), wrote the application code — the HTML, CSS and
JavaScript under `index.html`, `css/` and `js/`, the build script and the Pages workflow — across a
short series of sessions in October 2026.

The split that matters for anyone reading or reusing this:

- **Questionnaire content is human-authored.** The Markdown templates in [`templates/`](templates/)
  — the questions, the guidance, the structure of a requirements conversation — are the Informatics
  Platform team's domain work, not generated within this web app implementation phase.
- **Application code is model-generated.** Architecture choices (browser-local
  drafts, no backend, YAML as the canonical format, dropping the submission relay) were made by a
  human (Ding He) and implemented by the model.

Treat the code as you would any contribution you did not write yourself: read it before trusting
it, and verify behaviour rather than assuming it. It is deliberately small, dependency-free and
commented, so it can be read end to end in one sitting — about 1,300 lines of JavaScript across
four modules.

If you change it, you are under no obligation to keep using an AI to do so ;)

## License

[MIT](LICENSE) — © 2026 BRIGHT Informatics Platform, Technical University of Denmark (DTU).

Use it, fork it, adapt it for your own group; just keep the copyright and permission notice. The
questionnaire templates in [`templates/`](templates/) are covered by the same license, so you are
free to reuse and adapt the questions as well as the code.

The one piece of third-party code is [js-yaml](https://github.com/nodeca/js-yaml) 4.2.0, vendored
at [`vendor/js-yaml.mjs`](vendor/js-yaml.mjs) and also MIT; its notice is kept alongside it in
[`vendor/js-yaml.LICENSE`](vendor/js-yaml.LICENSE) and must stay there in any redistribution.
