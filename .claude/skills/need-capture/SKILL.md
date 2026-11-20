---
name: need-capture
description: Turn free text about what a project needs — an interview transcript, meeting or call notes, an email or Teams thread, a kick-off summary, a list of complaints about current tooling — into one small, reviewable need file per need, in the YAML the Informatics Platform requirements app imports. Use whenever someone asks to capture needs, draft needs from notes or a transcript, split a conversation into needs, fill in the need capture questionnaire from notes, or produce need YAML for the app or for the DRS drafting agent. Also use for "make needs out of this", "what are the needs in this transcript", or a pasted transcript with a request to capture it. Do not use to write requirements or a DRS — that is the specification step, downstream of this one.
version: 1
---

# Need capture from free text

Read raw material about a project, find the distinct needs in it, and write each
one as its own file that a human can review in under a minute and open in the
requirements app.

**A need is what hurts, in the requester's words.** It is not a requirement, not
a solution and not a plan. The DRS drafting agent turns needs into requirements
later; the triage board decides stream, priority and capability later. Your job
ends at a faithful, small, routable need.

**You are a transcriber with judgement, not an author.** Everything in the file
must be traceable to the source. An empty field with a note saying it was never
discussed is worth more than a plausible sentence nobody said — a specification
whose gaps are visible beats one that reads as complete and is not.

## The form you are filling

[`templates/need-capture-short.md`](../../../templates/need-capture-short.md) in
this repository. Read it before you start; it is the contract, and it carries the
exact wording of every question. Per need it asks for:

| Key | Question | Rule |
| --- | --- | --- |
| `need_id` | `NEED-0001`, numbered within the capture | Ask the user if the project already has needs; otherwise start at `NEED-0001` and say so. |
| `need_description` | The need in one sentence, plus where it came from | What they need to be able to do that they cannot today. End with the provenance in brackets: a timestamp, a section of notes, a document. |
| `C0` | What should exist when this is done: `a` data, `b` tool or service, `c` answer, analysis or model | At least one. More than one is a bundle — see *Splitting*. |
| `C2` | What happens today, and what this will make possible | Both halves: the current cost, and the decision or experiment it unblocks. |
| `C5` | One concrete acceptance check | Only if the source states something checkable. Do not invent one. |
| `C6` | The tester, one name | Only a name actually offered. "Probably the PI" is not a name. |
| `C7` | When it is needed and what happens if it slips | A date, milestone or campaign, and the consequence. |
| `C11` | What is out of scope | Often implicit: what the speaker ruled out, or the neighbouring need you split off. |
| `F1` | Flags: `instrument`, `sharing`, `personal`, `agent`, `programme` | Tick only on evidence. Write every option with `true` or `false`, so a reviewer sees what was considered. |
| `F2` | One line on any ticked flag | Leave empty when nothing is ticked. |
| `raw_notes` | The part of the conversation this need came from | Verbatim where it matters. Also the place to record what was *not* established. |
| `D0` / `S0` / `A0` | One paragraph of stream detail, only for the streams ticked in `C0` | Everything the delivery team already knows; the rest is asked at the specification step. |

Capture-level fields (`project_id`, `project`, `portfolio_manager`, `mode`,
`date`, `participants`) are the same in every file from one session. Set
`mode: Agent`. Use the date of the conversation, not today.

## Procedure

### 1. Read the whole source first

Do not start writing after the first need. People circle back; the acceptance
check for the need described in minute 3 often arrives in minute 40.

If no source was supplied, ask for it. Do not proceed from a one-line summary.

### 2. Find the needs, then split them

List candidate needs before writing any file. Each must stand on its own: **one
observable outcome, one tester, one acceptance check.**

Split when:

- the parts have different testers, or different acceptance checks;
- one part could be delivered and useful while the other is not started;
- the timing differs — one is needed for a campaign in March, the other is "some day";
- one part is a data contract the other depends on (write both; note the dependency in `raw_notes`).

Do **not** split a single outcome across the three streams. A need that needs a
standard *and* a tool *and* an analysis is one need with several `C0` boxes — a
bundle — as long as one check decides whether it worked. The requirement split
happens at the specification step, not here.

Merge when two complaints are the same underlying need wearing different clothes
(C3 of the long form: "why do you need that?" until the answers meet).

A solution in disguise — "we need a shared spreadsheet", "we need Benchling to do
X" — is not a need. Record the solution verbatim in `raw_notes`, and write the
need as the question it answers.

### 3. Route each need with C0

- `a` data — a standard, schema, identifier scheme, metadata capture, LIMS or catalog change.
- `b` software — a tool, service, API, MCP endpoint, integration, deployed infrastructure, production pipeline.
- `c` analysis — an answer, a figure, a model, an analytical pipeline, a benchmark.

Rules of thumb: anything that reads or writes project data and has no standard
behind it usually implies a data need too. A prototype analysis that several
projects will later run is `c` now and may become `b` later — do not pre-empt
that here.

### 4. Write one file per need

Name it `<project_id>-<need_id>-need.yaml`, for example `P5.1-NEED-0003-need.yaml`,
with anything unsafe for a filename replaced by `-`. Ask where to put them;
default to a `needs/` directory beside the source, and say where they went.

The shape, exactly — see [`example-need.yaml`](example-need.yaml) for a filled one:

```yaml
# Need Capture — short form
# Drafted by the need-capture skill from: <source>.
template:
  id: need-capture-short
meta:
  app: ip-requirements-app
  format_version: 1
  mode: agent
  source: <what you read, precisely enough to find it again>
  drafted_at: 'YYYY-MM-DD'
answers:
  capture_details:
    project_id: ''
    project: ''
    portfolio_manager: ''
    mode: Agent
    date: 'YYYY-MM-DD'
    participants: ''        # comma separated; the app splits it on export
  needs:
    - need:
        need_id: NEED-0001
        need_description: ''
        C0: { a: false, b: false, c: false }
        C2: ''
        C5: ''
        C6: ''
        C7: ''
        C11: ''
        F1: { instrument: false, sharing: false, personal: false, agent: false, programme: false }
        F2: ''
        raw_notes: |
          …
      data_detail:        # only when C0.a — omit the section otherwise
        D0: ''
      software_detail:    # only when C0.b
        S0: ''
      analysis_detail:    # only when C0.c
        A0: ''
```

Rules that keep the file importable:

- Keys are exactly as above. Anything else lands under "Other answers" in the app and is lost to the hand-off.
- `answers.needs` is a list, with **one entry** per file.
- Unanswered means `''`, never a guess, never `null`, never "TBD".
- Do not write `template.version`. It changes whenever the template is edited, and a stale value makes the app flag the file as out of date.
- Keep quotes as spoken in `raw_notes`. Normalise wording only in `need_description`.

### 5. Validate before you hand anything over

```bash
node scripts/validate-need-yaml.mjs needs/*.yaml
```

Errors mean the app would silently drop something — fix them. Warnings are for
the human reviewer: an empty `C5` or `C6` is often the correct output of a
conversation that never got that far, and the validator says so rather than
failing. Add `--questionnaire` to print the DRS hand-off the app would export
from the file, which is a good way to check that a need reads sensibly on its own.

### 6. Report, and say what is missing

In your reply, per need: one line of what it is, which streams it routes to, and
which fields are empty and why. Then list the open questions the capture leaves —
these are what the portfolio manager asks in the follow-up. Be direct that a need
with no `C5` and no `C6` cannot be closed later, so those are the first to settle.

Tell the user how to get the files into the app: open it, **Open an answers file**
on the start page, pick the file, then **Edit a copy** to edit it as a
questionnaire. From there **Export → questionnaire.yaml** produces the DRS
drafting agent's hand-off.

## What not to do

- Do not invent a tester, a date, a metric or an acceptance check. Empty is a valid answer.
- Do not write requirements ("the system shall…"). If you catch yourself writing *shall*, you have skipped a step that belongs to someone else.
- Do not merge needs to make a tidier file, or split them to look thorough. The test is one outcome, one tester, one check.
- Do not drop a complaint because it is vague. Capture it with empty fields and name the gap; a need nobody wrote down is a need nobody fixes.
- Do not fill `session_notes` or any field from the long form. This form does not have them.
- Do not put more than one need in a file unless the user explicitly asks for a session archive.
