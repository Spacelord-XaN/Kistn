// Renders CHANGELOG.md to HTML for the release notes dialog. Handles only the
// subset the changelog uses: headings, "- " lists, paragraphs and `code`.

function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}

function inline(s: string): string {
  return escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function renderChangelog(md: string): string {
  const text = md
    .replace(/<!--[\s\S]*?-->/g, '')
    // An empty Unreleased section is just noise for users.
    .replace(/^## \[Unreleased\]\s*(?=^## |(?![\s\S]))/im, '');

  const out: string[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((li) => `<li>${li}</li>`).join('')}</ul>`);
    if (para.length) out.push(`<p>${para.join(' ')}</p>`);
    list = [];
    para = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2].replace(/^\[([^\]]+)\]/, '$1'))}</h${level}>`);
    } else if (line.startsWith('- ')) {
      if (para.length) flush();
      list.push(inline(line.slice(2)));
    } else if (line === '') {
      flush();
    } else if (list.length) {
      // Continuation line of the previous list item.
      list[list.length - 1] += ' ' + inline(line);
    } else {
      para.push(inline(line));
    }
  }
  flush();
  return out.join('\n');
}
