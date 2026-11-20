---
title: Need Capture — short form
description: One screen per need. Ten questions that a DRS can actually be drafted from, with the stream detail left to the specification step. Use this for most captures; the long form is for when a stream reviewer is in the room.
order: 0
---

# Need Capture — short form

> A need is what hurts, in the requester's own words. It is not a requirement, and it does not have to be complete. This form asks only what the DRS drafting agent cannot infer and the triage board cannot decide without: what is needed, what happens today, how you would know it works, who tests it, when it is needed, and what is out of scope. Everything else is asked at the specification step, by the team that will deliver it.

**One need per block.** Keep each as small as it can stand on its own: one observable outcome, one tester, one acceptance check. If two parts of what you are hearing have different testers or different checks, add a second need rather than widening this one.

## Capture details

| Item | Value |
| --- | --- |
| {#project_id} Project ID | [Stable identifier for the unit this capture covers] |
| {#project} Project | [Readable name of the project, subproject or work package] |
| {#portfolio_manager} Portfolio manager | [Ding for missions, Lea for external programmes] |
| {#mode} Mode | [Interview / Agent / Self-service] |
| {#date} Date | [YYYY-MM-DD] |
| {#participants} Participants | [Who was in the session, comma separated] |

## Need

> **Repeats per:** need

| Item | Value |
| --- | --- |
| {#need_id} Need ID | [NEED-0000] |
| {#need_description} The need, in one sentence | [What you need to be able to do that you cannot do today — and where this came from: a transcript timestamp, a set of notes, a document] |

### {#C0} When this is done, what should exist that does not exist today?

- [ ] {#a} (a) Data captured or described in a standard way
- [ ] {#b} (b) A tool, service or connection
- [ ] {#c} (c) An answer, analysis or model

> More than one box means a requirement bundle — one requirement per stream, delivered in order. If the parts also have different testers or different checks, they are different needs.

**{#C2} What happens today, and what will this make possible?** [What people do now and what it costs in time, errors or rework — and the decision, experiment or analysis it unblocks]

**{#C5} How will you know it works? One concrete check.** [Something you could do or look at and see pass or fail]

**{#C6} Who on your side will test it?** [One name]

**{#C7} When do you need it, and what happens if it slips?** [A date or a milestone, and the consequence of missing it]

**{#C11} What is explicitly out of scope?** [What you are happy to leave for later]

### {#F1} Does any of this apply?

- [ ] {#instrument} An instrument or robot produces or consumes the data
- [ ] {#sharing} External partners, publication, embargo or company data
- [ ] {#personal} Human samples or participant data
- [ ] {#agent} An agent should be able to trigger, read or write this without a person
- [ ] {#programme} This comes from an externally funded programme or consortium

**{#F2} Anything the boxes above need in one line?** [Only what you already know — the detail is asked at the specification step]

**{#raw_notes} Notes for this need** [The part of the conversation this need came out of. Quotes kept as spoken.]

## Data detail

> **Repeats per:** need

> **Show when:** `C0` includes `a`

Standards Office. One paragraph is enough — Txell or Mía will work the rest out with you when the requirement is drafted.

**{#D0} What is being described, and against what?** [Which entities (sample, strain, run, measurement), how they are identified today, where the data is created, and any standard, checklist or vocabulary you must follow]

## Software detail

> **Repeats per:** need

> **Show when:** `C0` includes `b`

RSE. One paragraph is enough — the detail comes at the specification step.

**{#S0} Who uses it, how do they reach it, and what must it connect to?** [People, roles or agents; web, command line, API or MCP; the systems it has to talk to; anything about where it runs that you already know]

## Analysis detail

> **Repeats per:** need

> **Show when:** `C0` includes `c`

Data Science. One paragraph is enough — the detail comes at the specification step.

**{#A0} What is the question, what goes in, and what comes out?** [The scientific question stated so data can answer it; which data it uses and whether that data exists already; whether the result is a figure, a table, a model or a pipeline]

## Closing the capture

- [ ] Read back each need in one sentence and its acceptance check; agree on the wording.
- [ ] Confirm the tester and the needed-by date for every need.
- [ ] Say when the DRS draft comes back for confirmation, and when the next triage is.
