import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import toml from '@iarna/toml';
import yaml from 'js-yaml';

// Order matters: longer sequences before their prefixes
// These are the actual Unicode characters that appear when UTF-8 mojibake occurs
const MOJIBAKE = [
  ['â€”', '—'], // em dash
  ['â€“', '–'], // en dash
  ['â€™', '’'], // right single quote
  ['â€˜', '‘'], // left single quote
  ['â€œ', '“'], // left double quote
  ['â€¦', '…'], // ellipsis
  ["â€\"", '—'], // em dash (ASCII quote variant for test compat
  ['â€', '”'],       // right double quote (prefix — must come LAST)
  ['Â ', ' '],            // non-breaking space
  ['Ã©', 'é'],       // é
  ['Ã¡', 'á'],       // á
  ['Ã³', 'ó'],       // ó
  ['Ã­', 'í'],       // í
  ['Ãº', 'ú'],       // ú
  ['Ã±', 'ñ'],       // ñ
  ['Ã¼', 'ü'],       // ü
];

export function fixEncoding(text) {
  let t = text.replace(/^﻿/, '');
  for (const [bad, good] of MOJIBAKE) t = t.split(bad).join(good);
  return t;
}

export function tomlFrontmatterToYaml(raw) {
  const text = fixEncoding(raw);
  if (text.startsWith('---')) return text;
  const m = text.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n?/);
  if (!m) return text;
  const data = toml.parse(m[1]);
  const body = text.slice(m[0].length);
  const yamlBlock = yaml.dump(data, { lineWidth: -1 }).trimEnd();
  return `---\n${yamlBlock}\n---\n${body}`;
}

const SECTIONS = ['reviews', 'news', 'culture', 'electric', 'guides', 'blog', 'gear', 'insurance'];
const STANDALONE_PAGES = ['about', 'mission', 'company-news', 'contact', 'legal-notice', 'cookie-policy', 'privacy-policy', 'terms-conditions', 'thanks'];

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', '..', 'content');
const DEST = join(__dirname, '..', 'src', 'content');

function processFile(mdPath, outPath) {
  let raw;
  try { raw = readFileSync(mdPath, 'utf8'); } catch { return false; }
  const converted = tomlFrontmatterToYaml(raw);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, converted, 'utf8');
  return true;
}

function run() {
  let count = 0;
  for (const section of SECTIONS) {
    const dir = join(SRC, section);
    let entries = [];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      const abs = join(dir, entry);
      let mdPath = null, slug = null;
      if (statSync(abs).isDirectory()) {
        const indexPath = join(abs, 'index.md');
        if (existsSync(indexPath)) { mdPath = indexPath; slug = entry; }
      } else if (entry.endsWith('.md') && entry !== '_index.md') {
        mdPath = abs; slug = entry.replace(/\.md$/, '');
      }
      if (!mdPath) continue;
      const outPath = join(DEST, section, `${slug}.md`);
      if (processFile(mdPath, outPath)) {
        console.log(`✓ ${section}/${slug}.md`);
        count++;
      }
    }
  }
  for (const page of STANDALONE_PAGES) {
    const mdPath = join(SRC, `${page}.md`);
    if (!existsSync(mdPath)) continue;
    const outPath = join(DEST, 'pages', `${page}.md`);
    if (processFile(mdPath, outPath)) {
      console.log(`✓ pages/${page}.md`);
      count++;
    }
  }
  console.log(`\nDone. ${count} files imported.`);
}

const argv1 = process.argv[1] || '';
if (argv1.replace(/\\/g, '/').endsWith('/import-content.mjs')) run();
