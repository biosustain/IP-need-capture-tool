import { inline, esc, renderBlock, plain } from './markdown.js';
import { loadTemplate, fetchText, rowSpecs, newRow, slug } from './template.js';
import * as A from './answers.js';

// ---------------------------------------------------------------- config & state

const DEFAULT_CONFIG = {
  title: 'Informatics Platform - Need Capture',
  organization: 'BRIGHT',
  contactEmail: '',   // single address; `contacts` takes precedence when set
  contacts: [],       // [{ name, email }] — the client picks one to send to
  templatesIndex: 'templates/index.json',
};

/** Config contacts, normalised; falls back to a lone `contactEmail`. */
function contactList(cfg) {
  const list = (Array.isArray(cfg.contacts) ? cfg.contacts : [])
    .map((c) => (typeof c === 'string' ? { name: '', email: c } : { name: c.name || '', email: c.email || '' }))
    .filter((c) => c.email);
  if (list.length) return list;
  return cfg.contactEmail ? [{ name: '', email: cfg.contactEmail }] : [];
}

const state = {
  config: DEFAULT_CONFIG,
  index: [],
  templates: new Map(), // template id -> Promise<template>
  drafts: new Map(),    // draft id -> { id, templateId, title, answers, createdAt, updatedAt, version }
  opened: null,         // { doc, tpl, name }
};

const app = document.getElementById('app');

// ---------------------------------------------------------------- tiny DOM helper

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const md = (s, tag = 'span', cls) => h(tag, { class: cls, html: inline(s) });

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  keys(prefix) {
    try { return Object.keys(localStorage).filter((k) => k.startsWith(prefix)); } catch { return []; }
  },
};

function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function toast(msg, kind = 'info') {
  const t = h('div', { class: `toast toast-${kind}`, role: 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

const cap1 = (x) => String(x).charAt(0).toUpperCase() + String(x).slice(1);
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

function autosize(root = document) {
  requestAnimationFrame(() => root.querySelectorAll('textarea.input').forEach(grow));
}
function grow(el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; }

// ---------------------------------------------------------------- boot & routing

async function boot() {
  try {
    const cfg = JSON.parse(await fetchText('config.json'));
    state.config = { ...DEFAULT_CONFIG, ...cfg };
  } catch { /* defaults */ }
  document.querySelector('[data-brand-title]').textContent = state.config.title;
  document.querySelector('[data-org]').textContent = state.config.organization;

  try {
    state.index = JSON.parse(await fetchText(state.config.templatesIndex));
  } catch { state.index = []; }

  migrateLegacyDrafts();

  const q = new URLSearchParams(location.search).get('template');
  if (q && !location.hash) location.replace(`#/t/${encodeURIComponent(q)}`);
  window.addEventListener('hashchange', route);
  route();
}

function getTemplate(id) {
  if (!state.templates.has(id)) {
    const entry = state.index.find((t) => t.id === id) || { id, file: `templates/${id}.md` };
    const p = loadTemplate(entry);
    p.catch(() => state.templates.delete(id));
    state.templates.set(id, p);
  }
  return state.templates.get(id);
}

async function route() {
  flushSave?.();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [view, a, b] = parts;
  window.scrollTo(0, 0);
  document.title = state.config.title; // doc views set their own below
  try {
    // #/t/<templateId>[/new] — resolve to one questionnaire, then swap the URL for it.
    if (view === 't' && a) {
      await getTemplate(a); // fails loudly here if the template is unknown
      const mine = listDrafts(a);
      const target = b === 'new' || !mine.length ? createDraft(a) : (mine.length === 1 ? mine[0] : null);
      if (!target) return location.replace('#/');
      return location.replace(`#/q/${encodeURIComponent(target.id)}`);
    }
    if (view === 'q' && a) {
      const draft = readDraft(a);
      if (!draft) { toast('That questionnaire is no longer saved in this browser.', 'error'); return location.replace('#/'); }
      const tpl = await getTemplate(draft.templateId);
      A.migrateNeeds(tpl, draft.answers); // answers saved before the template repeated
      A.migrateNotes(tpl, draft.answers);  // ... and before the notes were split per need
      if (b === 'review') return renderDraftReview(draft, tpl);
      const idx = Math.max(0, parseInt(b || '0', 10) || 0);
      // Sections in the repeated block always address a need; default to the first.
      const repeats = !!tpl.repeat && tpl.repeat.sections.includes(tpl.sections[idx]);
      const need = repeats ? Math.max(0, parseInt(parts[3] ?? '0', 10) || 0) : null;
      return renderForm(draft, tpl, idx, need);
    }
    if (view === 'view') return state.opened ? renderOpened() : (location.hash = '#/');
    return renderHome();
  } catch (e) {
    console.error(e);
    mount(h('div', { class: 'page narrow' }, h('div', { class: 'card error' },
      h('h2', {}, 'Something went wrong'), h('p', {}, e.message || String(e)), h('a', { class: 'btn', href: '#/' }, 'Back to templates'))));
  }
}

/** Navigate, re-rendering even when the target is the hash we are already on. */
function goHash(target) {
  if (location.hash === target) route(); else location.hash = target;
}

function mount(...nodes) {
  app.replaceChildren(...nodes);
  autosize(app);
  app.querySelector('h1')?.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- drafts
//
// One localStorage entry per in-progress questionnaire, so a template can be
// answered several times over (one per project) without the drafts colliding.

const PREFIX = 'ipreq.q.';
const draftKey = (id) => PREFIX + id;
const newId = (templateId) => `${templateId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readDraft(id) {
  if (state.drafts.has(id)) return state.drafts.get(id);
  let d = null;
  try { d = JSON.parse(store.get(draftKey(id)) || 'null'); } catch { d = null; }
  if (!d || !d.answers || !d.templateId) return null;
  state.drafts.set(id, d);
  return d;
}

function listDrafts(templateId = null) {
  const out = [];
  for (const k of store.keys(PREFIX)) {
    const d = readDraft(k.slice(PREFIX.length));
    if (d && (!templateId || d.templateId === templateId)) out.push(d);
  }
  return out.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function createDraft(templateId, answers = {}) {
  const now = new Date().toISOString();
  const d = { id: newId(templateId), templateId, title: '', answers, createdAt: now, updatedAt: now };
  state.drafts.set(d.id, d);
  writeDraft(d);
  return d;
}

function deleteDraft(id) {
  // Drop any autosave still queued, or it would write the record straight back.
  clearTimeout(saveTimer);
  flushSave = null;
  state.drafts.delete(id);
  store.del(draftKey(id));
}

function duplicateDraft(d) {
  const copy = createDraft(d.templateId, JSON.parse(JSON.stringify(d.answers)));
  copy.title = d.title ? `${d.title} (copy)` : '';
  writeDraft(copy);
  return copy;
}

const writeDraft = (d) => store.set(draftKey(d.id), JSON.stringify(d));

let saveTimer = null;
function saveDraft(draft, immediate = false, version = null) {
  draft.updatedAt = new Date().toISOString();
  if (version) draft.version = version;
  clearTimeout(saveTimer);
  const doSave = () => {
    const ok = writeDraft(draft);
    const el = document.querySelector('[data-save-status]');
    if (el) el.textContent = ok ? `Saved in this browser · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved (browser storage unavailable) — export to keep your answers';
  };
  flushSave = () => { clearTimeout(saveTimer); doSave(); flushSave = null; };
  immediate ? flushSave() : (saveTimer = setTimeout(flushSave, 350));
}
let flushSave = null;
window.addEventListener('pagehide', () => flushSave?.());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave?.(); });

/** Drafts written by the single-draft-per-template build: `ipreq.draft.<templateId>`. */
function migrateLegacyDrafts() {
  for (const k of store.keys('ipreq.draft.')) {
    const templateId = k.slice('ipreq.draft.'.length);
    let old = null;
    try { old = JSON.parse(store.get(k) || 'null'); } catch { old = null; }
    if (old && old.answers) {
      const d = createDraft(templateId, old.answers);
      d.createdAt = old.updatedAt || d.createdAt;
      d.updatedAt = old.updatedAt || d.updatedAt;
      d.version = old.version;
      writeDraft(d);
    }
    store.del(k);
  }
}

/** The project name, taken from the first answered free-text question. */
function firstAnswerText(tpl, answers) {
  return tpl.sections
    .flatMap((s) => s.slots.map((sl) => A.choiceText(A.getValue(answers, s, sl))))
    .find((v) => typeof v === 'string' && v.trim()) || '';
}

/** One answer by key, inside need `n` (or at capture level when `n` is null). */
function answerAt(tpl, answers, n, key) {
  const sc = A.scope(tpl, answers, n);
  for (const s of tpl.sections) {
    const sl = s.slots.find((x) => x.key === key);
    if (sl) return String(A.choiceText(A.getValue(sc, s, sl)) || '').trim();
  }
  return '';
}

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** `NEED-0003 — One row per sample…`: what tells two single-need files apart. */
function needLabel(tpl, answers, n) {
  const id = answerAt(tpl, answers, n, 'need_id');
  const sc = A.scope(tpl, answers, n);
  // `need_description` by name, else the first thing answered inside the need.
  const text = answerAt(tpl, answers, n, 'need_description')
    || (tpl.repeat?.sections || [])
      .flatMap((s) => s.slots.map((sl) => A.choiceText(A.getValue(sc, s, sl))))
      .find((v) => typeof v === 'string' && v.trim() && v.trim() !== id) || '';
  return [id, text && clip(text.replace(/\s+/g, ' ').trim(), 72)].filter(Boolean).join(' — ');
}

/**
 * What to call a document. A file holding one need is named after that need —
 * nineteen files all called "Need Capture — short form" tell you nothing.
 */
function docLabel(tpl, answers) {
  if (A.needCount(tpl, answers) === 1) {
    const one = needLabel(tpl, answers, 0);
    if (one) return one;
  }
  return answerAt(tpl, answers, null, 'project')
    || answerAt(tpl, answers, null, 'project_id')
    || firstAnswerText(tpl, answers).trim();
}

const labelFor = (d, tpl) => d.title?.trim() || (tpl ? docLabel(tpl, d.answers).trim() : '') || 'Untitled';
const hasContent = (tpl, d) => d && A.progress(tpl, d.answers).some((p) => p.done > 0);

// ---------------------------------------------------------------- home

async function renderHome() {
  const cfg = state.config;
  const drafts = listDrafts();

  // Progress needs the parsed template; getTemplate caches, so this is one load per template.
  const tpls = new Map();
  await Promise.all([...new Set(drafts.map((d) => d.templateId))].map(async (id) => {
    tpls.set(id, await getTemplate(id).catch(() => null));
  }));

  const counts = {};
  for (const d of drafts) counts[d.templateId] = (counts[d.templateId] || 0) + 1;

  const fileInput = h('input', { type: 'file', accept: '.yaml,.yml,.json', class: 'visually-hidden', id: 'open-file', onChange: (e) => openFile(e.target.files[0]) });

  const cards = state.index.length
    ? state.index.map((t) => h('article', { class: 'card tpl-card' },
      h('div', { class: 'tpl-card-body' },
        h('h2', {}, t.title),
        t.description ? h('p', { class: 'muted' }, t.description) : null,
        h('p', { class: 'tpl-meta' },
          t.sections ? `${t.sections} sections` : null,
          t.questions ? ` · ${t.questions} questions` : null,
          counts[t.id] ? h('span', { class: 'badge' }, `${counts[t.id]} in progress`) : null)),
      h('div', { class: 'tpl-card-actions' },
        h('a', { class: 'btn primary', href: `#/t/${encodeURIComponent(t.id)}/new` }, counts[t.id] ? 'Start another' : 'Start'))))
    : [h('div', { class: 'card' }, h('p', {}, 'No templates found. Add a Markdown file to ', h('code', {}, 'templates/'), ' and list it in ', h('code', {}, 'templates/index.json'), '.'))];

  mount(h('div', { class: 'page' },
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, cfg.organization),
      h('h1', { tabindex: '-1' }, 'Tell us what your project needs'),
      h('p', { class: 'lede' }, 'Pick a questionnaire and answer it section by section. Your answers are saved in this browser as you go, so you can stop and come back — and you can keep one going per project. When you are done, review your answers and send them to us, or export a copy as YAML or Markdown.')),
    drafts.length ? h('h2', { class: 'label-heading' }, 'In progress') : null,
    drafts.length ? h('div', { class: 'q-list' }, drafts.map((d) => draftRow(d, tpls.get(d.templateId)))) : null,
    h('h2', { class: 'label-heading' }, drafts.length ? 'Capture new needs' : 'Questionnaires'),
    h('div', { class: 'tpl-grid' }, cards),
    h('div', { class: 'card open-card' },
      h('div', {},
        h('h2', {}, 'Open an answers file'),
        h('p', { class: 'muted' }, 'View a YAML or JSON file exported from this app, then edit it or export it in another format.')),
      h('label', { class: 'btn', for: 'open-file' }, 'Choose file…'), fileInput)));
}

function draftRow(d, tpl) {
  const base = `#/q/${encodeURIComponent(d.id)}`;
  const prog = tpl ? A.progress(tpl, d.answers) : null;
  const done = prog ? prog.reduce((a, p) => a + p.done, 0) : 0;
  const total = prog ? prog.reduce((a, p) => a + p.total, 0) : 0;
  const pct = total ? Math.round((100 * done) / total) : 0;
  const tplTitle = tpl?.title || state.index.find((t) => t.id === d.templateId)?.title || d.templateId;

  return h('article', { class: 'card q-item' },
    h('div', { class: 'q-main' },
      h('h3', { class: 'q-title' }, labelFor(d, tpl)),
      h('p', { class: 'q-meta' },
        tplTitle,
        prog ? h('span', {}, ' · ', `${done} of ${total} answered`) : h('span', {}, ' · —'),
        d.updatedAt ? h('span', { class: 'muted' }, ' · last saved ', fmtTime(d.updatedAt)) : null),
      prog ? h('div', { class: 'bar' }, h('span', { style: `width:${pct}%` })) : null),
    h('div', { class: 'q-actions' },
      h('a', { class: 'btn primary', href: base }, 'Continue'),
      h('a', { class: 'btn ghost', href: `${base}/review` }, 'Review'),
      h('details', { class: 'menu' },
        h('summary', { class: 'btn ghost icon', 'aria-label': `More actions for ${labelFor(d, tpl)}` }, '⋯'),
        h('div', { class: 'menu-list' },
          h('button', { class: 'menu-item', type: 'button', onClick: () => promptRename(d, tpl) }, 'Rename…'),
          h('button', { class: 'menu-item', type: 'button', onClick: () => { duplicateDraft(d); toast('Duplicated'); route(); } }, 'Duplicate'),
          h('button', {
            class: 'menu-item danger', type: 'button',
            onClick: () => { if (confirm(`Delete “${labelFor(d, tpl)}” and its answers from this browser?`)) { deleteDraft(d.id); toast('Deleted'); route(); } },
          }, 'Delete')))));
}

function promptRename(d, tpl) {
  const next = prompt('Name this questionnaire:', labelFor(d, tpl));
  if (next === null) return;
  d.title = next.trim();
  saveDraft(d, true);
  route();
}

async function openFile(file) {
  if (!file) return;
  try {
    const doc = A.parseDocument(await file.text());
    const tpl = doc.template.id ? await getTemplate(doc.template.id).catch(() => null) : null;
    state.opened = { doc, tpl, name: file.name };
    if (location.hash === '#/view') renderOpened(); else location.hash = '#/view';
  } catch (e) { toast(e.message, 'error'); }
}

// ---------------------------------------------------------------- questionnaire

function renderForm(draft, tpl, idx, needIdx) {
  const base = `#/q/${encodeURIComponent(draft.id)}`;
  if (idx >= tpl.sections.length) { location.hash = `${base}/review`; return; }
  const href = (st) => `${base}/${st.index}${st.need == null ? '' : `/${st.need}`}`;

  // Conditional sections drop out of the flow, and the repeated block appears once per need.
  let steps = A.flow(tpl, draft.answers);
  let at = steps.findIndex((st) => st.index === idx && st.need === needIdx);
  if (at < 0) { // landed on a step this answer set does not ask for
    const after = steps.find((st) => st.index > idx || (st.index === idx && (st.need ?? -1) > (needIdx ?? -1)));
    location.replace(after ? href(after) : (steps.length ? href(steps[steps.length - 1]) : `${base}/review`));
    return;
  }
  const section = tpl.sections[idx];
  const scoped = () => A.scope(tpl, draft.answers, needIdx);

  const onChange = (sectionKey, key, value) => {
    // Section in the repeated block? Write into this need, not the session.
    const bucket = needIdx == null ? draft.answers : A.needsOf(tpl, draft.answers)[needIdx];
    (bucket[sectionKey] ||= {})[key] = value;
    saveDraft(draft, false, tpl.version);
    // An answer a condition reads can add or remove sections. Only the stepper,
    // nav and counts change, so rebuild those rather than the inputs being used.
    if (tpl.conditionDeps?.has(key)) refreshChrome(); else updateProgress(tpl, draft);
    const t = document.querySelector('[data-draft-label]');
    if (t) t.textContent = labelFor(draft, tpl);
  };

  const buildStepper = () => {
    const items = [];
    let lastNeed;
    steps.forEach((st, i) => {
      if (st.need !== lastNeed) {
        lastNeed = st.need;
        if (st.need != null) {
          items.push(h('li', { class: 'step-group' },
            h('span', {}, `${cap1(tpl.repeat.label)} ${st.need + 1}`),
            A.needCount(tpl, draft.answers) > 1
              ? h('button', {
                class: 'link-btn', type: 'button', 'aria-label': `Remove ${tpl.repeat.label} ${st.need + 1}`,
                onClick: () => removeNeedAt(st.need),
              }, 'Remove') : null));
        }
      }
      const cur = st.index === idx && st.need === needIdx;
      items.push(h('li', {},
        h('a', { href: href(st), class: cur ? 'current' : '', 'aria-current': cur ? 'step' : null },
          h('span', { class: 'step-num' }, String(i + 1)),
          h('span', { class: 'step-title' }, st.section.title),
          h('span', { class: 'step-count', 'data-count': st.key }, ''))));
    });
    return h('nav', { class: 'stepper', 'aria-label': 'Sections' },
      h('ol', {}, items),
      tpl.repeat ? h('button', { class: 'btn add step-add', type: 'button', onClick: addNeedHere }, `+ Add ${tpl.repeat.label}`) : null,
      h('a', { href: `${base}/review`, class: 'step-review' }, 'Review & send →'));
  };

  function addNeedHere() {
    const n = A.addNeed(tpl, draft.answers);
    saveDraft(draft, true, tpl.version);
    const first = A.flow(tpl, draft.answers).find((st) => st.need === n);
    goHash(first ? href(first) : `${base}/review`);
  }

  function removeNeedAt(n) {
    const label = `${tpl.repeat.label} ${n + 1}`;
    if (!confirm(`Remove ${label} and its answers?`)) return;
    A.removeNeed(tpl, draft.answers, n);
    saveDraft(draft, true, tpl.version);
    toast(`${cap1(label)} removed`);
    const back = A.flow(tpl, draft.answers)[0];
    goHash(back ? href(back) : `${base}/review`);
  }

  const aside = h('aside', {}, buildStepper());
  const navHost = h('div', { class: 'section-nav' });
  const eyebrow = h('p', { class: 'eyebrow' }, '');

  function refreshChrome() {
    steps = A.flow(tpl, draft.answers);
    at = steps.findIndex((st) => st.index === idx && st.need === needIdx);
    if (at < 0) { location.replace(`${base}/review`); return; } // current step no longer asked
    aside.replaceChildren(buildStepper());
    const prev = steps[at - 1], next = steps[at + 1];
    navHost.replaceChildren(
      prev ? h('a', { class: 'btn', href: href(prev) }, '← ', prev.section.title) : h('span'),
      next
        ? h('a', { class: 'btn primary', href: href(next) }, next.section.title, ' →')
        : h('a', { class: 'btn primary', href: `${base}/review` }, 'Review & send →'));
    eyebrow.textContent = `Step ${at + 1} of ${steps.length}`;
    updateProgress(tpl, draft);
  }

  const importInput = h('input', { type: 'file', accept: '.yaml,.yml,.json', class: 'visually-hidden', id: 'import-file', onChange: (e) => importInto(draft, tpl, e.target.files[0]) });

  const toolbar = h('div', { class: 'toolbar' },
    h('div', { class: 'toolbar-title' },
      h('a', { href: '#/', class: 'crumb' }, 'Questionnaires'), h('span', { class: 'crumb-sep' }, '/'),
      h('strong', { 'data-draft-label': '' }, labelFor(draft, tpl)),
      h('span', { class: 'crumb-tpl' }, tpl.title)),
    h('div', { class: 'toolbar-progress' }, h('div', { class: 'bar' }, h('span', { 'data-overall': '' })), h('span', { class: 'small muted', 'data-overall-text': '' })),
    h('div', { class: 'toolbar-actions' },
      h('a', { class: 'btn ghost', href: `${base}/review` }, 'Review'),
      exportMenu(() => ({ tpl, draft, answers: draft.answers, meta: {}, need: needIdx })),
      h('details', { class: 'menu' },
        h('summary', { class: 'btn ghost icon', 'aria-label': 'More actions' }, '⋯'),
        h('div', { class: 'menu-list' },
          h('button', { class: 'menu-item', type: 'button', onClick: () => promptRename(draft, tpl) }, 'Rename…'),
          h('label', { for: 'import-file', class: 'menu-item' }, 'Load answers from file…'),
          h('button', { class: 'menu-item', type: 'button', onClick: () => copyLink(tpl) }, 'Copy link to this questionnaire'),
          h('button', {
            class: 'menu-item danger', type: 'button',
            onClick: () => { if (confirm(`Delete “${labelFor(draft, tpl)}” and its answers from this browser?`)) { deleteDraft(draft.id); toast('Deleted'); location.hash = '#/'; } },
          }, 'Delete this questionnaire'))),
      importInput));

  const body = h('div', { class: 'section-body' });
  if (at === 0 && tpl.intro.length) body.append(h('div', { class: 'guidance intro', html: tpl.intro.map(renderBlock).join('') }));
  const view = { answers: scoped() };
  for (const it of section.items) body.append(renderItem(tpl, section, it, view, onChange));
  if (!section.slots.length) body.prepend(h('p', { class: 'note' }, 'This section is for reference — nothing to fill in.'));

  mount(toolbar, h('div', { class: 'page form-layout' },
    aside,
    h('main', { class: 'form-main' },
      h('header', { class: 'section-head' },
        eyebrow,
        h('h1', { tabindex: '-1' }, section.title),
        h('p', { class: 'small muted', 'data-save-status': '' }, draft.updatedAt ? `Saved in this browser · ${fmtTime(draft.updatedAt)}` : 'Answers are saved in this browser as you type')),
      body, navHost)));
  refreshChrome();
}

function updateProgress(tpl, draft) {
  const prog = A.progress(tpl, draft.answers);
  let done = 0, total = 0;
  for (const p of prog) {
    done += p.done; total += p.total;
    const el = document.querySelector(`[data-count="${p.key}"]`);
    if (!el) continue;
    el.textContent = p.total ? `${p.done}/${p.total}` : 'Info';
    el.closest('a').classList.toggle('complete', p.total > 0 && p.done === p.total);
  }
  const pct = total ? Math.round((100 * done) / total) : 0;
  const bar = document.querySelector('[data-overall]');
  if (bar) bar.style.width = `${pct}%`;
  const txt = document.querySelector('[data-overall-text]');
  if (txt) txt.textContent = `${done} of ${total} answered`;
}

function renderItem(tpl, section, it, draft, onChange) {
  const slot = (key) => section.slots.find((s) => s.key === key);
  const val = (key) => A.getValue(draft.answers, section, slot(key));
  switch (it.type) {
    case 'content': return h('div', { class: 'guidance', html: renderBlock(it.block) });
    case 'subheading': return h('h2', { class: 'subheading' }, plain(it.text));
    case 'field': return fieldBlock(section, it, val(it.key), (v) => onChange(section.key, it.key, v));
    case 'kv': return h('div', { class: 'kv' }, it.rows.map((r) => (r.field
      ? fieldBlock(section, r.field, val(r.field.key), (v) => onChange(section.key, r.field.key, v))
      : h('div', { class: 'field readonly' }, md(r.label, 'div', 'field-label'), md(r.value, 'div')))));
    case 'grid': return gridEditor(section, it, val(it.key), (v) => onChange(section.key, it.key, v));
    case 'checklist': {
      const cur = { ...val(it.key) };
      return h('fieldset', { class: 'field checklist' },
        it.label ? h('legend', { class: 'field-label' }, it.label) : null,
        it.options.map((o) => h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: cur[o.key] ? true : null, onChange: (e) => { cur[o.key] = e.target.checked; onChange(section.key, it.key, { ...cur }); } }),
          md(o.label))));
    }
    default: return h('div');
  }
}

function fieldBlock(section, f, value, onValue) {
  const id = `f-${section.key}-${f.key}`;
  return h('div', { class: `field ${f.input.long ? 'long' : ''}` },
    h('label', { class: 'field-label', for: id, id: `${id}-label` }, f.label),
    inputFor(id, f.input, value, onValue));
}

function inputFor(id, spec, value, onValue) {
  if (spec.kind === 'choice') return choiceInput(id, spec, value, onValue);
  if (spec.kind === 'date') {
    return h('input', { type: 'date', id, class: 'input date', value: value || '', onInput: (e) => onValue(e.target.value) });
  }
  const ta = h('textarea', {
    id, class: `input${spec.kind === 'id' ? ' mono' : ''}`, rows: spec.long ? 3 : 1, placeholder: spec.prompt || '', value: value || '',
    onInput: (e) => { grow(e.target); onValue(e.target.value); },
  });
  if (!spec.suggestions) return ta;
  const chips = h('div', { class: 'suggest', 'aria-label': 'Suggestions' },
    h('span', { class: 'small muted' }, 'Suggestions:'),
    spec.suggestions.map((s) => h('button', {
      type: 'button', class: 'chip',
      onClick: () => {
        const parts = ta.value.split(/\s*,\s*/).filter(Boolean);
        const i = parts.findIndex((p) => p.toLowerCase() === s.toLowerCase());
        if (i >= 0) parts.splice(i, 1); else parts.push(s);
        ta.value = parts.join(', '); grow(ta); onValue(ta.value); ta.focus();
      },
    }, s)));
  return h('div', {}, ta, chips);
}

function choiceInput(id, spec, value, onValue) {
  const cur = value && typeof value === 'object' ? { choice: value.choice || '', note: value.note || '' } : { choice: value || '', note: '' };
  const options = [...spec.options];
  if (cur.choice && !options.includes(cur.choice)) options.push(cur.choice); // keep imported/custom values visible
  const emit = () => onValue(spec.note ? { ...cur } : cur.choice);
  const group = h('div', { class: 'pills', role: 'radiogroup', 'aria-labelledby': `${id}-label`, id });
  const sync = () => group.querySelectorAll('.pill').forEach((p) => p.setAttribute('aria-checked', String(p.dataset.v === cur.choice)));
  options.forEach((opt) => group.append(h('button', {
    type: 'button', class: 'pill', role: 'radio', 'data-v': opt, 'aria-checked': String(opt === cur.choice),
    onClick: () => { cur.choice = cur.choice === opt ? '' : opt; sync(); emit(); },
  }, opt)));
  if (!spec.note) return group;
  return h('div', { class: 'choice-note' }, group,
    h('textarea', { class: 'input', rows: 1, placeholder: cap(spec.note), 'aria-label': spec.note, value: cur.note, onInput: (e) => { grow(e.target); cur.note = e.target.value; emit(); } }));
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function gridEditor(section, grid, value, onValue) {
  const rows = (Array.isArray(value) ? value : []).map((r) => ({ ...r }));
  const list = h('div', { class: 'records' });
  const commit = () => onValue(rows.map((r) => ({ ...r })));
  const firstKey = grid.columns[0].key;

  const titleOf = (row, i) => {
    const v = A.choiceText(row[firstKey]);
    return v.trim() ? v : `${grid.columns[0].label} ${i + 1}`;
  };

  function card(row, i) {
    const specs = rowSpecs(grid, row);
    const preset = !!grid.presets[row[firstKey]];
    const title = h('span', { class: 'record-title' }, titleOf(row, i));
    const fields = grid.columns.map((c, ci) => {
      if (ci === 0 && preset) return null; // preset label is the card title
      const id = `g-${section.key}-${grid.key}-${i}-${c.key}`;
      const spec = specs[ci];
      return h('div', { class: `field ${spec.long ? 'long' : ''} ${spec.kind === 'id' ? 'compact' : ''}` },
        h('label', { class: 'field-label', for: id, id: `${id}-label` }, c.label),
        inputFor(id, spec, row[c.key], (v) => {
          row[c.key] = v;
          if (ci === 0) title.textContent = titleOf(row, i);
          commit();
        }));
    });
    return h('article', { class: 'record' },
      h('header', { class: 'record-head' }, title,
        h('button', {
          type: 'button', class: 'btn ghost small', 'aria-label': `Remove ${titleOf(row, i)}`,
          onClick: () => {
            if (A.isFilled({ kind: 'grid', item: grid }, [row]) && !confirm(`Remove “${titleOf(row, i)}”?`)) return;
            rows.splice(i, 1); commit(); redraw();
          },
        }, 'Remove')),
      h('div', { class: 'record-fields' }, fields));
  }
  function redraw() {
    list.replaceChildren(...(rows.length ? rows.map(card) : [h('p', { class: 'muted small empty' }, 'No entries yet.')]));
    autosize(list);
  }
  redraw();
  return h('div', { class: 'grid-editor' }, list,
    h('button', {
      type: 'button', class: 'btn add',
      onClick: () => {
        rows.push(newRow(grid, rows)); commit(); redraw();
        list.lastElementChild?.querySelector('textarea, input, button.pill')?.focus();
      },
    }, '+ Add ', grid.idColumn >= 0 ? 'another' : 'row'));
}

async function importInto(draft, tpl, file) {
  if (!file) return;
  try {
    const doc = A.parseDocument(await file.text());
    if (doc.template.id && doc.template.id !== tpl.id && !confirm(`This file was made with “${doc.template.title || doc.template.id}”, not “${tpl.title}”. Load matching answers anyway?`)) return;
    if (hasContent(tpl, draft) && !confirm('Replace the answers in this questionnaire with the ones in this file?')) return;
    draft.answers = doc.answers;
    saveDraft(draft, true, tpl.version);
    toast('Answers loaded');
    route();
  } catch (e) { toast(e.message, 'error'); }
}

function copyLink(tpl) {
  const url = `${location.origin}${location.pathname}?template=${encodeURIComponent(tpl.id)}`;
  navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => prompt('Copy this link:', url));
}

// ---------------------------------------------------------------- export menu

/** `<project>-<need id or number>-questionnaire.yaml` — identifying, not `questionnaire-2.yaml`. */
function needFileName(tpl, answers, n) {
  const sc = A.scope(tpl, answers, n);
  const at = (key) => {
    for (const s of tpl.sections) {
      const sl = s.slots.find((x) => x.key === key);
      if (sl) return String(A.choiceText(A.getValue(sc, s, sl)) || '').trim();
    }
    return '';
  };
  // Keep identifiers legible — NEED-1 should stay NEED-1, not become need_1.
  const safe = (x) => String(x).trim().replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
  const parts = [at('project_id') || at('project'), at('need_id') || `${tpl.repeat?.label || 'need'}-${n + 1}`];
  return `${parts.map(safe).filter(Boolean).join('-')}-questionnaire.yaml`;
}

function exportMenu(get) {
  const fileBase = () => {
    const { tpl, draft, answers } = get();
    // A renamed questionnaire names its own file; otherwise fall back to the first answer.
    const name = draft?.title?.trim() || firstAnswerText(tpl, answers);
    return [tpl.id, name ? slug(name).slice(0, 40) : null, new Date().toISOString().slice(0, 10)].filter(Boolean).join('-');
  };
  const run = (fmt) => {
    const { tpl, answers, meta, need } = get();
    const doc = A.buildDocument(tpl, answers, meta);
    if (fmt === 'yaml') download(`${fileBase()}.yaml`, A.toYAML(doc), 'application/yaml');
    if (fmt === 'json') download(`${fileBase()}.json`, A.toJSON(doc), 'application/json');
    if (fmt === 'md') download(`${fileBase()}.md`, A.toMarkdown(tpl, answers, meta), 'text/markdown');
    // The need you are working on, on its own.
    if (fmt === 'questionnaire-need' && need != null) {
      download(needFileName(tpl, answers, need), A.toQuestionnaireYAML(tpl, answers, need), 'application/yaml');
    }
    if (fmt === 'questionnaire') {
      // One YAML document per need, `---` separated: splits into conformant files.
      const n = A.needCount(tpl, answers);
      const docs = n > 1
        ? Array.from({ length: n }, (_, i) => A.toQuestionnaireYAML(tpl, answers, i)).join('---\n')
        : A.toQuestionnaireYAML(tpl, answers, n ? 0 : null);
      download(`${fileBase()}-questionnaire.yaml`, docs, 'application/yaml');
    }
    if (fmt === 'copy') navigator.clipboard?.writeText(A.toYAML(doc)).then(() => toast('YAML copied to clipboard'));
  };
  const close = (e) => e.target.closest('details')?.removeAttribute('open');
  return h('details', { class: 'menu' },
    h('summary', { class: 'btn ghost' }, 'Export ▾'),
    h('div', { class: 'menu-list' },
      [
        get().need != null ? ['questionnaire-need', `questionnaire.yaml — this ${get().tpl.repeat?.label || 'need'} only`] : null,
        ['questionnaire', `questionnaire.yaml — ${A.needCount(get().tpl, get().answers) > 1 ? 'all needs' : 'for the DRS agent'}`],
        ['yaml', 'YAML (.yaml) — reopens in this app'],
        ['md', 'Markdown — filled template (.md)'],
        ['json', 'JSON (.json)'],
        ['copy', 'Copy YAML to clipboard'],
      ].filter(Boolean)
        .map(([k, label]) => h('button', { type: 'button', class: 'menu-item', onClick: (e) => { run(k); close(e); } }, label))));
}

document.addEventListener('click', (e) => {
  document.querySelectorAll('details.menu[open]').forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); });
});

// ---------------------------------------------------------------- review / document view

/** Per-need banner on the review document: warnings, and its own hand-off file. */
function needHeader(tpl, answers, n, editBase, onNeed) {
  const warn = A.needWarnings(tpl, answers, n);
  const ordinal = `${cap1(tpl.repeat.label)} ${n + 1}`;
  const label = needLabel(tpl, answers, n);
  return h('section', { class: 'need-head' },
    h('div', { class: 'need-head-row' },
      h('h2', {}, label || ordinal),
      onNeed ? h('button', { class: 'btn small', type: 'button', onClick: () => onNeed(n) }, 'questionnaire.yaml') : null),
    label ? h('p', { class: 'muted small' }, ordinal) : null,
    warn.length ? h('ul', { class: 'need-warnings' }, warn.map((w) => h('li', {}, w))) : null);
}

function renderDraftReview(draft, tpl) {
  const base = `#/q/${encodeURIComponent(draft.id)}`;
  const prog = A.progress(tpl, draft.answers);
  const done = prog.reduce((a, p) => a + p.done, 0), total = prog.reduce((a, p) => a + p.total, 0);
  const actions = [
    h('a', { class: 'btn', href: base }, '← Keep editing'),
    exportMenu(() => ({ tpl, draft, answers: draft.answers, meta: {} })),
    h('button', { class: 'btn primary', type: 'button', onClick: () => openSendDialog(draft, tpl) }, 'Send your answers'),
  ];
  const banner = done < total
    ? h('p', { class: 'note' }, `${total - done} of ${total} questions are still open. You can send your answers anyway; open items stay visible as unresolved.`)
    : null;
  const needs = A.needCount(tpl, draft.answers);
  const subtitle = [tpl.title, needs ? `${needs} ${tpl.repeat.label}${needs === 1 ? '' : 's'}` : null,
    `${done} of ${total} answered`, draft.updatedAt ? `last saved ${fmtTime(draft.updatedAt)}` : null].filter(Boolean).join(' · ');
  if (tpl.repeat) {
    actions.splice(1, 0, h('button', {
      class: 'btn ghost', type: 'button',
      onClick: () => { A.addNeed(tpl, draft.answers); saveDraft(draft, true, tpl.version); route(); },
    }, `+ Add ${tpl.repeat.label}`));
  }
  const onNeed = (n) => download(needFileName(tpl, draft.answers, n), A.toQuestionnaireYAML(tpl, draft.answers, n), 'application/yaml');
  mount(docView({ tpl, answers: draft.answers, title: labelFor(draft, tpl), status: 'Your answers', subtitle, actions, banner, editBase: base, onNeed }));
}

function renderOpened() {
  const { doc, tpl, name } = state.opened;
  const meta = doc.meta || {};
  const who = meta.submitted_by ? [meta.submitted_by.name, meta.submitted_by.email].filter(Boolean).join(' · ') : '';
  const when = meta.submitted_at || meta.exported_at;
  const title = (tpl && docLabel(tpl, doc.answers)) || doc.template.title || 'Answers';
  const subtitle = [tpl?.title || doc.template.title, who && `From ${who}`, when && fmtTime(when), name]
    .filter(Boolean).join(' · ');
  const actions = [
    h('a', { class: 'btn', href: '#/' }, '← Back'),
  ];
  if (tpl) {
    actions.push(exportMenu(() => ({ tpl, answers: doc.answers, meta })));
    actions.push(h('button', {
      class: 'btn primary', type: 'button',
      onClick: () => {
        // Always a new questionnaire, so opening someone's file never touches your own.
        const d = createDraft(tpl.id, JSON.parse(JSON.stringify(doc.answers)));
        d.version = tpl.version;
        saveDraft(d, true);
        location.hash = `#/q/${encodeURIComponent(d.id)}`;
      },
    }, 'Edit a copy'));
  } else {
    actions.push(h('button', { class: 'btn', type: 'button', onClick: () => download(name, A.toYAML(doc)) }, 'Download'));
  }

  let banner = null;
  if (!tpl) banner = h('p', { class: 'note' }, `The template “${doc.template.id || 'unknown'}” is not available here, so answers are shown as recorded.`);
  else if (doc.template.version && doc.template.version !== tpl.version) banner = h('p', { class: 'note' }, 'These answers were made with an earlier version of the template. Answers are matched by question; anything that no longer matches is listed at the end.');

  mount(tpl
    ? docView({ tpl, answers: doc.answers, title, status: 'Answers file', subtitle, actions, banner })
    : h('div', { class: 'page narrow doc' }, docHeader(title, 'Answers file', subtitle, actions), banner, genericValue(doc.answers)));
}

function docHeader(title, status, subtitle, actions) {
  // So a bookmark, a tab and a printed page carry the need, not the app name.
  document.title = [title, state.config.title].filter(Boolean).join(' · ');
  return h('header', { class: 'doc-head' },
    h('div', {}, h('p', { class: 'eyebrow' }, status), h('h1', { tabindex: '-1' }, title), subtitle ? h('p', { class: 'muted small' }, subtitle) : null),
    h('div', { class: 'doc-actions' }, actions));
}

function docView({ tpl, answers, title, status, subtitle, actions, banner, editBase, onNeed }) {
  const sections = [];
  let lastNeed;
  for (const st of A.flow(tpl, answers)) {
    if (st.need !== lastNeed) {
      lastNeed = st.need;
      if (st.need != null) sections.push(needHeader(tpl, answers, st.need, editBase, onNeed));
    }
    if (!st.section.slots.length) continue;
    const src = A.scope(tpl, answers, st.need);
    sections.push(h('section', { class: 'doc-section' },
      h('div', { class: 'doc-section-head' }, h('h2', {}, st.section.title),
        editBase ? h('a', { class: 'small', href: `${editBase}/${st.index}${st.need == null ? '' : `/${st.need}`}` }, 'Edit') : null),
      st.section.items.map((it) => reviewItem(st.section, it, src)).filter(Boolean)));
  }
  const extra = A.unknownAnswers(tpl, answers);
  if (Object.keys(extra).length) sections.push(h('section', { class: 'doc-section' }, h('h2', {}, 'Other answers'), genericValue(extra)));
  return h('div', { class: 'page narrow doc' }, docHeader(title, status, subtitle, actions), banner, sections);
}

const unanswered = () => h('span', { class: 'unanswered' }, 'Not answered');

function valueNode(v) {
  if (v && typeof v === 'object' && 'choice' in v) {
    if (!A.filledCell(v)) return unanswered();
    return h('span', {}, v.choice ? h('span', { class: 'tag' }, v.choice) : null, v.note ? h('span', { class: 'pre' }, ' ', v.note) : null);
  }
  const s = String(v ?? '');
  return s.trim() ? h('span', { class: 'pre' }, s) : unanswered();
}

function choiceValueNode(spec, v) {
  if (spec?.kind === 'choice' && typeof v === 'string' && v) return h('span', { class: 'tag' }, v);
  return valueNode(v);
}

function reviewItem(s, it, answers) {
  const slot = (key) => s.slots.find((x) => x.key === key);
  if (it.type === 'subheading') return h('h3', {}, plain(it.text));
  const dl = (pairs) => h('dl', { class: 'answers' }, pairs.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
  if (it.type === 'field') return dl([[it.label, choiceValueNode(it.input, A.getValue(answers, s, slot(it.key)))]]);
  if (it.type === 'kv') return dl(it.rows.map((r) => (r.field ? [r.label ? plain(r.label) : r.field.label, choiceValueNode(r.field.input, A.getValue(answers, s, slot(r.field.key)))] : [plain(r.label), md(r.value)])));
  if (it.type === 'checklist') {
    const v = A.getValue(answers, s, slot(it.key));
    return h('ul', { class: 'checks' }, it.options.map((o) => h('li', { class: v[o.key] ? 'on' : '' }, v[o.key] ? '☑ ' : '☐ ', md(o.label))));
  }
  if (it.type === 'grid') {
    const sl = slot(it.key);
    const rows = A.getValue(answers, s, sl);
    if (!A.isFilled(sl, rows)) return h('p', {}, unanswered());
    const firstKey = it.columns[0].key;
    return h('div', { class: 'review-records' },
      rows.map((row, i) => {
        const specs = rowSpecs(it, row);
        return h('article', { class: 'record' },
          h('header', { class: 'record-head' }, h('span', { class: 'record-title' }, A.choiceText(row[firstKey]) || `${it.columns[0].label} ${i + 1}`)),
          dl(it.columns.slice(1).map((c, ci) => [c.label, choiceValueNode(specs[ci + 1], row[c.key])])));
      }));
  }
  return null;
}

function genericValue(v) {
  if (Array.isArray(v)) return h('div', { class: 'review-records' }, v.map((x, i) => h('article', { class: 'record' }, h('header', { class: 'record-head' }, h('span', { class: 'record-title' }, `#${i + 1}`)), genericValue(x))));
  if (v && typeof v === 'object') return h('dl', { class: 'answers' }, Object.entries(v).map(([k, x]) => [h('dt', {}, k.replace(/_/g, ' ')), h('dd', {}, x && typeof x === 'object' && !('choice' in x) ? genericValue(x) : valueNode(x))]));
  return valueNode(v);
}

// ---------------------------------------------------------------- send

function openSendDialog(draft, tpl) {
  const cfg = state.config;
  const doc = () => A.buildDocument(tpl, draft.answers, {});
  const base = [tpl.id, slug(labelFor(draft, tpl)).slice(0, 40), new Date().toISOString().slice(0, 10)].join('-');
  const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'send-title' });
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('cancel', () => setTimeout(() => dlg.remove(), 0));

  const contacts = contactList(cfg);
  const mail = (c) => `mailto:${c.email}?subject=${encodeURIComponent(`Requirements: ${labelFor(draft, tpl)}`)}&body=${encodeURIComponent('Please find my answers attached.')}`;

  dlg.append(h('div', { class: 'dialog-body' },
    h('h2', { id: 'send-title' }, 'Send your answers'),
    contacts.length > 1
      ? h('p', {}, 'Download your answers as a file, then email it to whoever you are working with:')
      : h('p', {}, 'Download your answers as a file, then email it to the Informatics Platform team',
        contacts.length ? [' at ', h('a', { href: mail(contacts[0]) }, contacts[0].name || contacts[0].email)] : null, '.'),
    contacts.length > 1
      ? h('ul', { class: 'contact-list' }, contacts.map((c) => h('li', {},
        h('a', { href: mail(c) },
          h('span', { class: 'contact-name' }, c.name || c.email),
          c.name ? h('span', { class: 'muted small' }, c.email) : null))))
      : null,
    h('p', { class: 'small muted' }, 'Keep the file — you can load it back into this questionnaire later with “Load answers from file”.'),
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn', type: 'button', onClick: close }, 'Close'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => { download(`${base}.yaml`, A.toYAML(doc()), 'application/yaml'); } }, 'Download YAML'))));
  document.body.append(dlg);
  dlg.showModal();
}

boot();
