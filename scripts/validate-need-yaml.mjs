#!/usr/bin/env node
// Checks a need file against the template it claims, before anyone opens it in the app.
//
//   node scripts/validate-need-yaml.mjs <file.yaml> [more.yaml ...]
//   node scripts/validate-need-yaml.mjs --questionnaire <file.yaml>   # print the DRS hand-off
//   node scripts/validate-need-yaml.mjs --skeleton [template-id]      # blank file, questions included
//
// Errors (exit 1) are things that would be silently dropped or shown under
// "Other answers" when the file is opened: a missing answers block, a key the
// template does not define, a checkbox option that does not exist.
// Warnings (exit 0) are things a human reviewer should look at: no acceptance
// check, no tester, a stream ticked with no detail written for it.
//
// Every answer carries its question as a `# <key> — <question>` comment above it.
// The app ignores comments, so the file stays importable; a reviewer reads the
// file without the template beside it. --skeleton writes those comments from the
// template, so they cannot drift from the questions actually being asked.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from '../vendor/js-yaml.mjs';
import { buildTemplate } from '../js/template.js';
import { toQuestionnaireYAML, getValue, isFilled, scope } from '../js/answers.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const wantQuestionnaire = args.includes('--questionnaire');
const wantSkeleton = args.includes('--skeleton');
const files = args.filter((a) => !a.startsWith('--'));

if (!files.length && !wantSkeleton) {
  console.error('usage: node scripts/validate-need-yaml.mjs [--questionnaire] <file.yaml> ...');
  console.error('       node scripts/validate-need-yaml.mjs --skeleton [template-id]');
  process.exit(2);
}

const DEFAULT_TEMPLATE = 'need-capture-short';
const templates = new Map();
function template(id) {
  if (!templates.has(id)) {
    const file = join(root, 'templates', `${id}.md`);
    templates.set(id, buildTemplate(readFileSync(file, 'utf8'), { id, path: `templates/${id}.md` }));
  }
  return templates.get(id);
}

/** The question for one slot, as the template puts it. */
const questionOf = (slot) => slot.item.question || slot.item.label || slot.key;

/** `# <key> — <question>`, plus one line per option on a checkbox list. */
function commentFor(slot, pad) {
  const lines = [`${pad}# ${slot.key} — ${questionOf(slot)}`];
  if (slot.kind === 'checklist') {
    for (const o of slot.item.options) lines.push(`${pad}#     ${o.key} = ${o.label.replace(/^\([a-z]\)\s*/, '')}`);
  }
  return lines.join('\n');
}

/** A blank need file with every question written in as a comment. */
function skeleton(tpl) {
  const blank = (slot, pad) => {
    if (slot.kind === 'checklist') return `{ ${slot.item.options.map((o) => `${o.key}: false`).join(', ')} }`;
    if (slot.key === 'raw_notes') return `|\n${pad}  what was said, and what was never established`;
    if (slot.key === 'mode') return 'Agent';
    if (slot.key === 'need_id') return 'NEED-0001';
    if (slot.key === 'date') return "'YYYY-MM-DD'";
    return "''";
  };
  /** `pad` indents the section key; its answers sit two spaces deeper. */
  const sectionBlock = (s, pad, firstKeyPrefix = '') => {
    const slots = s.slots.filter((sl) => tpl.idKeys.has(sl.key));
    if (!slots.length) return [];
    const inner = pad + '  ';
    const out = [`${firstKeyPrefix || pad}${s.key}:${s.when ? `   # only when ${s.when.src}` : ''}`];
    for (const sl of slots) {
      out.push(commentFor(sl, inner));
      out.push(`${inner}${sl.key}: ${blank(sl, inner)}`);
    }
    return out;
  };

  const r = tpl.repeat;
  const lines = [
    `# ${tpl.title}`,
    '# Drafted by the need-capture skill from: <source>.',
    '# One need per file. Comments carry the question; the app ignores them.',
    'template:',
    `  id: ${tpl.id}`,
    'meta:',
    '  app: ip-requirements-app',
    '  format_version: 1',
    '  mode: agent',
    '  source: <what you read, precisely enough to find it again>',
    "  drafted_at: 'YYYY-MM-DD'",
    'answers:',
  ];
  for (const s of tpl.sections) {
    if (r && r.sections.includes(s)) continue;
    lines.push(...sectionBlock(s, '  '));
  }
  if (r) {
    lines.push(`  ${r.key}:`);
    r.sections.forEach((s, i) => {
      const block = sectionBlock(s, '      ', i === 0 ? '    - ' : '      ');
      lines.push(...block);
    });
  }
  return lines.join('\n') + '\n';
}

if (wantSkeleton) {
  process.stdout.write(skeleton(template(files[0] || DEFAULT_TEMPLATE)));
  process.exit(0);
}

let errors = 0;
let warnings = 0;
const err = (m) => { errors++; console.log(`  ✗ ${m}`); };
const warn = (m) => { warnings++; console.log(`  ! ${m}`); };
const ok = (m) => console.log(`  · ${m}`);

for (const file of files) {
  console.log(`\n${file}`);
  const errorsBefore = errors;
  let doc, raw;
  try { raw = readFileSync(file, 'utf8'); doc = load(raw); } catch (e) { err(`not valid YAML: ${e.message.split('\n')[0]}`); continue; }
  // `# <key> — <question>` above an answer is how the file carries its questions.
  const documented = new Set([...raw.matchAll(/^[ \t]*#[ \t]*([A-Za-z_][\w]*)[ \t]*[—–-]/gm)].map((m) => m[1]));
  const undocumented = [];
  if (!doc || typeof doc !== 'object' || !doc.answers || typeof doc.answers !== 'object') {
    err('no "answers:" block — the app would refuse this file');
    continue;
  }

  const id = doc.template?.id || DEFAULT_TEMPLATE;
  let tpl;
  try { tpl = template(id); } catch { err(`unknown template "${id}" — no templates/${id}.md in this repository`); continue; }
  if (!doc.template?.id) warn(`no template.id; assuming "${DEFAULT_TEMPLATE}"`);
  if (doc.template?.version && doc.template.version !== tpl.version) {
    warn(`template.version ${doc.template.version} is not the current ${tpl.version}; leave the field out so the app does not flag the file as stale`);
  }

  const sections = new Map(tpl.sections.map((s) => [s.key, s]));
  const inRepeat = new Set(tpl.repeat ? tpl.repeat.sections.map((s) => s.key) : []);

  // Any key the template does not define is lost to "Other answers" in the app.
  const checkSection = (key, value, where) => {
    const s = sections.get(key);
    if (!s) return err(`${where}: unknown section "${key}"`);
    const slots = new Map(s.slots.map((sl) => [sl.key, sl]));
    for (const [k, v] of Object.entries(value || {})) {
      const sl = slots.get(k);
      if (!sl) { err(`${where}: unknown question "${key}.${k}"`); continue; }
      if (!documented.has(k) && !undocumented.includes(k)) undocumented.push(k);
      if (sl.kind === 'checklist') {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const opts = new Set(sl.item.options.map((o) => o.key));
          for (const o of Object.keys(v)) if (!opts.has(o)) err(`${where}: unknown option "${key}.${k}.${o}" (expected ${[...opts].join(', ')})`);
        } else {
          err(`${where}: "${key}.${k}" is a checkbox list; write it as a map of option -> true, not ${Array.isArray(v) ? 'a list' : typeof v}`);
        }
      } else if (v != null && typeof v === 'object') {
        if (!('choice' in v)) err(`${where}: "${key}.${k}" should be a string`);
      }
    }
  };

  for (const [k, v] of Object.entries(doc.answers)) {
    if (tpl.repeat && k === tpl.repeat.key) continue;
    if (inRepeat.has(k)) { err(`"${k}" is answered once per ${tpl.repeat.label}; move it inside answers.${tpl.repeat.key}[]`); continue; }
    checkSection(k, v, 'capture');
  }

  const needs = tpl.repeat ? doc.answers[tpl.repeat.key] : null;
  if (tpl.repeat && !Array.isArray(needs)) {
    err(`answers.${tpl.repeat.key} must be a list, one entry per ${tpl.repeat.label}`);
  } else if (tpl.repeat) {
    if (needs.length > 1) warn(`${needs.length} needs in one file — the hand-off is one need per file; split unless you meant a session archive`);
    needs.forEach((need, i) => {
      const where = `need ${i + 1}`;
      for (const [k, v] of Object.entries(need || {})) {
        if (!inRepeat.has(k)) { err(`${where}: "${k}" is a capture-level section; move it out of answers.${tpl.repeat.key}[]`); continue; }
        checkSection(k, v, where);
      }
      const sc = scope(tpl, doc.answers, i);
      const val = (secKey, slotKey) => {
        const s = sections.get(secKey);
        const sl = s?.slots.find((x) => x.key === slotKey);
        return sl ? { sl, v: getValue(sc, s, sl) } : null;
      };
      const filled = (secKey, slotKey) => { const t = val(secKey, slotKey); return !!t && isFilled(t.sl, t.v); };

      const label = { a: 'data', b: 'software', c: 'analysis' };
      const streams = Object.entries(val('need', 'C0')?.v || {}).filter(([k, on]) => on && label[k]).map(([k]) => k);
      const detail = { a: 'data_detail', b: 'software_detail', c: 'analysis_detail' };
      const title = String(need?.need?.need_description || '').trim();
      console.log(`  ${where}: ${need?.need?.need_id || '(no id)'} — ${title ? title.slice(0, 72) : '(no need statement)'}`);
      if (!title) err(`${where}: need_description is empty — it is the need`);
      if (!streams.length) err(`${where}: C0 has no box ticked, so the need cannot be routed`);
      if (streams.length > 1) warn(`${where}: C0 selects ${streams.length} streams (${streams.map((s) => label[s]).join(', ')}) — a bundle. Different testers or checks mean separate needs.`);
      for (const s of streams) if (!filled(detail[s], { a: 'D0', b: 'S0', c: 'A0' }[s])) warn(`${where}: ${label[s]} ticked in C0 but ${detail[s]} is empty`);
      if (!filled('need', 'C5')) warn(`${where}: no acceptance check (C5) — a need that cannot be tested cannot be closed`);
      if (!filled('need', 'C6')) warn(`${where}: no tester named (C6)`);
      if (!filled('need', 'C7')) warn(`${where}: no needed-by date or consequence (C7)`);
      if (!filled('need', 'C11')) warn(`${where}: nothing marked out of scope (C11) — naming the boundary is what keeps a need small`);
      if (!filled('need', 'raw_notes')) warn(`${where}: no raw_notes — the reviewer cannot check the answers against the source`);
    });
  }

  for (const k of ['project_id', 'project', 'date']) {
    if (!String(doc.answers?.capture_details?.[k] ?? '').trim()) warn(`capture_details.${k} is empty`);
  }
  if (undocumented.length) {
    warn(`no question written above ${undocumented.length === 1 ? 'this answer' : 'these answers'}: ${undocumented.join(', ')}. Run --skeleton and copy the \`# <key> — <question>\` comments, so the file reads without the template.`);
  }
  if (errors === errorsBefore) ok('shape is valid; the app will open this file');

  if (wantQuestionnaire) {
    const n = tpl.repeat ? (Array.isArray(needs) ? needs.length : 0) : 0;
    const out = n ? Array.from({ length: n }, (_, i) => toQuestionnaireYAML(tpl, doc.answers, i)).join('---\n')
      : toQuestionnaireYAML(tpl, doc.answers, null);
    console.log(`\n--- questionnaire.yaml (the DRS hand-off) ---\n${out}`);
  }
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
