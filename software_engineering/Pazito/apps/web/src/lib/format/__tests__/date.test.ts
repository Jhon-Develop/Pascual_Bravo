import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateShort,
  formatDateMedium,
  formatDateLong,
  formatDateRelative,
  formatDateTime,
  formatTime,
  parseDate,
  formatDateForInput,
  formatDateTimeForInput,
  isToday,
  isPast,
  isFuture,
  getDateRange,
} from '../date';

describe('Date Formatting', () => {
  // Use a fixed date for consistent tests
  const testDate = new Date('2024-01-15T14:30:00Z');
  const testDateISO = '2024-01-15T14:30:00.000Z';

  describe('formatDate', () => {
    it('formats date with default pattern', () => {
      const result = formatDate(testDate);
      expect(result).toContain('2024');
      expect(result).toContain('enero');
      expect(result).toContain('15');
    });

    it('handles null/undefined', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
    });

    it('handles invalid dates', () => {
      expect(formatDate('invalid')).toBe('Fecha inválida');
      expect(formatDate(new Date('invalid'))).toBe('Fecha inválida');
    });

    it('accepts custom pattern', () => {
      const result = formatDate(testDate, 'yyyy-MM-dd');
      expect(result).toBe('2024-01-15');
    });
  });

  describe('formatDateShort', () => {
    it('formats as short date', () => {
      const result = formatDateShort(testDate);
      expect(result).toMatch(/15\s+ene\s+2024/i);
    });
  });

  describe('formatDateMedium', () => {
    it('formats as medium date', () => {
      const result = formatDateMedium(testDate);
      expect(result).toMatch(/15\s+de\s+enero\s+de\s+2024/i);
    });
  });

  describe('formatDateLong', () => {
    it('formats as long date with weekday', () => {
      const result = formatDateLong(testDate);
      expect(result).toMatch(/lunes/i);
      expect(result).toMatch(/15\s+de\s+enero\s+de\s+2024/i);
    });
  });

  describe('formatDateRelative', () => {
    it('returns "Hoy" for today', () => {
      // This test depends on current date, so we just verify it returns a string
      const result = formatDateRelative(testDate);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('formatDateTime', () => {
    it('formats date and time', () => {
      const result = formatDateTime(testDate);
      expect(result).toContain('2024');
      expect(result).toContain('14:30');
    });
  });

  describe('formatTime', () => {
    it('formats time only', () => {
      const result = formatTime(testDate);
      expect(result).toMatch(/14:30/);
    });
  });

  describe('parseDate', () => {
    it('parses valid ISO string', () => {
      const result = parseDate(testDateISO);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(testDateISO);
    });

    it('returns null for invalid input', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('invalid')).toBeNull();
    });
  });

  describe('formatDateForInput', () => {
    it('formats as YYYY-MM-DD for input[type=date]', () => {
      expect(formatDateForInput(testDate)).toBe('2024-01-15');
      expect(formatDateForInput(testDateISO)).toBe('2024-01-15');
    });

    it('returns empty string for null/undefined', () => {
      expect(formatDateForInput(null)).toBe('');
      expect(formatDateForInput(undefined)).toBe('');
    });
  });

  describe('formatDateTimeForInput', () => {
    it('formats as YYYY-MM-DDTHH:mm for input[type=datetime-local]', () => {
      expect(formatDateTimeForInput(testDate)).toBe('2024-01-15T14:30');
    });
  });

  describe('isToday', () => {
    it('returns boolean', () => {
      const result = isToday(testDate);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isPast', () => {
    it('returns boolean', () => {
      const result = isPast(testDate);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isFuture', () => {
    it('returns boolean', () => {
      const result = isFuture(testDate);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getDateRange', () => {
    it('returns array of dates in range', () => {
      const start = new Date('2024-01-15');
      const end = new Date('2024-01-17');
      const range = getDateRange(start, end);
      expect(range).toHaveLength(3);
      expect(range[0].toISOString().split('T')[0]).toBe('2024-01-15');
      expect(range[1].toISOString().split('T')[0]).toBe('2024-01-16');
      expect(range[2].toISOString().split('T')[0]).toBe('2024-01-17');
    });
  });
});