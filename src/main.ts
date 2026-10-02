import { basicSetup, EditorView } from 'codemirror';
import { xml } from '@codemirror/lang-xml';
import { EXAMPLE_XML } from './example';
import { generate, GenerateResult } from './generate';
import { frontViewSvg } from './preview/frontView';
import { layoutParts, sheetToSvg } from './export/svg';
import { renderChangelog } from './changelog';
import changelog from '../CHANGELOG.md?raw';

const STORAGE_KEY = 'boxgen.xml';
const UPDATE_DELAY_MS = 250;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const previewEl = $('preview');
const errorsEl = $('errors');
const summaryEl = $('summary');
const exportBtn = $<HTMLButtonElement>('export');
const fileInput = $<HTMLInputElement>('file');

let current: GenerateResult = { errors: [] };

function loadStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? EXAMPLE_XML;
  } catch {
    return EXAMPLE_XML;
  }
}

function store(text: string) {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Storage unavailable (private mode etc.) — autosave is best effort.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
}

function update(text: string) {
  store(text);
  current = generate(text);
  const ok = current.errors.length === 0;

  errorsEl.innerHTML = ok ? '' : `<ul>${current.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
  exportBtn.disabled = !ok;

  if (current.layout && current.boxes) {
    previewEl.innerHTML = frontViewSvg(current.layout, current.boxes);
  }
  // Keep the last good preview visible but faded while the config is broken.
  previewEl.classList.toggle('stale', !ok);

  if (ok && current.parts && current.config) {
    const sheet = layoutParts(current.cutParts!, current.config.export);
    summaryEl.textContent =
      `${current.boxes!.length} drawers · ${current.parts.length} parts · ` +
      `sheet ${Math.round(sheet.width)} × ${Math.round(sheet.height)} mm`;
  } else {
    summaryEl.textContent = '';
  }
}

let timer: number | undefined;
const view = new EditorView({
  doc: loadStored(),
  extensions: [
    basicSetup,
    xml(),
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => update(view.state.doc.toString()), UPDATE_DELAY_MS);
    }),
  ],
  parent: $('editor'),
});

function setText(text: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  update(text);
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

$('open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (file) setText(await file.text());
  fileInput.value = '';
});

$('save').addEventListener('click', () => download('boxgen.xml', view.state.doc.toString(), 'application/xml'));

$('example').addEventListener('click', () => {
  if (view.state.doc.toString() === EXAMPLE_XML || confirm('Replace the current config with the example?')) {
    setText(EXAMPLE_XML);
  }
});

exportBtn.addEventListener('click', () => {
  if (!current.cutParts || !current.config) return;
  const sheet = layoutParts(current.cutParts, current.config.export);
  download('boxgen.svg', sheetToSvg(sheet), 'image/svg+xml');
});

const versionBtn = $<HTMLButtonElement>('version');
const notesDialog = $<HTMLDialogElement>('notes');
versionBtn.textContent = __APP_VERSION__.replace(/^v(?=\d)/, '');
versionBtn.addEventListener('click', () => {
  $('notes-body').innerHTML = renderChangelog(changelog);
  notesDialog.showModal();
});
// Close when clicking the backdrop outside the dialog box.
notesDialog.addEventListener('click', (e) => {
  if (e.target === notesDialog) notesDialog.close();
});

update(view.state.doc.toString());
