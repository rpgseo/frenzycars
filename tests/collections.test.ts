import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

describe('collections build', () => {
  it('dist exists after a successful build (schema validated)', () => {
    expect(existsSync(join(__dirname, '../dist'))).toBe(true);
  });
});
