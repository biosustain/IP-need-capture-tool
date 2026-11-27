#!/usr/bin/env node
// Checks the bulk export/import bundle format: round trip, the shapes a file can
// arrive in, and what an import would do before it writes anything.
// Usage: node scripts/test-bundle.mjs   (no dependencies; Node 18+)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTemplate } from '../js/template.js';
import * as A from '../js/answers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const tpl = buildTemplate(readFileSync(`${ROOT}/templates/need-capture-short.md`, 'utf8'),
  { id: 'need-capture-short', path: 'templates/need-capture-short.md' });

let pass = 0;
const t = (name, fn) => { try { fn(); pass++; console.log(`  ok  ${name}`); } catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; } };

// A draft as the app stores it.
const draft = (id, title, needId) => {
  const answers = {};
  const sec = tpl.sections.find((s) => s.slots.some((sl) => sl.key === 'need_id'));
  const needs = A.needsOf(tpl, answers);
  needs[0][sec.key] = { need_id: needId, need_description: `${title} description` };
  return { id, templateId: tpl.id, title, answers, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-02T00:00:00.000Z', version: tpl.version };
};

const d1 = draft('short-aaa', 'Alpha capture', 'NEED-0001');
const d2 = draft('short-bbb', 'Beta capture', 'NEED-0002');

console.log('bundle round trip');
const bundle = A.buildBundle([d1, d2].map((d) => A.buildBundleDocument(tpl, d.answers, d)));
const yaml = A.toBundleYAML(bundle);

t('header comment names the count', () => assert.match(yaml, /^# 2 questionnaires exported/m));
t('declares itself a bundle', () => assert.equal(bundle.meta.kind, 'need-capture-bundle'));

const back = A.parseBundle(yaml);
t('parses both documents back', () => assert.equal(back.length, 2));
t('keeps the draft identity', () => {
  const r = A.draftFromDocument(back[0]);
  assert.equal(r.id, 'short-aaa');
  assert.equal(r.title, 'Alpha capture');
  assert.equal(r.templateId, 'need-capture-short');
  assert.equal(r.createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(r.updatedAt, '2026-02-02T00:00:00.000Z');
});
t('answers survive the round trip', () => {
  const r = A.draftFromDocument(back[1]);
  const sec = tpl.sections.find((s) => s.slots.some((sl) => sl.key === 'need_id'));
  assert.equal(A.scope(tpl, r.answers, 0)[sec.key].need_id, 'NEED-0002');
});
t('JSON bundle parses too', () => assert.equal(A.parseBundle(A.toBundleJSON(bundle)).length, 2));

console.log('forgiving input');
t('a single answers file counts as one document', () => {
  const one = A.toYAML(A.buildDocument(tpl, d1.answers, {}));
  const got = A.parseBundle(one);
  assert.equal(got.length, 1);
  assert.equal(A.draftFromDocument(got[0]).id, null, 'no draft identity -> imports as new');
});
t('--- separated answers files are read as several', () => {
  const two = [A.toYAML(A.buildDocument(tpl, d1.answers, {})), A.toYAML(A.buildDocument(tpl, d2.answers, {}))].join('---\n');
  assert.equal(A.parseBundle(two).length, 2);
});
t('rejects a file with no answers', () => assert.throws(() => A.parseBundle('hello: world\n'), /No answers found/));
t('rejects the DRS hand-off format by name', () => {
  const handoff = A.toQuestionnaireYAML(tpl, d1.answers, 0);
  assert.match(handoff, /^answers:/m, 'the hand-off does have an answers key, which is the trap');
  assert.throws(() => A.parseBundle(handoff), /one-way hand-off/);
});
t('several hand-off documents are refused together', () => {
  const two = [A.toQuestionnaireYAML(tpl, d1.answers, 0), A.toQuestionnaireYAML(tpl, d2.answers, 0)].join('---\n');
  assert.throws(() => A.parseBundle(two), /one-way hand-off/);
});
t('a real bundle beside a hand-off still imports the bundle', () => {
  const mixed = [A.toYAML(A.buildDocument(tpl, d1.answers, {})), A.toQuestionnaireYAML(tpl, d2.answers, 0)].join('---\n');
  assert.equal(A.parseBundle(mixed).length, 1);
});
t('rejects broken YAML', () => assert.throws(() => A.parseBundle('a:\n  - [unclosed\n'), /Not a valid YAML/));
t('rejects an empty file', () => assert.throws(() => A.parseBundle(''), /No answers found/));

console.log('import plan');
const incoming = back.map(A.draftFromDocument);
t('nothing here yet -> everything is added, ids kept', () => {
  const plan = A.planImport(incoming, new Set());
  assert.deepEqual(plan.map((p) => p.action), ['add', 'add']);
  assert.equal(plan.every((p) => !p.clash), true);
});
t('replace overwrites the copy already here', () => {
  const plan = A.planImport(incoming, new Set(['short-aaa']), 'replace');
  assert.deepEqual(plan.map((p) => p.action), ['replace', 'add']);
  assert.equal(plan[0].clash, true);
});
t('keep brings it in alongside', () => {
  const plan = A.planImport(incoming, new Set(['short-aaa']), 'keep');
  assert.deepEqual(plan.map((p) => p.action), ['add', 'add']);
  assert.equal(plan[0].clash, true, 'flagged so the caller gives it a fresh id');
});
t('skip leaves it alone', () => {
  const plan = A.planImport(incoming, new Set(['short-aaa', 'short-bbb']), 'skip');
  assert.deepEqual(plan.map((p) => p.action), ['skip', 'skip']);
});
t('a document with no template is refused, not guessed at', () => {
  const plan = A.planImport([{ id: 'x', templateId: '', answers: {} }], new Set());
  assert.equal(plan[0].action, 'invalid');
  assert.match(plan[0].reason, /no template/);
});

console.log('template that will not load');
t('a raw document still carries the answers', () => {
  const raw = A.buildRawBundleDocument({ ...d1, templateId: 'gone' });
  assert.equal(raw.meta.template_unavailable, true);
  const r = A.draftFromDocument(A.parseBundle(A.toBundleYAML(A.buildBundle([raw])))[0]);
  assert.equal(r.templateId, 'gone');
  assert.equal(r.title, 'Alpha capture');
  assert.ok(Object.keys(r.answers).length, 'answers are not empty');
});

console.log(`\n${pass} passed${process.exitCode ? ', FAILURES above' : ''}`);
