export function extractFrontmatterAndBody(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yamlStr = match[1];
  const body = match[2] ?? '';

  const frontmatter: Record<string, unknown> = {};
  const lines = yamlStr.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!keyMatch) { i++; continue; }
    const key = keyMatch[1];
    const rawVal = keyMatch[2].trim();

    if (rawVal === '') {
      const items: unknown[] = [];
      i++;
      while (i < lines.length && lines[i].startsWith('  - ')) {
        const firstLine = lines[i].slice(4);
        const nestedKeyMatch = firstLine.match(/^(\w[\w-]*)\s*:\s*(.*)$/);

        if (nestedKeyMatch) {
          // Object list item: `- key: value` followed by `  key2: value2` lines
          const obj: Record<string, unknown> = {};
          const parseVal = (v: string): unknown => {
            const t = v.trim();
            if (t === 'true') return true;
            if (t === 'false') return false;
            if (t !== '' && !isNaN(Number(t))) return Number(t);
            return t.replace(/^['"]/, '').replace(/['"]$/, '');
          };
          obj[nestedKeyMatch[1]] = parseVal(nestedKeyMatch[2]);
          i++;
          while (i < lines.length && lines[i].startsWith('    ') && !lines[i].startsWith('  - ')) {
            const contKeyMatch = lines[i].trim().match(/^(\w[\w-]*)\s*:\s*(.*)$/);
            if (contKeyMatch) obj[contKeyMatch[1]] = parseVal(contKeyMatch[2]);
            i++;
          }
          items.push(obj);
        } else {
          items.push(firstLine.replace(/^['"]?/, '').replace(/['"]?$/, ''));
          i++;
        }
      }
      if (items.length > 0) frontmatter[key] = items;
      continue;
    }

    if (rawVal === 'true') frontmatter[key] = true;
    else if (rawVal === 'false') frontmatter[key] = false;
    else if (!isNaN(Number(rawVal)) && rawVal !== '') frontmatter[key] = Number(rawVal);
    else frontmatter[key] = rawVal.replace(/^['"]/, '').replace(/['"]$/, '');
    i++;
  }

  return { frontmatter, body };
}
