// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { applyStatusTransition } from '../CandidateActions.js';
import type { CandidateStatus } from '../../../lib/reviews-d1.js';

describe('applyStatusTransition', () => {
  const cases: [CandidateStatus, CandidateStatus][] = [
    ['suggested', 'approved'],
    ['suggested', 'rejected'],
    ['approved', 'rejected'],
    ['rejected', 'approved'],
    ['approved', 'suggested'],
  ];

  for (const [current, next] of cases) {
    it(`transitions from ${current} to ${next}`, () => {
      expect(applyStatusTransition(current, next)).toBe(next);
    });
  }
});
