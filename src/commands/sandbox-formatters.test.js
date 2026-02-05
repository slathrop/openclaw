import { describe, expect, it } from 'vitest';
import {
  countMismatches,
  countRunning,
  formatAge,
  formatImageMatch,
  formatSimpleStatus,
  formatStatus
} from './sandbox-formatters.js';
describe('sandbox-formatters', () => {
  describe('formatStatus', () => {
    it('should format running status', () => {
      expect(formatStatus(true)).toBe('\u{1F7E2} running');
    });
    it('should format stopped status', () => {
      expect(formatStatus(false)).toBe('\u26AB stopped');
    });
  });
  describe('formatSimpleStatus', () => {
    it('should format running status without emoji', () => {
      expect(formatSimpleStatus(true)).toBe('running');
    });
    it('should format stopped status without emoji', () => {
      expect(formatSimpleStatus(false)).toBe('stopped');
    });
  });
  describe('formatImageMatch', () => {
    it('should format matching image', () => {
      expect(formatImageMatch(true)).toBe('\u2713');
    });
    it('should format mismatched image', () => {
      expect(formatImageMatch(false)).toBe('\u26A0\uFE0F  mismatch');
    });
  });
  describe('formatAge', () => {
    it('should format seconds', () => {
      expect(formatAge(5e3)).toBe('5s');
      expect(formatAge(45e3)).toBe('45s');
    });
    it('should format minutes', () => {
      expect(formatAge(6e4)).toBe('1m');
      expect(formatAge(9e4)).toBe('1m');
      expect(formatAge(3e5)).toBe('5m');
    });
    it('should format hours and minutes', () => {
      expect(formatAge(36e5)).toBe('1h 0m');
      expect(formatAge(366e4)).toBe('1h 1m');
      expect(formatAge(72e5)).toBe('2h 0m');
      expect(formatAge(54e5)).toBe('1h 30m');
    });
    it('should format days and hours', () => {
      expect(formatAge(864e5)).toBe('1d 0h');
      expect(formatAge(9e7)).toBe('1d 1h');
      expect(formatAge(1728e5)).toBe('2d 0h');
      expect(formatAge(1836e5)).toBe('2d 3h');
    });
    it('should handle zero', () => {
      expect(formatAge(0)).toBe('0s');
    });
    it('should handle edge cases', () => {
      expect(formatAge(59999)).toBe('59s');
      expect(formatAge(3599999)).toBe('59m');
      expect(formatAge(86399999)).toBe('23h 59m');
    });
  });
  describe('countRunning', () => {
    it('should count running items', () => {
      const items = [
        { running: true, name: 'a' },
        { running: false, name: 'b' },
        { running: true, name: 'c' },
        { running: false, name: 'd' }
      ];
      expect(countRunning(items)).toBe(2);
    });
    it('should return 0 for empty array', () => {
      expect(countRunning([])).toBe(0);
    });
    it('should return 0 when no items running', () => {
      const items = [
        { running: false, name: 'a' },
        { running: false, name: 'b' }
      ];
      expect(countRunning(items)).toBe(0);
    });
    it('should count all when all running', () => {
      const items = [
        { running: true, name: 'a' },
        { running: true, name: 'b' },
        { running: true, name: 'c' }
      ];
      expect(countRunning(items)).toBe(3);
    });
  });
  describe('countMismatches', () => {
    it('should count image mismatches', () => {
      const items = [
        { imageMatch: true, name: 'a' },
        { imageMatch: false, name: 'b' },
        { imageMatch: true, name: 'c' },
        { imageMatch: false, name: 'd' },
        { imageMatch: false, name: 'e' }
      ];
      expect(countMismatches(items)).toBe(3);
    });
    it('should return 0 for empty array', () => {
      expect(countMismatches([])).toBe(0);
    });
    it('should return 0 when all match', () => {
      const items = [
        { imageMatch: true, name: 'a' },
        { imageMatch: true, name: 'b' }
      ];
      expect(countMismatches(items)).toBe(0);
    });
    it('should count all when none match', () => {
      const items = [
        { imageMatch: false, name: 'a' },
        { imageMatch: false, name: 'b' },
        { imageMatch: false, name: 'c' }
      ];
      expect(countMismatches(items)).toBe(3);
    });
  });
});
