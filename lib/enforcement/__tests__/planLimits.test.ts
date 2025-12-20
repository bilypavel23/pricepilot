/**
 * Plan Limits Enforcement Tests
 */

import { describe, it, expect } from 'vitest';
import {
  getMaxProducts,
  getSyncsPerDay,
  wouldExceedProductLimit,
  canRunSync,
  normalizePlanName,
  getHoursBetweenSyncs,
} from '@/lib/plans';

describe('Plan Configuration', () => {
  describe('normalizePlanName', () => {
    it('normalizes STARTER variants', () => {
      expect(normalizePlanName('starter')).toBe('STARTER');
      expect(normalizePlanName('STARTER')).toBe('STARTER');
      expect(normalizePlanName('basic')).toBe('STARTER');
    });

    it('normalizes PRO variants', () => {
      expect(normalizePlanName('pro')).toBe('PRO');
      expect(normalizePlanName('PRO')).toBe('PRO');
      expect(normalizePlanName('professional')).toBe('PRO');
    });

    it('normalizes SCALE variants', () => {
      expect(normalizePlanName('scale')).toBe('SCALE');
      expect(normalizePlanName('SCALE')).toBe('SCALE');
      expect(normalizePlanName('ultra')).toBe('SCALE');
      expect(normalizePlanName('enterprise')).toBe('SCALE');
    });

    it('defaults to free_demo for unknown plans', () => {
      expect(normalizePlanName(null)).toBe('free_demo');
      expect(normalizePlanName(undefined)).toBe('free_demo');
      expect(normalizePlanName('unknown')).toBe('free_demo');
    });
  });

  describe('getMaxProducts', () => {
    it('returns 50 for Starter', () => {
      expect(getMaxProducts('STARTER')).toBe(50);
      expect(getMaxProducts('starter')).toBe(50);
    });

    it('returns 200 for Pro', () => {
      expect(getMaxProducts('PRO')).toBe(200);
      expect(getMaxProducts('pro')).toBe(200);
    });

    it('returns 400 for Scale', () => {
      expect(getMaxProducts('SCALE')).toBe(400);
      expect(getMaxProducts('scale')).toBe(400);
    });

    it('returns 50 for free_demo', () => {
      expect(getMaxProducts('free_demo')).toBe(50);
      expect(getMaxProducts(null)).toBe(50);
    });
  });

  describe('getSyncsPerDay', () => {
    it('returns 1 for Starter', () => {
      expect(getSyncsPerDay('STARTER')).toBe(1);
    });

    it('returns 2 for Pro', () => {
      expect(getSyncsPerDay('PRO')).toBe(2);
    });

    it('returns 4 for Scale', () => {
      expect(getSyncsPerDay('SCALE')).toBe(4);
    });

    it('returns 0 for free_demo', () => {
      expect(getSyncsPerDay('free_demo')).toBe(0);
    });
  });

  describe('getHoursBetweenSyncs', () => {
    it('returns 24 for Starter (1 sync/day)', () => {
      expect(getHoursBetweenSyncs('STARTER')).toBe(24);
    });

    it('returns 12 for Pro (2 syncs/day)', () => {
      expect(getHoursBetweenSyncs('PRO')).toBe(12);
    });

    it('returns 6 for Scale (4 syncs/day)', () => {
      expect(getHoursBetweenSyncs('SCALE')).toBe(6);
    });
  });
});

describe('Product Limit Enforcement', () => {
  describe('wouldExceedProductLimit', () => {
    it('Starter cannot exceed 50 products', () => {
      const result = wouldExceedProductLimit(49, 1, 'STARTER');
      expect(result.exceeded).toBe(false);
      expect(result.canAdd).toBe(1);

      const exceeded = wouldExceedProductLimit(50, 1, 'STARTER');
      expect(exceeded.exceeded).toBe(true);
      expect(exceeded.canAdd).toBe(0);
    });

    it('Pro cannot exceed 200 products', () => {
      const result = wouldExceedProductLimit(199, 1, 'PRO');
      expect(result.exceeded).toBe(false);

      const exceeded = wouldExceedProductLimit(200, 1, 'PRO');
      expect(exceeded.exceeded).toBe(true);
    });

    it('Scale cannot exceed 400 products', () => {
      const result = wouldExceedProductLimit(399, 1, 'SCALE');
      expect(result.exceeded).toBe(false);

      const exceeded = wouldExceedProductLimit(400, 1, 'SCALE');
      expect(exceeded.exceeded).toBe(true);
    });

    it('calculates canAdd correctly for partial imports', () => {
      const result = wouldExceedProductLimit(45, 10, 'STARTER');
      expect(result.exceeded).toBe(true);
      expect(result.canAdd).toBe(5);
    });
  });
});

describe('Sync Limit Enforcement', () => {
  describe('canRunSync', () => {
    it('Starter cannot exceed 1 sync/day', () => {
      expect(canRunSync(0, 'STARTER').allowed).toBe(true);
      expect(canRunSync(1, 'STARTER').allowed).toBe(false);
      expect(canRunSync(1, 'STARTER').reason).toContain('limit reached');
    });

    it('Pro cannot exceed 2 syncs/day', () => {
      expect(canRunSync(0, 'PRO').allowed).toBe(true);
      expect(canRunSync(1, 'PRO').allowed).toBe(true);
      expect(canRunSync(2, 'PRO').allowed).toBe(false);
    });

    it('Scale allows up to 4 syncs/day', () => {
      expect(canRunSync(0, 'SCALE').allowed).toBe(true);
      expect(canRunSync(3, 'SCALE').allowed).toBe(true);
      expect(canRunSync(4, 'SCALE').allowed).toBe(false);
    });

    it('free_demo cannot sync at all', () => {
      expect(canRunSync(0, 'free_demo').allowed).toBe(false);
      expect(canRunSync(0, 'free_demo').reason).toContain('not available');
    });

    it('returns remaining sync count', () => {
      const result = canRunSync(1, 'SCALE');
      expect(result.remaining).toBe(3);
    });
  });
});



