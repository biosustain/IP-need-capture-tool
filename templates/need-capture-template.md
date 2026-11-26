---
title: Need Capture - long form
description: The single instrument for collecting a need, for all three streams and both portfolios. Led by the portfolio manager in a live interview; the answers become a DRS.
order: 1
---

# Need Capture - long form

> The questionnaire is the single instrument for collecting requirements, for all three streams and both portfolios. Every question has an ID and names the DRS field it fills, so the DRS drafting agent can turn the answers into DRS files directly. The portfolio manager (Ding for missions, Lea for external programmes) owns each questionnaire.

**Collection = questionnaire. Conversion = agent.** Nobody writes a DRS from free-form notes. Whichever way the questionnaire is completed, the result is one questionnaire.yaml, and the DRS drafting agent converts it into DRS files following the Standards Office guideline pack.

| Mode | When to use | Who leads | Time |
| --- | --- | --- | --- |
| Live interview | New projects and work packages, complex or multi-stream needs, external partners | Portfolio manager, with a stream reviewer when a module is technical | 30–45 min per need |

## Capture details

| Item | Value |
| --- | --- |
| {#project_id} Project ID | [Stable identifier for the unit this capture covers] |
| {#project} Project | [Readable name of the project, subproject or work package] |
| {#portfolio_manager} Portfolio manager | [Ding for missions, Lea for external programmes] |
| {#mode} Mode | [Interview / Agent / Self-service] |
| {#date} Date | [YYYY-MM-DD] |
| {#participants} Participants | [Who was in the session] |

## Before capture

- [ ] Read the need record and the project's existing needs and requirements in its registry folder.
- [ ] Search the functionality table for a capability that already looks similar.
- [ ] For external programmes: open the grant agreement deliverables and consortium standards linked in the programme file if existing.
- [ ] Invite the requester, the project standards contact and, if known, the person who will test the result.
- [ ] If the need is clearly software or data science, invite a reviewer from RSE or DS for that module.

## Need details

> **Repeats per:** need

One need per block. Keep each need as small as it can be while still standing on its own:
one observable outcome, one tester, one acceptance check. If parts of what you are hearing
have different testers or different acceptance checks, add another need rather than widening
this one.

| Item | Value |
| --- | --- |
| {#need_id} Need ID | [NEED-0000] |
| {#need_description} Need in one sentence | [What this need is, and where in the raw material it comes from — transcript timestamps, interview notes or a document] |

## Routing question

> **Repeats per:** need

Always asked first. The answer selects which stream modules follow.

### {#C0} When this is done, what should exist that does not exist today?

- [ ] {#a} (a) Data captured or described in a standard way
- [ ] {#b} (b) A tool, service or connection
- [ ] {#c} (c) An answer, analysis or model

Several answers mean a requirement bundle with one requirement per stream.

## Core questions

> **Repeats per:** need

Always asked.

**{#C1} What decision, experiment or analysis will this support?** [What this unblocks]

*Probe if the answer is vague:* Which step is blocked or slowed today?

**{#C2} What do you do today, and what breaks or takes too long?** [Current situation]

*Probe if the answer is vague:* How much time per week, or how many failed runs?

**{#C3} Why do you need that? Repeat until you reach the underlying need.** [The need behind the request]

*Probe if the answer is vague:* If we gave you X tomorrow, what would you do next with it?

**{#C4} Who or what produces this, and who or what uses it?** [Producers and consumers]

*Probe if the answer is vague:* Is any producer or consumer an instrument, a script or an agent?

**{#C5} How will you know it works? Describe one concrete check.** [Acceptance criteria]

*Probe if the answer is vague:* What would you look at on screen or in a file?

**{#C6} Who on your side can test it?** [Named tester]

*Probe if the answer is vague:* Who signs off before you rely on it?

**{#C7} What happens if it arrives in six months instead of two?** [Consequence and needed-by date]

*Probe if the answer is vague:* Is there a milestone, deliverable or campaign date?

**{#C8} Which other projects, partners or groups might need the same thing?** [Impact and reuse]

*Probe if the answer is vague:* Have you seen another project solve this already?

**{#C9} Should an agent be able to trigger, read or write this without a person?** [Yes / No]

*Probe if the answer is vague:* What would it need to know to do so safely?

**{#C10} Which DBTL stages and data lifecycle stages does this touch?** [Stages]

*Probe if the answer is vague:* Show the step on the project's workflow.

**{#C11} What is explicitly out of scope?** [Out of scope]

*Probe if the answer is vague:* What would you be happy to leave for later?

## Module D — Data, standards and LIMS

> **Repeats per:** need

> **Show when:** `C0` includes `a`

Data stream, Standards Office. A stream reviewer from the owning team may join for this part.

**{#D1} Which entities are involved, and how are they identified today?** [Sample, strain, construct, run, measurement…]

**{#D2} What does the data look like: volume, frequency, how fast it must be available, how sensitive?** [Data profile]

**{#D3} Which community standards, minimum-information checklists, formats or ontologies do you use or must follow?** [Standards]

**{#D4} Which fields are mandatory for your analysis, and which vocabularies do you use for them?** [Mandatory fields and vocabularies]

**{#D5} Where is the data created: instrument, LIMS, ELN, script? What links a sample to its parent and its measurements?** [Origin and links]

**{#D6} What would make you trust that the data is complete and correct?** [Data quality acceptance]

## Module S — Software

> **Repeats per:** need

> **Show when:** `C0` includes `b`

Software stream, RSE. A stream reviewer from the owning team may join for this part.

**{#S1} Who will use it: which people, roles or agents, and how many?** [Users]

**{#S2} How should they reach it: web interface, command line, API, MCP tool for agents?** [Interface]

**{#S3} Which systems must it connect to?** [LIMS, ELN, data lake, instruments, HPC, Seqera]

**{#S4} Where should it run, and what availability do you expect?** [Deployment and availability]

**{#S5} Are there performance or security limits that matter?** [Response time, data size, access restrictions]

**{#S6} Who will own and maintain it after delivery?** [Maintainer]

**{#S7} Expected storage growth and compute needs, for infrastructure requests?** [Non-functional needs]

## Module A — Analysis and models

> **Repeats per:** need

> **Show when:** `C0` includes `c`

Data-science stream, DS. A stream reviewer from the owning team may join for this part.

**{#A1} What is the scientific question, stated as something that can be answered with data?** [Scientific question]

**{#A2} Which data will it use? Is that data already in the catalog, and is it standardised?** [Input data]

**{#A3} What should come out: a figure, a table, a model, a pipeline, a report?** [Outputs]

**{#A4} How will we judge success: which metric, against which baseline, and what threshold is good enough?** [Evaluation]

**{#A5} Are there methods you must use or avoid, or results it must reproduce?** [Method constraints]

**{#A6} Will others run this again on new data? How often?** [Reuse and frequency]

**{#A7} Which versions of data, code and models must be tracked to reproduce the result?** [Reproducibility]

## Instruments

> **Repeats per:** need

> Trigger: C4 or D5 names an instrument or robot. Skip this section if it does not.

**{#IN1} Which instrument and software version?** [Instrument and version]

**{#IN2} Native file format?** [Format]

**{#IN3} API or disk export only?** [Access route]

**{#IN4} Who maintains the method?** [Method owner]

## Sharing and IP

> **Repeats per:** need

> Trigger: external partners, publication or company data. Skip this section if none apply.

**{#SH1} Who outside the group needs access, and when?** [External access]

**{#SH2} Embargo or licence?** [Embargo or licence]

**{#SH3} Must data go to a public repository?** [Public repository]

## Personal and clinical data

> **Repeats per:** need

> Trigger: human samples or participant data. Skip this section if none are involved.

**{#PD1} Personal or pseudonymised?** [Personal or pseudonymised]

**{#PD2} Which approvals cover it?** [Approvals]

**{#PD3} Where may it be stored and processed?** [Storage and processing]

**{#PD4} Which models may see it?** [Permitted models]

## Automation and agents

> **Repeats per:** need

> **Show when:** `C9` is `yes`

**{#AU1} Which actions may an agent take alone, and which need a human check?** [Autonomy boundary]

**{#AU2} What must be logged for audit?** [Audit log]

**{#AU3} What should happen on failure?** [Failure behaviour]

## External programme

> **Repeats per:** need

> Trigger: the need comes from a programme in Lea's portfolio. Skip this section otherwise.

**{#EP1} Which deliverable or milestone does it serve?** [Deliverable or milestone]

**{#EP2} Which consortium or infrastructure standards apply?** [Standards]

**{#EP3} Which partners produce or consume the data?** [Partners]

**{#EP4} What must be reported to the funder, and when?** [Reporting]

## Need notes

> **Repeats per:** need

**{#raw_notes} Raw notes for this need** [What was said about this need — verbatim where it matters, quotes kept as spoken]

*What belongs here:* the part of the conversation this need came out of. Anything that applies to
the whole session goes in the session notes at the end instead.

## Closing the capture

- [ ] Read back the normalised answer(s) and acceptance criteria; agree on wording.
- [ ] If C0 selected several streams, confirm the bundle: one requirement per stream and the order of dependencies.
- [ ] Confirm testers, priority and needed-by date.
- [ ] Tell the requester when to expect the DRS draft for confirmation and the next triage date.
- [ ] Save the answers in the need folder, with the raw notes; the drafting agent and later reviewers read both.

**{#session_notes} Raw notes for the session** [The interview as a whole — scope, sources, decisions and anything spanning several needs]

## Interviewing tips

- Users often arrive with a solution ("we need a spreadsheet template"). Record it under Context, then use C3 to find the need behind it.
- Ask for one real example (a file, a run, a screenshot) rather than a general description.
- Split into several requirements when parts have different streams, testers or acceptance criteria.
- For external programmes, start from the deliverable text: it usually already contains the acceptance criterion.
