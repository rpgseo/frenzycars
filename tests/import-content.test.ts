import { describe, it, expect } from 'vitest';
import { fixEncoding, tomlFrontmatterToYaml } from '../scripts/import-content.mjs';

describe('fixEncoding', () => {
  it('repairs em-dash mojibake', () => {
    expect(fixEncoding('alive â€" evolved')).toBe('alive — evolved');
  });
  it('strips BOM', () => {
    expect(fixEncoding('﻿+++')).toBe('+++');
  });
});

describe('tomlFrontmatterToYaml', () => {
  it('converts +++ TOML block to --- YAML block', () => {
    const input = `+++\ntitle = 'Hi'\ndraft = false\n+++\n\nBody`;
    const out = tomlFrontmatterToYaml(input);
    expect(out.startsWith('---\n')).toBe(true);
    expect(out).toContain('title: Hi');
    expect(out).toContain('draft: false');
    expect(out.trimEnd().endsWith('Body')).toBe(true);
  });
  it('leaves YAML frontmatter untouched', () => {
    const input = `---\ntitle: Hi\n---\n\nBody`;
    expect(tomlFrontmatterToYaml(input)).toBe(input);
  });
});
