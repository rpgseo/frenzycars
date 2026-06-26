import { describe, it, expect } from 'vitest';
import { loadMaintenancePages } from '../src/lib/maintenance';

describe('maintenance loader', () => {
  it('produces exactly 28 pages after anti-thin gate', () => {
    expect(loadMaintenancePages().length).toBe(28);
  });
  it('every page has an id and a title', () => {
    for (const p of loadMaintenancePages()) {
      expect(p.id).toBeTruthy();
      expect(p.title).toBeTruthy();
    }
  });
});
