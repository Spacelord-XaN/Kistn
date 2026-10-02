import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderChangelog } from '../src/changelog';

describe('renderChangelog', () => {
  it('renders headings, lists and inline code', () => {
    const html = renderChangelog('## [1.0.0] - 2026-01-01\n\n### Added\n\n- New `thing`\n- Other\n');
    expect(html).toBe(
      '<h2>1.0.0 - 2026-01-01</h2>\n<h3>Added</h3>\n<ul><li>New <code>thing</code></li><li>Other</li></ul>',
    );
  });

  it('joins paragraph and list continuation lines', () => {
    expect(renderChangelog('Some\ntext')).toBe('<p>Some text</p>');
    expect(renderChangelog('- long\n  item')).toBe('<ul><li>long item</li></ul>');
  });

  it('escapes HTML', () => {
    expect(renderChangelog('- <b>&</b>')).toBe('<ul><li>&lt;b&gt;&amp;&lt;/b&gt;</li></ul>');
  });

  it('strips comments', () => {
    expect(renderChangelog('<!--\nhidden\n-->\n# Changelog')).toBe('<h1>Changelog</h1>');
  });

  it('drops an empty Unreleased section', () => {
    expect(renderChangelog('## [Unreleased]\n\n## [1.0.0]\n')).toBe('<h2>1.0.0</h2>');
    expect(renderChangelog('## [1.0.0]\n\n## [Unreleased]\n')).toBe('<h2>1.0.0</h2>');
  });

  it('keeps a non-empty Unreleased section', () => {
    expect(renderChangelog('## [Unreleased]\n\n- Next\n')).toBe('<h2>Unreleased</h2>\n<ul><li>Next</li></ul>');
  });

  it('renders the project changelog', () => {
    const html = renderChangelog(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
    expect(html).toContain('<h2>0.1.0 - 2026-10-02</h2>');
    expect(html).not.toContain('<!--');
  });
});
