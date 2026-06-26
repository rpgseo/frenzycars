import { describe, it, expect } from 'vitest';
import { slugifyTag } from '../src/lib/slugify';
describe('slugifyTag', () => {
  it('matches Hugo urlize for known tags', () => {
    expect(slugifyTag('Mercedes-AMG')).toBe('mercedes-amg');
    expect(slugifyTag('V8')).toBe('v8');
    expect(slugifyTag('Hot Hatch')).toBe('hot-hatch');
    expect(slugifyTag('GT3-RS')).toBe('gt3-rs');
  });
});
