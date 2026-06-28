import { describe, it, expect } from 'vitest';
import { serializeIndex } from '../index.json.ts';

describe('serializeIndex', () => {
  it('produces compact JSON with cars and pairs keys', () => {
    const json = serializeIndex({
      cars: [{ slug: 'a', label: 'A', make: 'AM' }],
      pairs: { a: ['b'] },
    });
    expect(JSON.parse(json)).toEqual({
      cars: [{ slug: 'a', label: 'A', make: 'AM' }],
      pairs: { a: ['b'] },
    });
  });

  it('serializes an empty index', () => {
    expect(JSON.parse(serializeIndex({ cars: [], pairs: {} }))).toEqual({
      cars: [],
      pairs: {},
    });
  });
});
