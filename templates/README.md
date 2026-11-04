# Templates

| File | Role |
| --- | --- |
| `need-statement-template.md` | The questionnaire the portfolio manager runs in a capture interview. Follows Part 1 (process and workflow) and Part 3 (requirements questionnaire). |
| `requirement-specification-template.md` | The shape of the `/needs-to-requirements` output, and also offered in the app so a specification can be drafted or refined by hand. |
| `needs-statement-template.md` | The earlier plain-language needs statement. `hidden: true`, kept so drafts started before the change still open. |
| `requirements.md` | The single combined questionnaire that preceded the needs/specification split. `hidden: true`, kept for the same reason. |

A file with `hidden: true` stays in this folder and is still served, but is left out of
`index.json` and so never appears on the start page.

After adding or editing a file, run `node scripts/build-template-index.mjs` (the deploy workflow
does this automatically).

See "Writing templates" and "From needs to requirements" in the main README for the conventions,
including `{#id}` keys and `Show when:` conditional sections.
